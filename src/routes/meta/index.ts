import { Context, Hono, Next } from "hono"
import { AppContext } from "../../types/env"
import { metaWebhookVerification } from "../../middlewares"

const meta = new Hono<AppContext>()

meta.post("/webhook", metaWebhookVerification, async (c) => {
	// Get the verified body from the middleware
	const verifiedBody = c.get("verifiedBody")
	// const body = JSON.parse(verifiedBody)

	console.log("Verified Meta webhook payload:", verifiedBody)
	return c.json({ message: "Webhook received" }, 200)
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
