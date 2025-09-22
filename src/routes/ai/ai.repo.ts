import { Context } from "hono"
import { AppContext } from "../../types/env"
import { SearchAndPaginationSchema } from "../../utils/commonValidationSchema"
import { db } from "../../libs/db"
import {
	aiAgents as aiAgentsTable,
	productGroups as productGroupsTable,
	systemUsers as systemUsersTable,
} from "../../libs/schema"
import { eq, and, like, asc, desc, sql } from "drizzle-orm"
import {
	CreateAgentBodySchema,
	UpdateAgentBodySchema,
	AIAgentParamSchema,
} from "./ai.schema"

export const getAgents = async (
	c: Context<AppContext>,
	{ page = 1, limit = 10, keyword }: SearchAndPaginationSchema
) => {
	// Build where conditions
	const whereConditions = []

	// Add keyword search for agent name and description if provided
	if (keyword && keyword.trim()) {
		const searchTerm = `%${keyword.trim()}%`
		whereConditions.push(
			sql`(${aiAgentsTable.name} LIKE ${searchTerm} OR ${aiAgentsTable.description} LIKE ${searchTerm})`
		)
	}

	// Get total count first
	const totalResult = await db(c.env)
		.select({ count: sql<number>`COUNT(*)` })
		.from(aiAgentsTable)
		.where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

	const total = totalResult[0]?.count || 0

	// Get paginated results with joins
	const agents = await db(c.env)
		.select({
			id: aiAgentsTable.id,
			name: aiAgentsTable.name,
			description: aiAgentsTable.description,
			model: aiAgentsTable.model,
			system_prompt: aiAgentsTable.system_prompt,
			knowledge_source_group_id: aiAgentsTable.knowledge_source_group_id,
			top_k: aiAgentsTable.top_k,
			temperature: aiAgentsTable.temperature,
			max_tokens: aiAgentsTable.max_tokens,
			created_by: aiAgentsTable.created_by,
			// Join with product groups
			knowledge_source_name: productGroupsTable.name,
			knowledge_source_description: productGroupsTable.description,
			// Join with users
			creator_name: systemUsersTable.name,
			creator_email: systemUsersTable.email,
		})
		.from(aiAgentsTable)
		.leftJoin(
			productGroupsTable,
			eq(aiAgentsTable.knowledge_source_group_id, productGroupsTable.id)
		)
		.leftJoin(
			systemUsersTable,
			eq(aiAgentsTable.created_by, systemUsersTable.id)
		)
		.where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
		.limit(limit)
		.offset((page - 1) * limit)

	return { data: agents, total }
}

export const getAgentById = async (
	c: Context<AppContext>,
	{ agentId }: AIAgentParamSchema
) => {
	const agentResult = await db(c.env)
		.select({
			id: aiAgentsTable.id,
			name: aiAgentsTable.name,
			description: aiAgentsTable.description,
			model: aiAgentsTable.model,
			system_prompt: aiAgentsTable.system_prompt,
			knowledge_source_group_id: aiAgentsTable.knowledge_source_group_id,
			top_k: aiAgentsTable.top_k,
			temperature: aiAgentsTable.temperature,
			max_tokens: aiAgentsTable.max_tokens,
			created_by: aiAgentsTable.created_by,
			// Join with product groups
			knowledge_source_name: productGroupsTable.name,
			knowledge_source_description: productGroupsTable.description,
			// Join with users
			creator_name: systemUsersTable.name,
			creator_email: systemUsersTable.email,
		})
		.from(aiAgentsTable)
		.leftJoin(
			productGroupsTable,
			eq(aiAgentsTable.knowledge_source_group_id, productGroupsTable.id)
		)
		.leftJoin(
			systemUsersTable,
			eq(aiAgentsTable.created_by, systemUsersTable.id)
		)
		.where(eq(aiAgentsTable.id, agentId))
		.limit(1)

	return agentResult[0] || null
}

