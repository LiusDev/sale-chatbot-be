import { Context } from "hono"
import { AppContext } from "../types/env"
import {
	convertToModelMessages,
	generateText,
	stepCountIs,
	streamText,
	tool,
	UIMessage,
} from "ai"
import { z } from "zod"
import { searchSimilarProducts } from "./vectorize"
import { db } from "./db"
import {
	products as productsTable,
	productGroups as productGroupsTable,
	productImages as productImagesTable,
} from "./schema"
import { eq, inArray, like, or, and, sql } from "drizzle-orm"
import { AIModel } from "../types/ai"
import { createOpenAI } from "@ai-sdk/openai"
import { generateMultiplePresignedUrls } from "./r2"

// Create Workers AI provider instance
export function createAIProvider(c: Context<AppContext>) {
	return createOpenAI({
		baseURL: c.env.OPENAI_URL,
		apiKey: c.env.OPENAI_KEY,
	})
}

// Convert temperature from 0-100 to 0.0-1.0
export function normalizeTemperature(temp: number): number {
	return Math.max(0, Math.min(1, temp / 100))
}

// Create enhanced system prompt for Agentic RAG
function createAgenticSystemPrompt(basePrompt: string): string {
	let enhancedPrompt = basePrompt
	// Emphasize tool selection policy: prefer semantic search first
	enhancedPrompt += `

CHIẾN LƯỢC CHỌN CÔNG CỤ (RẤT QUAN TRỌNG):
1) ƯU TIÊN semanticSearchTool trước trong các trường hợp sau:
- Câu hỏi mô tả tự nhiên, không có con số/điều kiện rõ ràng
- Yêu cầu gợi ý, so sánh tổng quát ("loại nào tốt", "phù hợp để…")
- Người dùng chưa biết chính xác tên sản phẩm

2) Chỉ dùng sqlQueryTool khi người dùng nêu rõ điều kiện có cấu trúc:
- Khoảng giá (từ X đến Y), giá chính xác (giá = X), so sánh giá (<, >)
- Lọc theo metadata cụ thể (key/value), tên sản phẩm chính xác/chuỗi con
- Cần sắp xếp/giới hạn có cấu trúc theo tiêu chí rõ ràng

3) Khi phân vân: hãy thử semanticSearchTool trước; nếu không có kết quả phù hợp, chuyển sang sqlQueryTool.

4) Khi đã có sản phẩm cụ thể cần chi tiết ảnh/mô tả: dùng productDetailsTool.

5) Tuyệt đối không đề cập đến công cụ nào đã dùng trong câu trả lời.`
	return enhancedPrompt
}

// Helper function to presign product image URLs
async function presignProductImages(c: Context<AppContext>, products: any[]) {
	try {
		// Extract R2 keys from image URLs and collect them
		const allImageKeys: string[] = []
		const imageKeyMap: Record<string, string> = {} // Maps image_url to R2 key

		products.forEach((product) => {
			if (product.images && Array.isArray(product.images)) {
				product.images.forEach((image: any) => {
					if (image.url) {
						// Extract R2 key from URL (assuming URL format: https://domain.com/key or just the key)
						const r2Key = image.url.split("/").pop() || image.url
						allImageKeys.push(r2Key)
						imageKeyMap[image.url] = r2Key
					}
				})
			}
		})

		// Generate presigned URLs for all images at once
		const presignedUrls =
			allImageKeys.length > 0
				? await generateMultiplePresignedUrls(c, allImageKeys)
				: {}

		// Update products with presigned URLs
		return products.map((product) => {
			if (product.images && Array.isArray(product.images)) {
				const updatedImages = product.images.map((image: any) => {
					const r2Key = imageKeyMap[image.url]
					return {
						...image,
						presigned_url:
							(presignedUrls as any)[r2Key] || image.url, // fallback to original URL
					}
				})
				return {
					...product,
					images: updatedImages,
				}
			}
			return product
		})
	} catch (error) {
		console.error("Error presigning product images:", error)
		// Return products without presigned URLs if presigning fails
		return products
	}
}

