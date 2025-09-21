import { z } from "zod"

export const metaPageSchema = z
	.object({
		id: z.string().min(1, "Page ID is required"),
		name: z.string().min(1, "Page name is required"),
		accessToken: z.string().min(1, "Access token is required"),
		category: z.string().min(1, "Category is required"),
	})
	.array()
	.min(1, "At least one page is required")

export type MetaPageSchema = z.infer<typeof metaPageSchema>

export const pageIdParamSchema = z.object({
	pageId: z.string().min(1, "Page ID is required"),
})

export type PageIdParamSchema = z.infer<typeof pageIdParamSchema>

export const conversationIdParamSchema = z.object({
	conversationId: z.string().min(1, "Conversation ID is required"),
})

export type ConversationIdParamSchema = z.infer<
	typeof conversationIdParamSchema
>

export const paramsSchema = pageIdParamSchema.extend(
	conversationIdParamSchema.shape
)

export const sendMessageSchema = z.object({
	message: z.string().min(1, "Message is required"),
})