export const createAgent = async (
	c: Context<AppContext>,
	{
		name,
		description,
		model,
		systemPrompt,
		knowledgeSourceGroupId,
		topK,
		temperature,
		maxTokens,
	}: CreateAgentBodySchema,
	createdBy: number
) => {
	// Validate knowledge source group exists if provided
	if (knowledgeSourceGroupId) {
		const groupExists = await db(c.env)
			.select({ id: productGroupsTable.id })
			.from(productGroupsTable)
			.where(eq(productGroupsTable.id, knowledgeSourceGroupId))
			.limit(1)

		if (!groupExists.length) {
			throw new Error("Knowledge source group not found")
		}
	}

	const agent = await db(c.env)
		.insert(aiAgentsTable)
		.values({
			name,
			description: description || "",
			model,
			system_prompt: systemPrompt,
			knowledge_source_group_id: knowledgeSourceGroupId,
			top_k: topK,
			temperature,
			max_tokens: maxTokens,
			created_by: createdBy,
		})
		.returning({
			id: aiAgentsTable.id,
			name: aiAgentsTable.name,
			description: aiAgentsTable.description,
			model: aiAgentsTable.model,
			system_prompt: aiAgentsTable.system_prompt,
			knowledge_source_group_id: aiAgentsTable.knowledge_source_group_id,
			top_k: aiAgentsTable.top_k,
			temperature: aiAgentsTable.temperature,
			max_tokens: aiAgentsTable.max_tokens,
			created_by: aiAgentsTable.created_by,
		})

	return agent[0]
}

export const updateAgent = async (
	c: Context<AppContext>,
	{ agentId }: AIAgentParamSchema,
	{
		name,
		description,
		model,
		systemPrompt,
		knowledgeSourceGroupId,
		topK,
		temperature,
		maxTokens,
	}: UpdateAgentBodySchema
) => {
	// Check if agent exists
	const existingAgent = await db(c.env)
		.select({ id: aiAgentsTable.id })
		.from(aiAgentsTable)
		.where(eq(aiAgentsTable.id, agentId))
		.limit(1)

	if (!existingAgent.length) {
		throw new Error("Agent not found")
	}

	// Validate knowledge source group exists if provided
	if (
		knowledgeSourceGroupId !== undefined &&
		knowledgeSourceGroupId !== null
	) {
		const groupExists = await db(c.env)
			.select({ id: productGroupsTable.id })
			.from(productGroupsTable)
			.where(eq(productGroupsTable.id, knowledgeSourceGroupId))
			.limit(1)

		if (!groupExists.length) {
			throw new Error("Knowledge source group not found")
		}
	}

	// Build update object with only provided fields
	const updateData: Partial<{
		name: string
		description: string
		model: string
		system_prompt: string
		knowledge_source_group_id: number | null
		top_k: number
		temperature: number
		max_tokens: number
		updated_at: string
	}> = {
		updated_at: new Date().toISOString(),
	}

	if (name !== undefined) updateData.name = name
	if (description !== undefined) updateData.description = description
	if (model !== undefined) updateData.model = model
	if (systemPrompt !== undefined) updateData.system_prompt = systemPrompt
	if (knowledgeSourceGroupId !== undefined)
		updateData.knowledge_source_group_id = knowledgeSourceGroupId
	if (topK !== undefined) updateData.top_k = topK
	if (temperature !== undefined) updateData.temperature = temperature
	if (maxTokens !== undefined) updateData.max_tokens = maxTokens

	const updatedAgent = await db(c.env)
		.update(aiAgentsTable)
		.set(updateData)
		.where(eq(aiAgentsTable.id, agentId))
		.returning({
			id: aiAgentsTable.id,
			name: aiAgentsTable.name,
			description: aiAgentsTable.description,
			model: aiAgentsTable.model,
			system_prompt: aiAgentsTable.system_prompt,
			knowledge_source_group_id: aiAgentsTable.knowledge_source_group_id,
			top_k: aiAgentsTable.top_k,
			temperature: aiAgentsTable.temperature,
			max_tokens: aiAgentsTable.max_tokens,
			created_by: aiAgentsTable.created_by,
		})

	return updatedAgent[0]
}

export const deleteAgent = async (
	c: Context<AppContext>,
	{ agentId }: AIAgentParamSchema
) => {
	// Check if agent exists
	const existingAgent = await db(c.env)
		.select({
			id: aiAgentsTable.id,
			name: aiAgentsTable.name,
		})
		.from(aiAgentsTable)
		.where(eq(aiAgentsTable.id, agentId))
		.limit(1)

	if (!existingAgent.length) {
		throw new Error("Agent not found")
	}

	// Delete the agent
	const deletedAgent = await db(c.env)
		.delete(aiAgentsTable)
		.where(eq(aiAgentsTable.id, agentId))
		.returning({
			id: aiAgentsTable.id,
			name: aiAgentsTable.name,
			description: aiAgentsTable.description,
			model: aiAgentsTable.model,
			system_prompt: aiAgentsTable.system_prompt,
			knowledge_source_group_id: aiAgentsTable.knowledge_source_group_id,
			top_k: aiAgentsTable.top_k,
			temperature: aiAgentsTable.temperature,
			max_tokens: aiAgentsTable.max_tokens,
			created_by: aiAgentsTable.created_by,
		})

	return { success: true, deletedAgent: deletedAgent[0] }
}
