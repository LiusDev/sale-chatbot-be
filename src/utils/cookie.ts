import type { Context } from "hono"
import type { AppContext } from "../types/env"

/**
 * Get cookie configuration based on environment
 * @param c Hono context
 * @returns Cookie options object
 */
export function getCookieConfig(c: Context<AppContext>) {
	const isProduction = c.env.APP_HOST?.includes("tuanyenbai.id.vn")
	const origin = c.req.header("Origin") || c.req.header("Referer")

	// Check if frontend request is from localhost (development)
	const isFrontendLocalhost =
		origin?.includes("localhost") || origin?.includes("127.0.0.1")

	const config: any = {
		httpOnly: true,
		secure: isProduction, // Use APP_HOST to determine if backend is production
		path: "/",
	}

	if (isProduction) {
		// Backend is production
		if (isFrontendLocalhost) {
			// Frontend localhost -> Backend production: cross-origin
			config.sameSite = "None"
			// Don't set domain for localhost compatibility
		} else {
			// Both frontend and backend are production: same domain
			config.domain = ".tuanyenbai.id.vn"
			config.sameSite = "Lax"
		}
	} else {
		// Backend is localhost/development (fallback)
		config.sameSite = "Lax"
	}

	return config
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

/**
 * Debug helper to log cookie configuration
 * @param c Hono context
 * @param cookieName Name of the cookie being set
 */
export function debugCookieConfig(c: Context<AppContext>, cookieName: string) {
	const config = getCookieConfig(c)
	const origin = c.req.header("Origin") || c.req.header("Referer")
	const isProduction = c.env.APP_HOST?.includes("tuanyenbai.id.vn")
	const isFrontendLocalhost =
		origin?.includes("localhost") || origin?.includes("127.0.0.1")

	console.log(`🍪 Setting cookie "${cookieName}":`, {
		config,
		origin,
		isProduction,
		isFrontendLocalhost,
		appHost: c.env.APP_HOST,
		headers: {
			origin: c.req.header("Origin"),
			referer: c.req.header("Referer"),
			userAgent: c.req.header("User-Agent"),
		},
	})

	// Also log the exact setCookie call that would be made
	console.log(`🍪 Cookie will be set with:`, JSON.stringify(config, null, 2))

	return config
}
