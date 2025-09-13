import type { Context } from "hono"
import type { AppContext } from "../types/env"

/**
 * Get cookie configuration based on environment
 * @param c Hono context
 * @returns Cookie options object
 */
export function getCookieConfig(c: Context<AppContext>) {
	const isProduction = c.env.APP_HOST?.includes("tuanyenbai.id.vn")

	return {
		httpOnly: true,
		secure: isProduction,
		sameSite: isProduction ? ("None" as const) : ("Lax" as const),
		...(isProduction && { domain: ".tuanyenbai.id.vn" }),
	}
}

/**
 * Get cookie configuration with custom maxAge
 * @param c Hono context
 * @param maxAge Cookie expiration time in seconds
 * @returns Cookie options object with maxAge
 */
export function getCookieConfigWithMaxAge(
	c: Context<AppContext>,
	maxAge: number
) {
	return {
		...getCookieConfig(c),
		maxAge,
	}
}
