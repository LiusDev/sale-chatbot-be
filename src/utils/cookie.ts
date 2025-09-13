import type { Context } from "hono"
import type { AppContext } from "../types/env"

/**
 * Get cookie configuration based on environment
 * Backend always runs in production, but frontend can be localhost or production
 * @param c Hono context
 * @returns Cookie options object
 */
export function getCookieConfig(c: Context<AppContext>) {
	const origin = c.req.header("Origin") || c.req.header("Referer")

	// Check if frontend request is from localhost (development)
	const isFrontendLocalhost =
		origin?.includes("localhost") || origin?.includes("127.0.0.1")

	const config: any = {
		httpOnly: true,
		secure: true, // Backend always runs on HTTPS in production
		path: "/",
	}

	if (isFrontendLocalhost) {
		// Frontend is localhost: Need cross-site cookie for localhost -> production
		config.sameSite = "None" // Required for cross-origin requests
		// Don't set domain - let browser handle cross-origin cookie for localhost
	} else {
		// Frontend is also production (same domain): Use subdomain sharing
		config.domain = ".tuanyenbai.id.vn"
		config.sameSite = "Lax" // Same-site within tuanyenbai.id.vn domain
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
	const isFrontendLocalhost =
		origin?.includes("localhost") || origin?.includes("127.0.0.1")

	console.log(`🍪 Setting cookie "${cookieName}":`, {
		config,
		origin,
		isFrontendLocalhost,
		backendAlwaysProduction: true,
		appHost: c.env.APP_HOST,
	})

	return config
}
