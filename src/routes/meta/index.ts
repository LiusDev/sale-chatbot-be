import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
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
import { UIMessage } from "ai"
import { generateAIResponse } from "../../libs/ai"
import { AIModel } from "../../types/ai"

const meta = new Hono<AppContext>()

// In-memory pub/sub for SSE per pageId
type MessageInsertedEvent = { conversationId: string }
const pageSubscribers = new Map<
	string,
	Set<(payload: MessageInsertedEvent) => void>
>()

function subscribeToPage(
	pageId: string,
	listener: (payload: MessageInsertedEvent) => void
) {
	let set = pageSubscribers.get(pageId)
	if (!set) {
		set = new Set()
		pageSubscribers.set(pageId, set)
	}
	set.add(listener)
	return () => {
		const current = pageSubscribers.get(pageId)
		if (!current) return
		current.delete(listener)
		if (current.size === 0) {
			pageSubscribers.delete(pageId)
		}
	}
}

function publishMessageInserted(pageId: string, payload: MessageInsertedEvent) {
	const set = pageSubscribers.get(pageId)
	if (!set) return
	console.log("[SSE] publish message-inserted", { pageId, payload })
	for (const listener of set) {
		try {
			listener(payload)
		} catch {}
	}
}

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
				console.log("isEcho", isEcho)

				const text = message.text || ""
				const mid = message.mid || `${pageId}-${timestamp}`

				const userId = isEcho ? recipientId : senderId
				if (!userId || !pageId) continue
				const page = await getPageById(c, pageId)
				if (!page) continue

				// Find conversation once; if not found, sync then re-find.
				let conversation = await findConversationByPageAndRecipient(c, {
					pageId,
					recipientId: userId,
				})
				let conversationJustSynced = false
				if (!conversation) {
					const metaConversations = await getMetaPageConversations(
						c,
						{
							pageId,
							pageAccessToken: page.access_token!,
						}
					)
					await syncPageConversations(c, {
						pageId,
						conversations: metaConversations.data,
					})
					conversation = await findConversationByPageAndRecipient(c, {
						pageId,
						recipientId: userId,
					})
					conversationJustSynced = Boolean(conversation)
				}

				// If still not found, skip processing
				if (!conversation) continue

				// Save message to DB based on direction
				// - If echo: save outgoing page message (we no longer save in send API)
				// - If not echo: save incoming user message only when not just synced
				let published = false
				if (isEcho) {
					await saveMessageToDatabase(c, {
						messageId: mid,
						conversationId: conversation.id,
						createdTime: new Date(timestamp).toUTCString(),
						message: text,
						from: {
							name: page.name,
							id: page.id,
						},
					})
					publishMessageInserted(pageId, {
						conversationId: conversation.id,
					})
					published = true
				} else if (!conversationJustSynced) {
					await saveMessageToDatabase(c, {
						messageId: mid,
						conversationId: conversation.id,
						createdTime: new Date(timestamp).toUTCString(),
						message: text,
						from: {
							id: userId,
							name: conversation.recipientName!,
						},
					})
					publishMessageInserted(pageId, {
						conversationId: conversation.id,
					})
					published = true
				}

				// Always notify at least once for FE to revalidate, even if we skipped saving (e.g., first message after sync)
				if (!published) {
					publishMessageInserted(pageId, {
						conversationId: conversation.id,
					})
				}

				// AI Response
				// Check if conversation agentmode
				if (isEcho) continue
				const agentMode = conversation.agentmode
				if (agentMode !== "auto") continue

				const conversationMessages = await getConversationMessages(c, {
					pageId,
					conversationId: conversation.id,
				})

				const uiMessages: UIMessage[] = conversationMessages
					.filter((message) => message.message.trim().length > 0)
					.map((message) => {
						let from: { id?: string; name?: string } = {}
						try {
							from = JSON.parse((message as any).from || "{}")
						} catch {}
						const role: "user" | "assistant" =
							typeof from.id === "string" &&
							from.id === conversation.recipientId
								? "user"
								: "assistant"
						return {
							id: message.id,
							role,
							parts: [{ type: "text", text: message.message }],
						}
					})

				uiMessages.reverse()

				const { text: aiResponseText } = await generateAIResponse(c, {
					groupId: page.agent?.knowledge_source_group_id || null,
					model:
						(page.agent?.model as AIModel) ||
						"gpt-4.1-mini-2025-04-14",
					systemPrompt: page.agent?.system_prompt || "",
					messages: uiMessages,
					temperature: page.agent?.temperature || 70,
					maxTokens: page.agent?.max_tokens || 5000,
					topK: page.agent?.top_k || 5,
				})
				if (!aiResponseText) continue
				const aiResponseResult = await sendMessageToMeta(c, {
					pageId,
					recipientId: conversation.recipientId!,
					message: aiResponseText,
					pageAccessToken: page.access_token!,
				})
				// Do not save here; echo webhook will persist the page's outgoing message
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

// SSE: subscribe to message-inserted events per pageId
meta.get("/pages/:pageId/sse", async (c) => {
	const pageId = c.req.param("pageId")
	if (!pageId) {
		return c.json({ message: "pageId is required" }, 400)
	}
	// Ensure proxies don't buffer and keep connection alive
	c.header("X-Accel-Buffering", "no")
	c.header("Cache-Control", "no-cache, no-transform")
	c.header("Connection", "keep-alive")
	return streamSSE(c, async (stream) => {
		let nextId = 1
		console.log("[SSE] client connected", { pageId })
		const send = (payload: MessageInsertedEvent) => {
			stream
				.writeSSE({
					id: String(nextId++),
					event: "message-inserted",
					data: JSON.stringify({
						conversationId: payload.conversationId,
					}),
				})
				.catch(() => {})
		}
		const unsubscribe = subscribeToPage(pageId, send)
		// initial ready event so clients know subscription is active
		await stream.writeSSE({
			id: String(nextId++),
			event: "ready",
			data: "ok",
		})
		let alive = true
		const keepAlive = async () => {
			while (alive) {
				await stream.sleep(15000)
				try {
					await stream.writeSSE({
						id: String(nextId++),
						event: "keepalive",
						data: "ping",
					})
				} catch {
					alive = false
				}
			}
		}
		keepAlive()
		await new Promise<void>((resolve) => {
			stream.onAbort(() => {
				alive = false
				unsubscribe()
				console.log("[SSE] client disconnected", { pageId })
				resolve()
			})
		})
	})
})

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
			// Notify subscribers immediately; webhook echo will persist the message shortly after
			publishMessageInserted(pageId, { conversationId })
			return response(c, metaResponse)
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
