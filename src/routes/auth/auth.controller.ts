import { Context } from "hono"
import { AppContext } from "../../types/env"
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

export const authController = {
	getAuthUrl: async (c: Context<AppContext, "/url/:provider">) => {
		const provider = c.req.param("provider")
		switch (provider) {
			case "google":
				const state = generateState()
				setCookie(c, "oauth_state", state, {
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
					state: state,
				})

				const authUrl = `${GoogleAuth.AUTH_URL}?${params.toString()}`
				return response(c, { authUrl, state })
			default:
				return error(c)
		}
	},

	getAuthCallback: async (c: Context<AppContext, "/:provider/callback">) => {
		const provider = c.req.param("provider")
		switch (provider) {
			case "google":
				const errorMessage = c.req.query("error")

				if (errorMessage) {
					return redirect(
						c,
						`${c.env.FE_CALLBACK_URL}?error=${errorMessage}`
					)
				}

				const code = c.req.query("code")
				const state = c.req.query("state")
				const storedState = getCookie(c, "oauth_state")

				if (!code || !state || state !== storedState) {
					return c.json(
						{
							error: "Invalid OAuth parameters",
							authenticated: false,
						},
						400
					)
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
							`${c.env.FE_CALLBACK_URL}?error=User not found`
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

					return redirect(c, c.env.FE_CALLBACK_URL)
				} catch (err) {
					console.error("OAuth error:", err)
					return error(c, {
						message: "OAuth error",
						status: 500,
					})
				}
			default:
				return error(c)
		}
	},
}
