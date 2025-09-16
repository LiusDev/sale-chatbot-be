import z from "zod"
import { AI_MODELS } from "../../types/ai"
import { UIMessage } from "ai"
import { uiMessageSchema } from "./ui-message.schema"

// Base schemas
export const aiAgentParamSchema = z.object({
	agentId: z.coerce.number(),
})
export type AIAgentParamSchema = z.infer<typeof aiAgentParamSchema>

// Create agent schema
export const createAgentBodySchema = z.object({
	name: z.string().min(1, "Agent name is required"),
	description: z.string().optional(),
	model: z.enum(AI_MODELS, { message: "Invalid AI model" }),
	systemPrompt: z.string().min(1, "System prompt is required"),
	knowledgeSourceGroupId: z.number().optional(),
	topK: z.number().min(1).max(50).default(5),
	temperature: z.number().min(0).max(100).default(70), // 0-100, converted to 0.0-1.0
	maxTokens: z.number().min(1).max(4000).default(1000),
})
export type CreateAgentBodySchema = z.infer<typeof createAgentBodySchema>

// Update agent schema
export const updateAgentBodySchema = createAgentBodySchema.partial()
export type UpdateAgentBodySchema = z.infer<typeof updateAgentBodySchema>

// Chat request schema
export const chatRequestSchema = z.object({
	stream: z.boolean().default(false),
	messages: uiMessageSchema.array(),
})
export type ChatRequestSchema = z.infer<typeof chatRequestSchema>

// Playground request schema (extends chat request with custom config override)
export const playgroundRequestSchema = chatRequestSchema.extend({
	customConfig: z
		.object({
			model: z.enum(AI_MODELS).optional(),
			systemPrompt: z.string().optional(),
			knowledgeSourceGroupId: z.number().optional(),
			topK: z.number().min(1).max(50).optional(),
			temperature: z.number().min(0).max(100).optional(),
			maxTokens: z.number().min(1).max(4000).optional(),
		})
		.optional(),
})
export type PlaygroundRequestSchema = z.infer<typeof playgroundRequestSchema>

// Chat modes
export const CHAT_MODES = ["stream", "non-stream"] as const
export type ChatMode = (typeof CHAT_MODES)[number]

// Tool types for RAG
export const TOOL_TYPES = ["sql", "semantic_search"] as const
export type ToolType = (typeof TOOL_TYPES)[number]