// Shared function to create tools for an agent
function createAgentTools(c: Context<AppContext>, groupId: number) {
	return {
		semanticSearchTool: createSemanticSearchTool(c, groupId),
		sqlQueryTool: createSQLQueryTool(c, groupId),
		productDetailsTool: createProductDetailsTool(c, groupId),
	}
}

// Shared function to prepare AI configuration
async function prepareAIConfig(
	c: Context<AppContext>,
	{
		systemPrompt,
		knowledgeSourceGroupId,
		groupId,
	}: {
		systemPrompt: string
		knowledgeSourceGroupId?: number
		groupId: number | null
	}
) {
	// Get knowledge source name if provided
	let knowledgeSourceName: string | undefined
	if (knowledgeSourceGroupId) {
		const groupInfo = await db(c.env)
			.select()
			.from(productGroupsTable)
			.where(eq(productGroupsTable.id, knowledgeSourceGroupId))
			.limit(1)

		if (groupInfo.length > 0) {
			knowledgeSourceName = groupInfo[0].name
		}
	}

	// Create enhanced system prompt
	const enhancedPrompt = createAgenticSystemPrompt(systemPrompt)

	// Create tools
	const tools = groupId ? createAgentTools(c, groupId) : {}

	// Create AI provider
	const aiProvider = createAIProvider(c)

	return {
		enhancedPrompt,
		tools,
		aiProvider,
	}
}

