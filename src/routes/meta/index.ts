import { Hono } from "hono"
import { AppContext } from "../../types/env"

const meta = new Hono<AppContext>()

meta.post("/webhook", async (c) => {
	const body = await c.req.json()
	console.log(body)
	return c.json({ message: "Webhook received" })
})

meta.get("/verify", async (c) => {
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
