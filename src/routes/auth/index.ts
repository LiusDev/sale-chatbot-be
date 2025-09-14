import { Hono } from "hono"
import { AppContext } from "../../types/env"
import { zValidator } from "@hono/zod-validator"
import { getAuthProviderPathSchema, getAuthUrlQuerySchema } from "./auth.schema"
import { generateState } from "../../utils/crypto"
import { error } from "../../utils/error"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { GoogleAuth, JwtExp } from "../../utils/constant"
import { getCookieConfigWithMaxAge } from "../../utils/cookie"
import { redirect, response } from "../../utils/response"
import {
	exchangeGoogleCodeForToken,
	getGoogleUserInfo,
} from "../../libs/google"
import {
	getSystemUser,
	getSystemUserByEmail,
	updateSystemUserByEmail,
} from "./auth.repo"
import { generateToken } from "../../utils/jwt"
import status from "http-status"
import { GoogleOAuthState } from "../../types/google.type"
import { authMiddleware } from "../../middlewares"

const auth = new Hono<AppContext>()

auth.get(
	"/url/:provider",
	zValidator("param", getAuthProviderPathSchema),
	zValidator("query", getAuthUrlQuerySchema),
	(c) => {
		try {
			const provider = c.req.valid("param").provider
			switch (provider) {
				case "google":
					const state: GoogleOAuthState = {
						redirect_uri:
							c.req.valid("query").redirect_uri ??
							c.env.FE_CALLBACK_URL,
						value: generateState(),
					}
					const cookieOptions = getCookieConfigWithMaxAge(c, 600) // 10 minutes
					setCookie(c, "oauth_state", state.value, cookieOptions)

					const params = new URLSearchParams({
						client_id: c.env.GOOGLE_CLIENT_ID,
						redirect_uri: `${c.env.APP_HOST}${GoogleAuth.REDIRECT_URI}`,
						response_type: "code",
						scope: "openid email profile",
						state: JSON.stringify(state),
					})

					const authUrl = `${
						GoogleAuth.AUTH_URL
					}?${params.toString()}`
					return response(c, { authUrl, state })
				default:
					return error(c)
			}
		} catch (err) {
			console.error("Error in /url/:provider:", err)
			return error(c, {
				message: "Failed to generate auth URL",
				status: status.INTERNAL_SERVER_ERROR,
			})
		}
	}
)

auth.get(
	"/:provider/callback",
	zValidator("param", getAuthProviderPathSchema),
	async (c) => {
		const provider = c.req.valid("param").provider
		switch (provider) {
			case "google":
				const errorMessage = c.req.query("error")
				const code = c.req.query("code")
				const state = JSON.parse(
					c.req.query("state") ?? ""
				) as GoogleOAuthState
				const storedState = getCookie(c, "oauth_state")
				console.log(`🍪 Stored state from cookie:`, storedState)

				if (errorMessage) {
					return redirect(
						c,
						`${state.redirect_uri}?error=${errorMessage}`
					)
				}

				if (!code || !state || state.value !== storedState) {
					return error(c, {
						message: "Invalid OAuth parameters",
						status: status.BAD_REQUEST,
					})
				}

				deleteCookie(c, "oauth_state")

				try {
					const tokenResponse = await exchangeGoogleCodeForToken(
						c,
						code
					)
					const userInfo = await getGoogleUserInfo(
						tokenResponse.access_token
					)

					const systemUser = await getSystemUserByEmail(c, {
						email: userInfo.email,
					})
					if (!systemUser) {
						return redirect(
							c,
							`${state.redirect_uri}?error=User not found`
						)
					}
					await updateSystemUserByEmail(c, {
						email: userInfo.email,
						avatar: userInfo.picture,
						name: userInfo.name,
					})
					const token = await generateToken(c, {
						sub: systemUser.id,
						name: systemUser.name,
					})

					const cookieOptions = getCookieConfigWithMaxAge(
						c,
						JwtExp.ONE_WEEK
					)
					setCookie(c, "auth_token", token, cookieOptions)

					return redirect(c, state.redirect_uri)
				} catch (err) {
					console.error("OAuth error:", err)
					return error(c, {
						message: "OAuth error",
						status: status.INTERNAL_SERVER_ERROR,
					})
				}
			default:
				return error(c)
		}
	}
)

auth.get("/logout", authMiddleware, (c) => {
	try {
		const cookieOptions = getCookieConfigWithMaxAge(c, 0)
		deleteCookie(c, "auth_token", cookieOptions)
		return response(c, { message: "Logged out successfully" })
	} catch (err) {
		console.error("Error in /logout:", err)
		return error(c, {
			message: "Failed to logout",
			status: status.INTERNAL_SERVER_ERROR,
		})
	}
})

auth.get("/me", authMiddleware, async (c) => {
	try {
		const user = c.get("jwtPayload")
		const systemUser = await getSystemUser(c, {
			id: user.sub,
		})
		return response(c, { user: systemUser })
	} catch (err) {
		console.error("Error in /me:", err)
		return error(c, {
			message: "Failed to get user info",
			status: status.INTERNAL_SERVER_ERROR,
		})
	}
})

export default auth