// Tool 1: Structured Query Tool with predefined Drizzle ORM queries
export const createSQLQueryTool = (c: Context<AppContext>, groupId: number) =>
	tool({
		description:
			"Tìm kiếm sản phẩm bằng các truy vấn có cấu trúc với Drizzle ORM. SỬ DỤNG KHI: người dùng hỏi về giá cả cụ thể, khoảng giá, hoặc lọc theo tiêu chí rõ ràng.",
		inputSchema: z.object({
			queryType: z
				.enum([
					"price_range",
					"exact_price",
					"product_name",
					"group_products",
					"price_comparison",
					"metadata_filter",
				])
				.describe("Loại truy vấn cần thực hiện"),
			parameters: z
				.object({
					minPrice: z.number().optional().describe("Giá tối thiểu"),
					maxPrice: z.number().optional().describe("Giá tối đa"),
					exactPrice: z.number().optional().describe("Giá chính xác"),
					productName: z
						.string()
						.optional()
						.describe("Tên sản phẩm (có thể là một phần)"),
					metadataKey: z
						.string()
						.optional()
						.describe("Key của metadata"),
					metadataValue: z
						.string()
						.optional()
						.describe("Value của metadata"),
					limit: z
						.number()
						.default(10)
						.describe("Số lượng kết quả tối đa"),
				})
				.describe("Tham số cho truy vấn"),
			reasoning: z
				.string()
				.describe("Giải thích tại sao chọn loại truy vấn này"),
		}),
		execute: async ({
			queryType,
			parameters,
			reasoning,
		}: {
			queryType: string
			parameters: any
			reasoning: string
		}) => {
			try {
				console.log(`🔍 Structured Query Tool - Type: ${queryType}`)
				console.log(
					`🔍 Structured Query Tool - Reasoning: ${reasoning}`
				)
				console.log(
					`🔍 Structured Query Tool - Parameters:`,
					parameters
				)

				let queryBuilder = db(c.env)
					.select({
						id: productsTable.id,
						name: productsTable.name,
						description: productsTable.description,
						price: productsTable.price,
						metadata: productsTable.metadata,
						product_group_id: productsTable.product_group_id,
					})
					.from(productsTable) as any

				// Apply filters based on query type
				const conditions = []

				switch (queryType) {
					case "price_range":
						if (parameters.minPrice !== undefined) {
							conditions.push(
								sql`${productsTable.price} >= ${parameters.minPrice}`
							)
						}
						if (parameters.maxPrice !== undefined) {
							conditions.push(
								sql`${productsTable.price} <= ${parameters.maxPrice}`
							)
						}
						break

					case "exact_price":
						if (parameters.exactPrice !== undefined) {
							conditions.push(
								eq(productsTable.price, parameters.exactPrice)
							)
						}
						break

					case "product_name":
						if (parameters.productName) {
							conditions.push(
								like(
									productsTable.name,
									`%${parameters.productName}%`
								)
							)
						}
						break

					case "price_comparison":
						// For queries like "products cheaper than X" or "products more expensive than Y"
						if (parameters.maxPrice !== undefined) {
							conditions.push(
								sql`${productsTable.price} < ${parameters.maxPrice}`
							)
						}
						if (parameters.minPrice !== undefined) {
							conditions.push(
								sql`${productsTable.price} > ${parameters.minPrice}`
							)
						}
						break

					case "metadata_filter":
						if (
							parameters.metadataKey &&
							parameters.metadataValue
						) {
							conditions.push(
								like(
									productsTable.metadata,
									`%"${parameters.metadataKey}"%"${parameters.metadataValue}"%`
								)
							)
						}
						break

					default:
						return {
							success: false,
							error: `Unsupported query type: ${queryType}`,
							reasoning,
						}
				}

				conditions.push(eq(productsTable.product_group_id, groupId))

				// Apply conditions if any
				if (conditions.length > 0) {
					queryBuilder = queryBuilder.where(and(...conditions))
				}

				// Apply limit
				queryBuilder = queryBuilder.limit(parameters.limit || 10)

				// Execute query
				const results = await queryBuilder

				// Get images for products if any found
				let productsWithImages = results
				if (results.length > 0) {
					const productIds = results.map((p: any) => p.id)
					const productImages = await db(c.env)
						.select({
							productId: productImagesTable.product_id,
							imageUrl: productImagesTable.image_url,
							altText: productImagesTable.alt_text,
							index: productImagesTable.index,
						})
						.from(productImagesTable)
						.where(
							inArray(productImagesTable.product_id, productIds)
						)

					productsWithImages = results.map((product: any) => ({
						...product,
						images: productImages
							.filter((img) => img.productId === product.id)
							.sort((a, b) => a.index - b.index)
							.map((img) => ({
								url: img.imageUrl,
								altText: img.altText,
								index: img.index,
							})),
					}))

					// Presign all product image URLs
					productsWithImages = await presignProductImages(
						c,
						productsWithImages
					)
				}

				return {
					success: true,
					data: productsWithImages,
					count: productsWithImages.length,
					queryType,
					parameters,
					reasoning,
				}
			} catch (error) {
				console.error("Structured Query Tool Error:", error)
				return {
					success: false,
					error: `Query execution failed: ${error}`,
					reasoning,
					queryType,
					parameters,
				}
			}
		},
	})

