import { Context, Next } from "hono"
import { env } from "hono/adapter"
import { jwt } from "hono/jwt"
import { AppContext } from "../types/env"
import { setCookie } from "hono/cookie"
import { getCookieConfig } from "../utils/cookie"

export const authMiddleware = (c: Context<AppContext>, next: Next) => {
	// Check if Authorization header with Bearer token exists
	const authHeader = c.req.header("Authorization")
	if (authHeader && authHeader.startsWith("Bearer ")) {
		// Extract token from "Bearer <token>"
		const token = authHeader.substring(7)
		// Set the token as auth_token cookie
		setCookie(c, "auth_token", token, getCookieConfig(c))
	}

	const jwtMiddleware = jwt({
		secret: env(c).JWT_SECRET,
		cookie: "auth_token",
	})

	return jwtMiddleware(c, next)
}
