import { Hono } from "hono"
import { AppContext } from "../../types/env"
import { zValidator } from "@hono/zod-validator"
import { getAuthProviderPathSchema, getAuthUrlQuerySchema } from "./auth.schema"
import { generateState } from "../../utils/crypto"
import { error } from "../../utils/error"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { GoogleAuth, JwtExp } from "../../utils/constant"
import { redirect, response } from "../../utils/response"
import {
	exchangeGoogleCodeForToken,
	getGoogleUserInfo,
} from "../../libs/google"
import { getSystemUserByEmail } from "./auth.repo"
import { generateToken } from "../../utils/jwt"
import status from "http-status"
import { GoogleOAuthState } from "../../types/google.type"

const auth = new Hono<AppContext>()

auth.get(
	"/url/:provider",
	zValidator("param", getAuthProviderPathSchema),
	zValidator("query", getAuthUrlQuerySchema),
	(c) => {
		const provider = c.req.valid("param").provider
		switch (provider) {
			case "google":
				const state: GoogleOAuthState = {
					redirect_uri:
						c.req.valid("query").redirect_uri ??
						c.env.FE_CALLBACK_URL,
					value: generateState(),
				}
				setCookie(c, "oauth_state", state.value, {
					httpOnly: true,
					secure: true,
					sameSite: "None",
					maxAge: 600, // 10 minutes
				})

				const params = new URLSearchParams({
					client_id: c.env.GOOGLE_CLIENT_ID,
					redirect_uri: `${c.env.APP_HOST}${GoogleAuth.REDIRECT_URI}`,
					response_type: "code",
					scope: "openid email profile",
					state: JSON.stringify(state),
				})

				const authUrl = `${GoogleAuth.AUTH_URL}?${params.toString()}`
				return response(c, { authUrl, state })
			default:
				return error(c)
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
					const token = await generateToken(c, {
						sub: systemUser.id,
						name: systemUser.name,
					})

					setCookie(c, "auth_token", token, {
						httpOnly: true,
						secure: true,
						sameSite: "None",
						domain: ".tuanyenbai.id.vn",
						maxAge: JwtExp.ONE_WEEK,
					})

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

export default auth
