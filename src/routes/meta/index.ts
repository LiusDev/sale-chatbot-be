import { Hono } from "hono"
import { AppContext } from "../../types/env"
import { authMiddleware, metaWebhookVerification } from "../../middlewares"
import {
	deleteMetaPage,
	getConversationById,
	getConversationMessages,
	getMetaAccessToken,
	getMetaPages,
	getMetaWebhookVerifyKey,
	getPageById,
	getPageConversations,
	saveMessageToDatabase,
	syncPageConversations,
	upsertMetaPages,
	findConversationByPageAndRecipient,
	assignAgentToPage,
	updateAgentMode,
} from "./meta.repo"
import {
	getFanpagesFromMeta,
	getMetaPageConversations,
	sendMessageToMeta,
} from "../../libs/meta"
import { listResponse, response } from "../../utils/response"
import { zValidator } from "@hono/zod-validator"
import {
	agentIdSchema,
	agentModeSchema,
	metaPageSchema,
	pageIdParamSchema,
	paramsSchema,
	sendMessageSchema,
} from "./meta.schema"
import { error } from "../../utils/error"

const meta = new Hono<AppContext>()

meta.post("/webhook", metaWebhookVerification, async (c) => {
	try {
		const verifiedBody = c.get("verifiedBody") as string
		const payload = JSON.parse(verifiedBody)

		if (payload.object !== "page" || !Array.isArray(payload.entry)) {
			return c.json({ message: "Ignored" }, 200)
		}

		for (const entry of payload.entry) {
			const pageId = entry.id
			if (!Array.isArray(entry.messaging)) continue
			for (const messagingEvent of entry.messaging) {
				const senderId = messagingEvent.sender?.id
				const recipientId = messagingEvent.recipient?.id
				const timestamp = messagingEvent.timestamp
				const message = messagingEvent.message
				if (!message) continue

				const isEcho = Boolean(message.is_echo)
				const text = message.text || ""
				const mid = message.mid || `${pageId}-${timestamp}`

				const userId = isEcho ? recipientId : senderId
				if (!userId || !pageId) continue
				const page = await getPageById(c, pageId)
				const conversation = await findConversationByPageAndRecipient(
					c,
					{
						pageId,
						recipientId: userId,
					}
				)
				if (!conversation) continue

				await saveMessageToDatabase(c, {
					messageId: mid,
					conversationId: conversation.id,
					createdTime: new Date(timestamp).toUTCString(),
					message: text,
					from: {
						id: isEcho ? pageId : userId,
						name: isEcho ? page.name : conversation.recipientName!,
					},
				})
			}
		}

		return c.json({ message: "Webhook received" }, 200)
	} catch (err) {
		console.error("Error processing meta webhook:", err)
		return c.json({ message: "Webhook error" }, 500)
	}
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

// sync page conversations
meta.patch(
	"/pages/:pageId/sync",
	zValidator("param", pageIdParamSchema),
	async (c) => {
		try {
			const { pageId } = c.req.valid("param")
			const page = await getPageById(c, pageId)
			const metaConversations = await getMetaPageConversations(c, {
				pageId,
				pageAccessToken: page.access_token!,
			})
			const result = await syncPageConversations(c, {
				pageId,
				conversations: metaConversations.data,
			})
			return response(c, result)
		} catch (err) {
			console.error("Error syncing page conversations:", err)
			return error(c, {
				message: "Failed to sync page conversations",
				status: 500,
			})
		}
	}
)

// Get conversations of a page
meta.get(
	"/pages/:pageId",
	zValidator("param", pageIdParamSchema),
	async (c) => {
		const { pageId } = c.req.valid("param")
		const conversations = await getPageConversations(c, { pageId })
		return listResponse(c, conversations, {
			total: conversations.length,
			page: 1,
			limit: 99,
		})
	}
)

// Assign agent to a page
meta.put(
	"/pages/:pageId/assign-agent",
	zValidator("param", pageIdParamSchema),
	zValidator("json", agentIdSchema),
	async (c) => {
		try {
			const { pageId } = c.req.valid("param")
			const { agentId } = c.req.valid("json")
			await assignAgentToPage(c, { pageId, agentId })
			return response(c, { message: "Agent assigned to page" })
		} catch (err) {
			console.error("Error assigning agent to page:", err)
			return error(c, {
				message: "Failed to assign agent to page",
				status: 500,
			})
		}
	}
)

meta.get(
	"/pages/:pageId/:conversationId",
	zValidator("param", paramsSchema),
	async (c) => {
		const { pageId, conversationId } = c.req.valid("param")
		const conversation = await getConversationMessages(c, {
			pageId,
			conversationId,
		})
		return listResponse(c, conversation, {
			total: conversation.length,
			page: 1,
			limit: 99,
		})
	}
)

meta.post(
	"/pages/:pageId/:conversationId",
	zValidator("param", paramsSchema),
	zValidator("json", sendMessageSchema),
	async (c) => {
		try {
			const { pageId, conversationId } = c.req.valid("param")
			const { message } = c.req.valid("json")
			const page = await getPageById(c, pageId)
			const conversation = await getConversationById(c, {
				pageId,
				conversationId,
			})
			if (!conversation) {
				return error(c, {
					message: "Conversation not found",
					status: 404,
				})
			}
			const recipientId = conversation.recipientId!
			console.log("pageAccessToken", page.access_token)
			console.log("recipientId", recipientId)

			const metaResponse = await sendMessageToMeta(c, {
				pageId,
				recipientId,
				message,
				pageAccessToken: page.access_token!,
			})
			await saveMessageToDatabase(c, {
				messageId: metaResponse.message_id,
				conversationId,
				// convert to utc timezone
				createdTime: new Date().toUTCString(),
				message,
				from: {
					name: page.name,
					id: page.id,
				},
			})
			return response(c, response)
		} catch (err) {
			console.error("Error sending message to Meta:", err)
			return error(c, {
				message: "Failed to send message to Meta",
				status: 500,
			})
		}
	}
)

// Update agent mode ("auto", "manual")
meta.put(
	"/pages/:pageId/:conversationId/agent-mode",
	zValidator("param", paramsSchema),
	zValidator("json", agentModeSchema),
	async (c) => {
		try {
			const { conversationId } = c.req.valid("param")
			const { agentMode } = c.req.valid("json")
			const result = await updateAgentMode(c, {
				conversationId,
				agentMode,
			})
			return response(c, { message: "Agent mode updated" })
		} catch (err) {
			console.error("Error updating agent mode:", err)
			return error(c, {
				message: "Failed to update agent mode",
				status: 500,
			})
		}
	}
)

export default meta
