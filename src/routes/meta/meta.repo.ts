import { db } from "../../libs/db"
import {
	aiAgents,
	commonAppInfo,
	metaPageConversationMessages,
	metaPageConversations,
	metaPages,
} from "../../libs/schema"
import { AppContext } from "../../types/env"
import { desc, eq } from "drizzle-orm"
import { Context } from "hono"
import { MetaPageSchema } from "./meta.schema"
import { MetaPageConversation } from "../../types/meta"

export const getMetaWebhookVerifyKey = async (c: Context<AppContext>) => {
	const appInfo = await db(c.env)
		.select()
		.from(commonAppInfo)
		.where(eq(commonAppInfo.key, "metaWebhookVerifyKey"))
	return appInfo[0]?.value as string
}

export const getMetaAccessToken = async (c: Context<AppContext>) => {
	const appInfo = await db(c.env)
		.select()
		.from(commonAppInfo)
		.where(eq(commonAppInfo.key, "metaAccessToken"))
	return appInfo[0]?.value as string
}

export const getMetaAppSecret = async (c: Context<AppContext>) => {
	const appInfo = await db(c.env)
		.select()
		.from(commonAppInfo)
		.where(eq(commonAppInfo.key, "metaAppSecret"))
	return appInfo[0]?.value as string
}

export const getMetaPages = async (c: Context<AppContext>) => {
	const dbConnection = db(c.env)
	const result = await dbConnection
		.select({
			id: metaPages.id,
			name: metaPages.name,
			access_token: metaPages.access_token,
			category: metaPages.category,
			agent_id: metaPages.agent_id,
			// Agent fields
			agent: {
				id: aiAgents.id,
				name: aiAgents.name,
				description: aiAgents.description,
				model: aiAgents.model,
				system_prompt: aiAgents.system_prompt,
				knowledge_source_group_id: aiAgents.knowledge_source_group_id,
				top_k: aiAgents.top_k,
				temperature: aiAgents.temperature,
				max_tokens: aiAgents.max_tokens,
				created_by: aiAgents.created_by,
			},
		})
		.from(metaPages)
		.leftJoin(aiAgents, eq(metaPages.agent_id, aiAgents.id))

	return result
}

export const upsertMetaPages = async (
	c: Context<AppContext>,
	pages: MetaPageSchema
) => {
	const dbConnection = db(c.env)

	// Process each page individually to handle conflicts properly
	const results = []
	for (const page of pages) {
		try {
			const result = await dbConnection
				.insert(metaPages)
				.values({
					id: page.id,
					name: page.name,
					access_token: page.accessToken,
					category: page.category,
				})
				.onConflictDoUpdate({
					target: metaPages.id,
					set: {
						name: page.name,
						access_token: page.accessToken,
						category: page.category,
					},
				})
				.returning()
			results.push(result[0])
		} catch (error) {
			console.error(`Error upserting page ${page.id}:`, error)
			throw error
		}
	}

	return results
}

export const getPageById = async (c: Context<AppContext>, pageId: string) => {
	const dbConnection = db(c.env)
	const result = await dbConnection
		.select({
			id: metaPages.id,
			name: metaPages.name,
			access_token: metaPages.access_token,
			category: metaPages.category,
			agent_id: metaPages.agent_id,
			// Agent fields
			agent: {
				id: aiAgents.id,
				name: aiAgents.name,
				description: aiAgents.description,
				model: aiAgents.model,
				system_prompt: aiAgents.system_prompt,
				knowledge_source_group_id: aiAgents.knowledge_source_group_id,
				top_k: aiAgents.top_k,
				temperature: aiAgents.temperature,
				max_tokens: aiAgents.max_tokens,
				created_by: aiAgents.created_by,
			},
		})
		.from(metaPages)
		.leftJoin(aiAgents, eq(metaPages.agent_id, aiAgents.id))
		.where(eq(metaPages.id, pageId))

	return result[0]
}

export const syncPageConversations = async (
	c: Context<AppContext>,
	{
		pageId,
		conversations,
	}: {
		pageId: string
		conversations: MetaPageConversation[]
	}
) => {
	const dbConnection = db(c.env)

	// Step 0: Delete all conversations of this page
	await dbConnection
		.delete(metaPageConversations)
		.where(eq(metaPageConversations.page_id, pageId))

	// Step 1: Batch insert all conversations in chunks to avoid SQLite variable limit
	const conversationValues = conversations
		.filter((conversation) => conversation.messages)
		.map((conversation) => {
			const recipient = conversation.participants.data.filter(
				(participant) => participant.id !== pageId
			)[0]
			return {
				id: conversation.id,
				page_id: pageId,
				recipientId: recipient?.id || "",
				recipientName: recipient?.name || "",
			}
		})

	// SQLite has a limit on the number of variables (default ~999)
	// With 6 fields per conversation, we can safely insert ~15 conversations at once
	// Using 10 for safety margin
	const conversationResults = []
	const chunkSize = 10
	for (let i = 0; i < conversationValues.length; i += chunkSize) {
		const chunk = conversationValues.slice(i, i + chunkSize)
		const results = await dbConnection
			.insert(metaPageConversations)
			.values(chunk)
			.returning()
		conversationResults.push(...results)
	}

	// NOTE: Temporarily disabled - messages fetched from Meta API on-demand
	// This reduces database load and handles large message volumes better
	// Will be re-enabled when implementing proper database message storage

	// Step 2: Loop through each conversation and batch insert its messages in chunks
	/* 
	for (const conversation of conversations) {
		if (
			conversation.messages?.data &&
			conversation.messages.data.length > 0
		) {
			const messagesToInsert = conversation.messages.data.map(
				(message) => ({
					id: message.id,
					conversation_id: conversation.id,
					created_time: message.created_time,
					message: message.message,
					from: JSON.stringify(message.from),
					attachments: message.attachments
						? JSON.stringify(message.attachments)
						: null,
				})
			)

			// Split messages into chunks of 10
			const chunkSize = 10
			for (let i = 0; i < messagesToInsert.length; i += chunkSize) {
				const chunk = messagesToInsert.slice(i, i + chunkSize)

				// Batch insert this chunk of messages
				await dbConnection.batch([
					dbConnection
						.insert(metaPageConversationMessages)
						.values(chunk),
				] as any)
			}
		}
	}
	*/

	return conversationResults
}

