import { Context } from "hono"
import { AppContext } from "../types/env"
import { getMetaAccessToken } from "../routes/meta/meta.repo"
import ky from "ky"
import {
	MetaFanpage,
	MetaListResponse,
	MetaPageConversation,
	MetaPageConversationMessage,
} from "../types/meta"

const metaBaseAPI = (accessToken: string) =>
	ky.create({
		prefixUrl: "https://graph.facebook.com/v23.0",
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
		hooks: {},
	})

export const getFanpagesFromMeta = async (
	c: Context<AppContext>,
	{
		accessToken,
	}: {
		accessToken: string
	}
) => {
	if (!accessToken) {
		throw new Error(
			"Meta access token not found. Please configure metaAccessToken in app settings."
		)
	}

	try {
		const fanpages = await metaBaseAPI(accessToken)
			.get("me/accounts")
			.json<MetaListResponse<MetaFanpage>>()
		return fanpages
	} catch (error) {
		console.error("Error fetching fanpages from Meta API:", error)
		throw new Error(
			"Failed to fetch fanpages from Meta. Please check your access token and try again."
		)
	}
}

export const getMetaPageConversations = async (
	c: Context<AppContext>,
	{
		pageId,
		pageAccessToken,
	}: {
		pageId: string
		pageAccessToken: string
	}
) => {
	if (!pageId) {
		throw new Error(
			"Meta page ID not found. Please configure pageId in app settings."
		)
	}

	if (!pageAccessToken) {
		throw new Error(
			"Meta page access token not found. Please configure pageAccessToken in app settings."
		)
	}

	try {
		const conversations = await metaBaseAPI(pageAccessToken)
			.get(`${pageId}/conversations`, {
				searchParams: new URLSearchParams({
					fields: "participants,messages.limit(100){id,created_time,from,message,attachments}",
					access_token: pageAccessToken,
				}),
			})
			.json<MetaListResponse<MetaPageConversation>>()
		return conversations
	} catch (error) {
		console.error("Error fetching conversations from Meta API:", error)
		throw new Error(
			"Failed to fetch conversations from Meta. Please check your page access token and try again."
		)
	}
}

export const sendMessageToMeta = async (
	c: Context<AppContext>,
	{
		pageId,
		pageAccessToken,
		recipientId,
		message,
	}: {
		pageId: string
		pageAccessToken: string
		recipientId: string
		message: string
	}
) => {
	if (!pageId) {
		throw new Error(
			"Meta page ID not found. Please configure pageId in app settings."
		)
	}

	if (!pageAccessToken) {
		throw new Error(
			"Meta page access token not found. Please configure pageAccessToken in app settings."
		)
	}

	try {
		const response = await metaBaseAPI(pageAccessToken)
			.post(`${pageId}/messages`, {
				body: null,
				searchParams: new URLSearchParams({
					recipient: `{id: ${recipientId}}`,
					message: `{text: '${message}'}`,
					message_type: "RESPONSE",
					access_token: pageAccessToken,
				}),
			})
			.json<{ recipient_id: string; message_id: string }>()
		return response
	} catch (error) {
		console.error("Error sending message to Meta API:", error)
		throw new Error(
			"Failed to send message to Meta. Please check your page access token and try again."
		)
	}
}

/**
 * Fetch conversation messages from Meta Graph API
 * Uses Cloudflare Cache API to reduce API calls and avoid rate limits
 * @param c - Hono context
 * @param conversationId - The conversation ID to fetch messages for
 * @param pageAccessToken - The page access token for authentication
 * @param limit - Maximum number of messages to fetch (default: 100)
 * @returns Array of messages from the conversation
 */
export const getConversationMessagesFromMeta = async (
	c: Context<AppContext>,
	{
		conversationId,
		pageAccessToken,
		limit = 100,
	}: {
		conversationId: string
		pageAccessToken: string
		limit?: number
	}
): Promise<MetaPageConversationMessage[]> => {
	if (!conversationId) {
		throw new Error(
			"Conversation ID not found. Please provide a valid conversationId."
		)
	}

	if (!pageAccessToken) {
		throw new Error(
			"Meta page access token not found. Please configure pageAccessToken in app settings."
		)
	}

	try {
		// Import cache utilities
		const { getCachedMessages, setCachedMessages } = await import("./cache")

		// Try to get from cache first
		const cachedMessages = await getCachedMessages(conversationId)
		if (cachedMessages) {
			return cachedMessages as MetaPageConversationMessage[]
		}

		// Cache miss - fetch from Meta API
		console.log(
			`[Meta API] Fetching messages for conversation ${conversationId}`
		)
		const response = await metaBaseAPI(pageAccessToken)
			.get(`${conversationId}/messages`, {
				searchParams: new URLSearchParams({
					fields: "id,created_time,from,message,attachments",
					limit: limit.toString(),
					access_token: pageAccessToken,
				}),
			})
			.json<MetaListResponse<MetaPageConversationMessage>>()

		const messages = response.data || []

		// Cache the result
		await setCachedMessages(conversationId, messages)

		return messages
	} catch (error) {
		console.error("Error fetching messages from Meta API:", error)
		throw new Error(
			"Failed to fetch messages from Meta. Please check your page access token and try again."
		)
	}
}
