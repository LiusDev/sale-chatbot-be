import { Context, Hono, Next } from "hono"
import { AppContext } from "../../types/env"

const meta = new Hono<AppContext>()

const hex = (buf: ArrayBuffer) =>
	[...new Uint8Array(buf)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")

const verifyMetaSignature = async (c: Context, next: Next) => {
	// Meta sends: x-hub-signature-256: sha256=<hex>
	const signatureHeader =
		c.req.header("x-hub-signature-256") ||
		c.req.header("X-Hub-Signature-256")

	if (!signatureHeader) {
		return c.text(`Missing "x-hub-signature-256" header.`, 400)
	}

	const [algo, signatureHex] = signatureHeader.split("=")
	if (algo !== "sha256" || !signatureHex) {
		return c.text("Invalid signature format.", 400)
	}

	// Read a clone so the original request body remains readable downstream
	const reqClone = c.req.raw.clone()
	const bodyBuf = await reqClone.arrayBuffer()

	// Compute HMAC-SHA256 over raw body using app secret
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(c.env.META_VERIFY_SIGNATURE),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	)
	const sig = await crypto.subtle.sign("HMAC", key, bodyBuf)
	const expectedHex = hex(sig)

	if (expectedHex !== signatureHex) {
		return c.text("Couldn't validate the request signature.", 401)
	}

	// Optionally pass raw body to handlers (so bạn không phải đọc lại)
	// Handlers có thể lấy bằng c.get('rawBody')
	c.set("rawBody", bodyBuf)

	await next()
}

meta.post("/webhook", verifyMetaSignature, async (c) => {
	const body = await c.req.json()
	console.log(body)
	return c.json({ message: "Webhook received" })
})

meta.get("/webhook", async (c) => {
	const mode = c.req.query("hub.mode")
	const challenge = c.req.query("hub.challenge")
	const verifyToken = c.req.query("hub.verify_token")
	if (
		mode === "subscribe" &&
		verifyToken === c.env.META_VERIFY_TOKEN &&
		challenge
	) {
		return c.text(challenge)
	}
	return c.json({ message: "Verify failed" })
})

export default meta
