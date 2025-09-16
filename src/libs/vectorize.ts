import { Context } from "hono"
import { AppContext } from "../types/env"

// Type definitions for Vectorize operations
export interface VectorizeMetadata {
	group_id: number
	product_id: number
	price: number
}

export interface VectorRecord {
	id: string
	values: number[]
	metadata: Record<string, number>
}

export interface EmbeddingRequest {
	productId: number
	groupId: number
	productName: string
	productDescription: string
	metadata: string
	price: number
}

/**
 * Parse metadata string into key-value pairs for embedding
 */
export function parseMetadataForEmbedding(metadataStr?: string): string {
	if (!metadataStr) return ""

	try {
		const metadata = JSON.parse(metadataStr)
		// Convert metadata object to readable string format
		return Object.entries(metadata)
			.map(([key, value]) => `${key}: ${value}`)
			.join(", ")
	} catch {
		// If not valid JSON, return as is
		return metadataStr
	}
}

/**
 * Generate embedding text for a product
 */
export function generateEmbeddingText(request: EmbeddingRequest): string {
	const { productName, productDescription, metadata } = request
	const parsedMetadata = parseMetadataForEmbedding(metadata)

	// Combine product information for embedding
	const parts = [productName]
	if (productDescription) {
		parts.push(productDescription)
	}
	if (parsedMetadata) {
		parts.push(parsedMetadata)
	}

	return parts.join(" ")
}

/**
 * Generate embedding using Workers AI
 */
export async function generateEmbedding(
	c: Context<AppContext>,
	text: string
): Promise<number[]> {
	try {
		const response = (await c.env.AI.run("@cf/baai/bge-m3", {
			text: [text],
		})) as any

		// BGE-M3 returns embeddings in the data array
		if (response && response.data && response.data[0]) {
			return response.data[0]
		}

		throw new Error("No embedding data returned from AI model")
	} catch (error) {
		console.error("Error generating embedding:", error)
		throw new Error(`Failed to generate embedding: ${error}`)
	}
}

/**
 * Insert or update vector in Vectorize
 */
export async function upsertVector(
	c: Context<AppContext>,
	request: EmbeddingRequest
): Promise<void> {
	try {
		// Generate embedding text
		const embeddingText = generateEmbeddingText(request)

		// Generate embedding using Workers AI
		const embedding = await generateEmbedding(c, embeddingText)

		// Create vector record
		const vectorRecord: VectorRecord = {
			id: `product_${request.productId}`,
			values: embedding,
			metadata: {
				group_id: request.groupId,
				product_id: request.productId,
				price: request.price,
			},
		}

		// Insert/update in Vectorize
		await c.env.VECTORIZE.upsert([vectorRecord])

		console.log(`✅ Vector upserted for product ${request.productId}`)
	} catch (error) {
		console.error(
			`Error upserting vector for product ${request.productId}:`,
			error
		)
		throw new Error(`Failed to upsert vector: ${error}`)
	}
}

/**
 * Delete vector from Vectorize
 */
export async function deleteVector(
	c: Context<AppContext>,
	productId: number
): Promise<void> {
	try {
		const vectorId = `product_${productId}`
		await c.env.VECTORIZE.deleteByIds([vectorId])

		console.log(`✅ Vector deleted for product ${productId}`)
	} catch (error) {
		console.error(`Error deleting vector for product ${productId}:`, error)
		throw new Error(`Failed to delete vector: ${error}`)
	}
}

/**
 * Search similar products using vector similarity
 */
export async function searchSimilarProducts(
	c: Context<AppContext>,
	queryText: string,
	options: {
		topK?: number
		groupId?: number
		priceRange?: { min?: number; max?: number }
	} = {}
): Promise<Array<{ id: string; score: number; metadata: VectorizeMetadata }>> {
	try {
		const { topK = 10, groupId, priceRange } = options

		// Generate embedding for query text
		const queryEmbedding = await generateEmbedding(c, queryText)

		// Build filter for metadata
		const filter: any = {}
		if (groupId !== undefined) {
			filter.group_id = groupId
		}
		if (priceRange?.min !== undefined) {
			filter.price = { $gte: priceRange.min }
		}
		if (priceRange?.max !== undefined) {
			if (!filter.price) filter.price = {}
			filter.price.$lte = priceRange.max
		}

		// Search in Vectorize
		const results = await c.env.VECTORIZE.query(queryEmbedding, {
			topK,
			filter: Object.keys(filter).length > 0 ? filter : undefined,
			returnMetadata: true,
		})

		console.log(`🔍 Found ${results.matches.length} similar products`)

		return results.matches.map((match: any) => ({
			id: match.id,
			score: match.score,
			metadata: match.metadata as VectorizeMetadata,
		}))
	} catch (error) {
		console.error("Error searching similar products:", error)
		throw new Error(`Failed to search similar products: ${error}`)
	}
}
