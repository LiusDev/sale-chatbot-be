import { db } from "../../libs/db"
import {
	commonAppInfo,
	metaPageConversationMessages,
	metaPageConversations,
	metaPages,
} from "../../libs/schema"
import { AppContext } from "../../types/env"
import { eq } from "drizzle-orm"
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
	const pages = await dbConnection.select().from(metaPages)
	return pages
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
					page_id: page.id,
					name: page.name,
					access_token: page.accessToken,
					category: page.category,
				})
				.onConflictDoUpdate({
					target: metaPages.page_id,
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

export const initPageConversations = async (
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
	for (const conversation of conversations) {
		await dbConnection.insert(metaPageConversations).values({
			page_id: pageId,
			conversation_id: conversation.id,
		})
		for (const message of conversation.messages?.data || []) {
			await dbConnection.insert(metaPageConversationMessages).values({
				conversation_id: conversation.id,
				message_id: message.id,
				message: message.message,
				from: message.from,
				attachments: message.attachments,
				created_time: message.created_time,
			})
		}
	}
}

export const deleteMetaPage = async (
	c: Context<AppContext>,
	pageId: string
) => {
	const dbConnection = db(c.env)
	await dbConnection.delete(metaPages).where(eq(metaPages.page_id, pageId))
}