export const assignAgentToPage = async (
	c: Context<AppContext>,
	{ pageId, agentId }: { pageId: string; agentId: number }
) => {
	const dbConnection = db(c.env)
	await dbConnection
		.update(metaPages)
		.set({ agent_id: agentId })
		.where(eq(metaPages.id, pageId))
}

export const deleteMetaPage = async (
	c: Context<AppContext>,
	pageId: string
) => {
	const dbConnection = db(c.env)
	await dbConnection.delete(metaPages).where(eq(metaPages.id, pageId))
}

export const getPageConversations = async (
	c: Context<AppContext>,
	{ pageId }: { pageId: string }
) => {
	const dbConnection = db(c.env)
	const conversations = await dbConnection
		.select()
		.from(metaPageConversations)
		.where(eq(metaPageConversations.page_id, pageId))
	return conversations
}

export const getConversationById = async (
	c: Context<AppContext>,
	{ pageId, conversationId }: { pageId: string; conversationId: string }
) => {
	const dbConnection = db(c.env)
	const conversation = await dbConnection
		.select()
		.from(metaPageConversations)
		.where(eq(metaPageConversations.id, conversationId))
	return conversation[0]
}

/**
 * @deprecated Temporarily not used - messages are fetched from Meta API
 * This function remains for future re-implementation of database storage
 *
 * Get conversation messages from database
 */
export const getConversationMessages = async (
	c: Context<AppContext>,
	{ pageId, conversationId }: { pageId: string; conversationId: string }
) => {
	const dbConnection = db(c.env)
	// sort by created_time descending
	const messages = await dbConnection
		.select()
		.from(metaPageConversationMessages)
		.where(eq(metaPageConversationMessages.conversation_id, conversationId))
		.orderBy(desc(metaPageConversationMessages.created_time))
	return messages
}

/**
 * NEW: Fetch conversation messages from Meta API with caching
 * This replaces the database-based getConversationMessages for now
 */
export const getConversationMessagesFromMetaAPI = async (
	c: Context<AppContext>,
	{ pageId, conversationId }: { pageId: string; conversationId: string }
) => {
	// Get page to retrieve access token
	const page = await getPageById(c, pageId)
	if (!page || !page.access_token) {
		throw new Error("Page not found or access token missing")
	}

	// Import the Meta API function
	const { getConversationMessagesFromMeta } = await import("../../libs/meta")

	// Fetch messages from Meta API (with caching)
	const metaMessages = await getConversationMessagesFromMeta(c, {
		conversationId,
		pageAccessToken: page.access_token,
		limit: 100,
	})

	// Transform Meta API response to match database format for compatibility
	return metaMessages.map((msg: any) => ({
		id: msg.id,
		conversation_id: conversationId,
		created_time: msg.created_time,
		message: msg.message || "",
		from: JSON.stringify(msg.from),
		attachments: msg.attachments ? JSON.stringify(msg.attachments) : null,
	}))
}

export const saveMessageToDatabase = async (
	c: Context<AppContext>,
	{
		messageId,
		conversationId,
		createdTime,
		message,
		from,
		attachments,
	}: {
		messageId: string
		conversationId: string
		createdTime: string
		message: string
		from: Record<string, string>
		attachments?: Record<string, string>
	}
) => {
	const dbConnection = db(c.env)
	await dbConnection.insert(metaPageConversationMessages).values({
		id: messageId,
		conversation_id: conversationId,
		created_time: createdTime,
		message: message,
		from: JSON.stringify(from),
		attachments: attachments ? JSON.stringify(attachments) : null,
	})
}

export const findConversationByPageAndRecipient = async (
	c: Context<AppContext>,
	{ pageId, recipientId }: { pageId: string; recipientId: string }
) => {
	const dbConnection = db(c.env)
	const conversation = await dbConnection
		.select()
		.from(metaPageConversations)
		.where(eq(metaPageConversations.page_id, pageId))
	// Filter by recipientId in memory since drizzle sqlite eq on two columns not composed here
	return conversation.find((c) => c.recipientId === recipientId)
}

export const updateAgentMode = async (
	c: Context<AppContext>,
	{
		conversationId,
		agentMode,
	}: {
		conversationId: string
		agentMode: "auto" | "manual"
	}
) => {
	const dbConnection = db(c.env)
	await dbConnection
		.update(metaPageConversations)
		.set({ agentmode: agentMode })
		.where(eq(metaPageConversations.id, conversationId))
}
