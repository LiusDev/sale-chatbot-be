export enum GoogleAuth {
	AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth",
	REDIRECT_URI = "/api/auth/google/callback",
	TOKEN_URI = "https://oauth2.googleapis.com",
	GRANT_TYPE = "authorization_code",
	USER_INFO_URI = "https://www.googleapis.com/oauth2/v2/userinfo",
}

export enum JwtExp {
	ONE_DAY = 60 * 60 * 24,
	ONE_WEEK = 60 * 60 * 24 * 7,
}
