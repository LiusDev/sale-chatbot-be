import { AppContext } from "../../types/env"
import { Hono } from "hono"
import { listResponse, response } from "../../utils/response"
import { error } from "../../utils/error"
import { searchAndPaginationSchema } from "../../utils/commonValidationSchema"
import { zValidator } from "@hono/zod-validator"
import {
	createAgentBodySchema,
	updateAgentBodySchema,
	aiAgentParamSchema,
	chatRequestSchema,
	playgroundRequestSchema,
} from "./ai.schema"
import {
	createAgent,
	updateAgent,
	deleteAgent,
	getAgents,
	getAgentById,
} from "./ai.repo"
import { authMiddleware } from "../../middlewares"
import { generateAIResponse, streamAIResponse } from "../../libs/ai"

const ai = new Hono<AppContext>()

ai.use(authMiddleware)

// List agents
ai.get("/", zValidator("query", searchAndPaginationSchema), async (c) => {
	try {
		const { page, limit, keyword } = c.req.valid("query")
		const result = await getAgents(c, { page, limit, keyword })

		if (!result) {
			return error(c, {
				message: "Failed to get agents",
				status: 500,
			})
		}

		return listResponse(c, result.data, {
			total: result.total,
			page,
			limit,
		})
	} catch (err: any) {
		console.error("Error in GET /ai:", err.message)
		return error(c, {
			message: `Failed to get agents: ${err.message}`,
			status: 500,
		})
	}
})

// Get agent by ID
ai.get("/:agentId", zValidator("param", aiAgentParamSchema), async (c) => {
	try {
		const { agentId } = c.req.valid("param")
		const agent = await getAgentById(c, { agentId })

		if (!agent) {
			return error(c, {
				message: "Agent not found",
				status: 404,
			})
		}

		return response(c, agent)
	} catch (err: any) {
		console.error("Error in GET /ai/:agentId:", err.message)
		return error(c, {
			message: `Failed to get agent: ${err.message}`,
			status: 500,
		})
	}
})

// Create agent
ai.post("/", zValidator("json", createAgentBodySchema), async (c) => {
	try {
		const {
			name,
			description,
			model,
			systemPrompt,
			knowledgeSourceGroupId,
			topK,
			temperature,
			maxTokens,
		} = c.req.valid("json")

		// Get user ID from JWT payload
		const jwtPayload = c.get("jwtPayload")
		const createdBy = jwtPayload.sub

		const agent = await createAgent(
			c,
			{
				name,
				description,
				model,
				systemPrompt,
				knowledgeSourceGroupId,
				topK,
				temperature,
				maxTokens,
			},
			createdBy
		)

		return response(c, agent)
	} catch (err: any) {
		console.error("Error in POST /ai:", err.message)
		return error(c, {
			message: `Failed to create agent: ${err.message}`,
			status: 500,
		})
	}
})

// Update agent
ai.put(
	"/:agentId",
	zValidator("param", aiAgentParamSchema),
	zValidator("json", updateAgentBodySchema),
	async (c) => {
		try {
			const { agentId } = c.req.valid("param")
			const {
				name,
				description,
				model,
				systemPrompt,
				knowledgeSourceGroupId,
				topK,
				temperature,
				maxTokens,
			} = c.req.valid("json")

			const agent = await updateAgent(
				c,
				{ agentId },
				{
					name,
					description,
					model,
					systemPrompt,
					knowledgeSourceGroupId,
					topK,
					temperature,
					maxTokens,
				}
			)

			return response(c, agent)
		} catch (err: any) {
			console.error("Error in PUT /ai/:agentId:", err.message)
			return error(c, {
				message: `Failed to update agent: ${err.message}`,
				status: 500,
			})
		}
	}
)

// Delete agent
ai.delete("/:agentId", zValidator("param", aiAgentParamSchema), async (c) => {
	try {
		const { agentId } = c.req.valid("param")
		await deleteAgent(c, { agentId })

		return response(c, undefined)
	} catch (err: any) {
		console.error("Error in DELETE /ai/:agentId:", err.message)
		return error(c, {
			message: `Failed to delete agent: ${err.message}`,
			status: 500,
		})
	}
})

// Chat with agent
ai.post(
	"/:agentId/chat",
	zValidator("param", aiAgentParamSchema),
	zValidator("json", chatRequestSchema),
	async (c) => {
		try {
			const { agentId } = c.req.valid("param")
			const { stream, messages } = c.req.valid("json")

			// Get agent configuration
			const agent = await getAgentById(c, { agentId })
			if (!agent) {
				return error(c, {
					message: "Agent not found",
					status: 404,
				})
			}

			if (stream) {
				// Stream response using AI SDK
				const aiStream = await streamAIResponse(c, {
					model: agent.model as any,
					systemPrompt: agent.system_prompt,
					messages,
					temperature: agent.temperature,
					maxTokens: agent.max_tokens,
					knowledgeSourceGroupId:
						agent.knowledge_source_group_id || undefined,
					topK: agent.top_k,
					groupId: agent.knowledge_source_group_id,
				})

				// Return the stream response using AI SDK's built-in method
				return aiStream.toUIMessageStreamResponse()
			} else {
				// Non-stream response with Agentic RAG
				const result = await generateAIResponse(c, {
					model: agent.model as any,
					systemPrompt: agent.system_prompt,
					messages,
					temperature: agent.temperature,
					maxTokens: agent.max_tokens,
					knowledgeSourceGroupId:
						agent.knowledge_source_group_id || undefined,
					topK: agent.top_k,
					groupId: agent.knowledge_source_group_id,
				})

				// Include tool calls and results in response for debugging/transparency
				return c.json(result)
			}
		} catch (err: any) {
			console.error("Error in POST /ai/:agentId/chat:", err.message)
			return error(c, {
				message: `Failed to chat with agent: ${err.message}`,
				status: 500,
			})
		}
	}
)

// Playground - chat with custom config
ai.post(
	"/:agentId/playground",
	zValidator("param", aiAgentParamSchema),
	zValidator("json", playgroundRequestSchema),
	async (c) => {
		try {
			const { agentId } = c.req.valid("param")
			const { messages, stream, customConfig } = c.req.valid("json")

			// Get agent configuration
			const agent = await getAgentById(c, { agentId })
			if (!agent) {
				return error(c, {
					message: "Agent not found",
					status: 404,
				})
			}

			// Merge agent config with custom overrides
			const config = {
				model: (customConfig?.model || agent.model) as any,
				systemPrompt: customConfig?.systemPrompt || agent.system_prompt,
				temperature: customConfig?.temperature || agent.temperature,
				maxTokens: customConfig?.maxTokens || agent.max_tokens,
				knowledgeSourceGroupId:
					customConfig?.knowledgeSourceGroupId !== undefined
						? customConfig.knowledgeSourceGroupId
						: agent.knowledge_source_group_id || undefined,
				topK: customConfig?.topK || agent.top_k,
			}

			if (stream) {
				// Stream response using AI SDK
				const aiStream = await streamAIResponse(c, {
					...config,
					messages,
					groupId: agent.knowledge_source_group_id,
				})

				// Return the stream response using AI SDK's built-in method
				return aiStream.toUIMessageStreamResponse()
			} else {
				// Non-stream response with Agentic RAG
				const result = await generateAIResponse(c, {
					...config,
					messages,
					groupId: agent.knowledge_source_group_id,
				})

				return c.json(result)
			}
		} catch (err: any) {
			console.error("Error in POST /ai/:agentId/playground:", err.message)
			return error(c, {
				message: `Failed to use playground: ${err.message}`,
				status: 500,
			})
		}
	}
)

export default ai