// Tool 2: Semantic Search Tool for natural language queries
export const createSemanticSearchTool = (
	c: Context<AppContext>,
	groupId: number
) =>
	tool({
		description:
			"Tìm kiếm sản phẩm bằng mô tả tự nhiên và độ tương đồng ngữ nghĩa. SỬ DỤNG KHI: người dùng mô tả sản phẩm bằng ngôn ngữ tự nhiên, yêu cầu gợi ý, hoặc dùng từ ngữ mô tả.",
		inputSchema: z.object({
			query: z
				.string()
				.describe(
					"Natural language search query describing the products"
				),
			topK: z
				.number()
				.default(5)
				.describe("Number of most similar products to return"),
			groupId: z
				.number()
				.optional()
				.describe("Filter by specific product group ID"),
			priceRange: z
				.object({
					min: z.number().optional(),
					max: z.number().optional(),
				})
				.optional()
				.describe("Filter by price range"),
			reasoning: z
				.string()
				.describe(
					"Explain why you chose semantic search for this query"
				),
		}),
		execute: async ({
			query,
			topK,
			priceRange,
			reasoning,
		}: {
			query: string
			topK: number
			priceRange?: { min?: number; max?: number }
			reasoning: string
		}) => {
			try {
				console.log(`🔍 Semantic Search Tool - Reasoning: ${reasoning}`)
				console.log(`🔍 Semantic Search Tool - Query: ${query}`)

				// Use vectorize search
				const vectorResults = await searchSimilarProducts(c, query, {
					topK,
					groupId,
					priceRange,
				})

				if (vectorResults.length === 0) {
					return {
						success: true,
						data: [],
						count: 0,
						reasoning,
						message: "No similar products found for this query",
					}
				}

				// Get full product details with images
				const productIds = vectorResults.map(
					(result) => result.metadata.product_id
				)
				const products = await db(c.env)
					.select()
					.from(productsTable)
					.where(inArray(productsTable.id, productIds))

				// Get images for products
				const productImages = await db(c.env)
					.select({
						productId: productImagesTable.product_id,
						imageUrl: productImagesTable.image_url,
						altText: productImagesTable.alt_text,
						index: productImagesTable.index,
					})
					.from(productImagesTable)
					.where(inArray(productImagesTable.product_id, productIds))

				// Combine products with similarity scores and images
				let productsWithDetails = vectorResults
					.map((vectorResult) => {
						const product = products.find(
							(p) => p.id === vectorResult.metadata.product_id
						)
						if (!product) return null

						const images = productImages
							.filter((img) => img.productId === product.id)
							.sort((a, b) => a.index - b.index)

						return {
							...product,
							similarityScore: vectorResult.score,
							images: images.map((img) => ({
								url: img.imageUrl,
								altText: img.altText,
								index: img.index,
							})),
						}
					})
					.filter((p) => p !== null)

				// Presign all product image URLs
				productsWithDetails = await presignProductImages(
					c,
					productsWithDetails
				)

				return {
					success: true,
					data: productsWithDetails,
					count: productsWithDetails.length,
					reasoning,
					searchQuery: query,
				}
			} catch (error) {
				console.error("Semantic Search Tool Error:", error)
				return {
					success: false,
					error: `Semantic search failed: ${error}`,
					reasoning,
				}
			}
		},
	})

// Tool 3: Product Details Tool for getting specific product information
export const createProductDetailsTool = (
	c: Context<AppContext>,
	groupId: number
) =>
	tool({
		description:
			"Lấy thông tin chi tiết về sản phẩm cụ thể theo ID hoặc tên. SỬ DỤNG KHI: người dùng hỏi về sản phẩm cụ thể hoặc cần thông tin chi tiết sản phẩm.",
		inputSchema: z.object({
			productIds: z
				.array(z.number())
				.optional()
				.describe("Array of specific product IDs to get details for"),
			productNames: z
				.array(z.string())
				.optional()
				.describe("Array of product names to search for"),
			includeImages: z
				.boolean()
				.default(true)
				.describe("Whether to include product images"),
			reasoning: z
				.string()
				.describe(
					"Explain why you need these specific product details"
				),
		}),
		execute: async ({
			productIds,
			productNames,
			includeImages,
			reasoning,
		}: {
			productIds?: number[]
			productNames?: string[]
			includeImages: boolean
			reasoning: string
		}) => {
			try {
				console.log(`🔍 Product Details Tool - Reasoning: ${reasoning}`)

				let whereConditions = []

				if (productIds && productIds.length > 0) {
					whereConditions.push(inArray(productsTable.id, productIds))
				}

				if (productNames && productNames.length > 0) {
					const nameConditions = productNames.map((name: string) =>
						like(productsTable.name, `%${name}%`)
					)
					whereConditions.push(or(...nameConditions)!)
				}

				if (whereConditions.length === 0) {
					return {
						success: false,
						error: "Either productIds or productNames must be provided",
						reasoning,
					}
				}

				// Get products
				const products = await db(c.env)
					.select()
					.from(productsTable)
					.where(
						and(
							or(...whereConditions)!,
							eq(productsTable.product_group_id, groupId)
						)
					)

				if (products.length === 0) {
					return {
						success: true,
						data: [],
						count: 0,
						reasoning,
						message: "No products found matching the criteria",
					}
				}

				// Get images if requested
				let productsWithImages = products
				if (includeImages) {
					const productImagesList = await db(c.env)
						.select({
							productId: productImagesTable.product_id,
							imageUrl: productImagesTable.image_url,
							altText: productImagesTable.alt_text,
							index: productImagesTable.index,
						})
						.from(productImagesTable)
						.where(
							inArray(
								productImagesTable.product_id,
								products.map((p) => p.id)
							)
						)

					productsWithImages = products.map((product) => ({
						...product,
						images: productImagesList
							.filter((img) => img.productId === product.id)
							.sort((a, b) => a.index - b.index)
							.map((img) => ({
								url: img.imageUrl,
								altText: img.altText,
								index: img.index,
							})),
					}))

					// Presign all product image URLs
					productsWithImages = await presignProductImages(
						c,
						productsWithImages
					)
				}

				return {
					success: true,
					data: productsWithImages,
					count: productsWithImages.length,
					reasoning,
				}
			} catch (error) {
				console.error("Product Details Tool Error:", error)
				return {
					success: false,
					error: `Failed to get product details: ${error}`,
					reasoning,
				}
			}
		},
	})

