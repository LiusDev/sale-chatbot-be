import { Hono } from "hono"
import { AppContext } from "../../types/env"

const meta = new Hono<AppContext>()

meta.post("/webhook", async (c) => {
	//  verify header:
	const signature = c.req.header("X-Hub-Signature-256")
	if (!signature) {
		return c.json({ message: "Signature not found" }, 401)
	}
	console.log(signature)
	if (signature !== c.env.META_VERIFY_SIGNATURE) {
		return c.json({ message: "Invalid signature" }, 401)
	}
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
