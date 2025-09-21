import { Context, Next } from "hono"
import { AppContext } from "../types/env"

/**
 * Middleware to verify Meta webhook signature
 * This middleware validates the x-hub-signature-256 header from Meta webhooks
 * to ensure the request is authentic and hasn't been tampered with.
 * Based on Express.js verifyRequestSignature function.
 */
export async function metaWebhookVerification(
	c: Context<AppContext>,
	next: Next
) {
	// Only apply to POST requests to meta webhook endpoints
	if (c.req.method !== "POST") {
		await next()
		return
	}

	const signature = c.req.header("x-hub-signature-256")

	if (!signature) {
		console.warn('Couldn\'t find "x-hub-signature-256" in headers.')
		return c.json({ error: "Missing signature header" }, 400)
	}

	try {
		// Get the raw body for signature verification
		const body = await c.req.text()

		// Parse the signature header (format: "sha256=<hash>")
		const elements = signature.split("=")
		if (elements.length !== 2 || elements[0] !== "sha256") {
			throw new Error("Invalid signature format")
		}

		const signatureHash = elements[1]

		// Create expected hash using HMAC-SHA256 with the app secret
		const expectedHash = await createHmacSha256(c.env.META_APP_SECRET, body)

		// Compare signatures (using simple comparison like Express.js example)
		if (signatureHash !== expectedHash) {
			throw new Error("Couldn't validate the request signature.")
		}

		// Store the verified body in context for the route handler
		c.set("verifiedBody", body)

		await next()
	} catch (error) {
		console.error("Meta webhook verification failed:", error)
		return c.json({ error: "Invalid signature" }, 401)
	}
}

/**
 * Create HMAC-SHA256 hash using Web Crypto API
 * This is compatible with Cloudflare Workers
 * Equivalent to crypto.createHmac("sha256", secret).update(data).digest("hex")
 */
async function createHmacSha256(secret: string, data: string): Promise<string> {
	const encoder = new TextEncoder()
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	)

	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(data)
	)

	// Convert ArrayBuffer to hex string
	const hashArray = Array.from(new Uint8Array(signature))
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}
