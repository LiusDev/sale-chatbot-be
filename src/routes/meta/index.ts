import { Context, Hono, Next } from "hono"
import { AppContext } from "../../types/env"
import { authMiddleware, metaWebhookVerification } from "../../middlewares"
import {
	deleteMetaPage,
	getMetaAccessToken,
	getMetaPages,
	getMetaWebhookVerifyKey,
	initPageConversations,
	upsertMetaPages,
} from "./meta.repo"
import { getFanpagesFromMeta, getMetaPageConversations } from "../../libs/meta"
import { listResponse, response } from "../../utils/response"
import { zValidator } from "@hono/zod-validator"
import { metaPageSchema } from "./meta.schema"
import { error } from "../../utils/error"

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

	const metaWebhookVerifyKey = await getMetaWebhookVerifyKey(c)
	if (
		mode === "subscribe" &&
		verifyToken === metaWebhookVerifyKey &&
		challenge
	) {
		return c.text(challenge)
	}
	return c.json({ message: "Verify failed" })
})

meta.use(authMiddleware)

meta.get("/meta-pages", async (c) => {
	try {
		const accessToken = await getMetaAccessToken(c)
		const fanpages = await getFanpagesFromMeta(c, { accessToken })
		return listResponse(
			c,
			fanpages.data.map((page) => ({
				id: page.id,
				name: page.name,
				accessToken: page.access_token,
				category: page.category,
			})),
			{
				total: fanpages.data.length,
				page: 1,
				limit: 50,
			}
		)
	} catch (error) {
		console.error("Error fetching fanpages from Meta:", error)
		return c.json(
			{
				message: "Failed to fetch fanpages from Meta",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500
		)
	}
})

meta.get("/pages", async (c) => {
	try {
		const pages = await getMetaPages(c)
		return listResponse(c, pages, {
			total: pages.length,
			page: 1,
			limit: 50,
		})
	} catch (err) {
		console.error("Error getting pages:", err)
		return error(c, {
			message: "Failed to get pages",
			status: 500,
		})
	}
})

// upsert pages to store page infomation to database
meta.patch("/pages", zValidator("json", metaPageSchema), async (c) => {
	try {
		const pages = c.req.valid("json")
		const result = await upsertMetaPages(c, pages)

		// Get initial conversations of each page from Meta API
		for (const page of result) {
			const conversations = await getMetaPageConversations(c, {
				pageId: page.page_id,
				pageAccessToken: page.access_token!,
			})

			await initPageConversations(c, {
				pageId: page.page_id,
				conversations: conversations.data,
			})
		}

		return response(c, result)
	} catch (err) {
		console.error("Error upserting pages:", err)
		return error(c, {
			message: "Failed to upsert pages",
			status: 500,
		})
	}
})

meta.delete("/pages/:pageId", async (c) => {
	try {
		const pageId = c.req.param("pageId")
		const result = await deleteMetaPage(c, pageId)
		return response(c, result)
	} catch (err) {
		console.error("Error deleting page:", err)
		return error(c, {
			message: "Failed to delete page",
			status: 500,
		})
	}
})

export default meta
