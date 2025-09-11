import { Context, Next } from "hono"
import { env } from "hono/adapter"
import { jwt } from "hono/jwt"
import { AppContext } from "../types/env"

export const authMiddleware = (c: Context<AppContext>, next: Next) => {
	const jwtMiddleware = jwt({
		secret: env(c).JWT_SECRET,
		cookie: "auth_token",
	})

	return jwtMiddleware(c, next)
}