// Generate Agentic RAG response with tool calling
export async function generateAIResponse(
	c: Context<AppContext>,
	{
		model,
		systemPrompt,
		messages: inputMessages = [],
		temperature = 70,
		maxTokens = 5000,
		knowledgeSourceGroupId,
		topK = 5,
		groupId,
	}: {
		model: AIModel
		systemPrompt: string
		messages: UIMessage[]
		temperature?: number
		maxTokens?: number
		knowledgeSourceGroupId?: number
		topK?: number
		groupId: number | null
	}
) {
	try {
		// Prepare AI configuration using shared function
		const { enhancedPrompt, tools, aiProvider } = await prepareAIConfig(c, {
			systemPrompt,
			knowledgeSourceGroupId,
			groupId,
		})

		// Build messages array
		const messages = [
			{ role: "system" as const, content: enhancedPrompt },
			...convertToModelMessages(inputMessages),
		]

		// Use AI SDK with provider and tools
		const result = await generateText({
			model: aiProvider.chat(model),
			messages,
			tools,
			temperature: normalizeTemperature(temperature),
			topK,
			maxOutputTokens: maxTokens,
			stopWhen: stepCountIs(10),
		})

		return result
	} catch (error) {
		console.error("AI Generation Error:", error)
		return {
			success: false,
			error: `AI generation failed: ${error}`,
		}
	}
}

// Stream Agentic RAG response with tool calling
export async function streamAIResponse(
	c: Context<AppContext>,
	{
		model,
		systemPrompt,
		messages: inputMessages = [],
		temperature = 70,
		maxTokens = 5000,
		knowledgeSourceGroupId,
		topK = 5,
		groupId,
	}: {
		model: AIModel
		systemPrompt: string
		messages: UIMessage[]
		temperature?: number
		maxTokens?: number
		knowledgeSourceGroupId?: number
		topK?: number
		groupId: number | null
	}
) {
	try {
		// Prepare AI configuration using shared function
		const { enhancedPrompt, tools, aiProvider } = await prepareAIConfig(c, {
			systemPrompt,
			knowledgeSourceGroupId,
			groupId,
		})

		// Build messages array
		const messages = [
			{ role: "system" as const, content: enhancedPrompt },
			...convertToModelMessages(inputMessages),
		]

		// Use AI SDK streaming with provider and tools
		const result = streamText({
			model: aiProvider.chat(model),
			messages,
			tools,
			toolChoice: "auto",
			temperature: normalizeTemperature(temperature),
			topK,
			maxOutputTokens: maxTokens,
			stopWhen: stepCountIs(10),
		})

		return result
	} catch (error) {
		console.error("AI Streaming Error:", error)
		throw new Error(`AI streaming failed: ${error}`)
	}
}
