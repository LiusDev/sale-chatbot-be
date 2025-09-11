import { Context } from "hono"
import { AppContext } from "../types/env"
import ky from "ky"
import { GoogleAuth } from "../utils/constant"
import { GoogleProfile } from "../types/google.type"

const exchangeCodeAPI = ky.create({
	prefixUrl: GoogleAuth.TOKEN_URI,
})

const userInfoAPI = ky.create({
	prefixUrl: GoogleAuth.USER_INFO_URI,
})

// Exchange google code for token
export const exchangeGoogleCodeForToken = async (
	c: Context<AppContext>,
	code: string
) => {
	const tokenResponse = await exchangeCodeAPI
		.post<{ access_token: string; refresh_token: string }>("token", {
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				client_id: c.env.GOOGLE_CLIENT_ID,
				client_secret: c.env.GOOGLE_CLIENT_SECRET,
				redirect_uri: `${c.env.APP_HOST}${GoogleAuth.REDIRECT_URI}`,
				code,
				grant_type: GoogleAuth.GRANT_TYPE,
			}),
		})
		.json()

	return tokenResponse
}

export const getGoogleUserInfo = async (
	accessToken: string
): Promise<GoogleProfile> => {
	const userInfoResponse = await userInfoAPI
		.get<GoogleProfile>("", {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		})
		.json()

	return userInfoResponse
}
