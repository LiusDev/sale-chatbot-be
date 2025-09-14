import { Context } from "hono"
import { AppContext } from "../../types/env"
import { SearchAndPaginationSchema } from "../../utils/commonValidationSchema"
import { db } from "../../libs/db"
import {
	enhanceImagesWithPresignedUrls,
	generateMultiplePresignedUrls,
} from "../../libs/r2"
import {
	products as productsTable,
	productGroups as productGroupsTable,
	productImages as productImagesTable,
} from "../../libs/schema"
import { eq, and, or, like, asc, desc, sql, inArray } from "drizzle-orm"
import {
	CreateProductGroupBodySchema,
	CreateProductBodySchema,
	ProductGroupParamSchema,
	ProductParamSchema,
	UpdateProductGroupBodySchema,
	UpdateProductBodySchema,
} from "./products.schema"

export const getProductGroups = async (
	c: Context<AppContext>,
	{ page = 1, limit = 10 }: SearchAndPaginationSchema
) => {
	try {
		const productGroups = await db(c.env)
			.select({
				id: productGroupsTable.id,
				name: productGroupsTable.name,
				description: productGroupsTable.description,
				productCount: sql<number>`COUNT(${productsTable.id})`.as(
					"productCount"
				),
			})
			.from(productGroupsTable)
			.leftJoin(
				productsTable,
				eq(productGroupsTable.id, productsTable.product_group_id)
			)
			.groupBy(productGroupsTable.id)
			.orderBy(asc(productGroupsTable.id))
			.limit(limit)
			.offset((page - 1) * limit)
		return productGroups
	} catch (error) {
		console.error(error)
		return null
	}
}

export const createProductGroup = async (
	c: Context<AppContext>,
	{ name, description }: CreateProductGroupBodySchema
) => {
	try {
		const productGroup = await db(c.env)
			.insert(productGroupsTable)
			.values({ name, description })
		return productGroup
	} catch (error) {
		console.error(error)
		return null
	}
}

export const updateProductGroup = async (
	c: Context<AppContext>,
	{
		groupId,
		name,
		description,
	}: ProductGroupParamSchema & UpdateProductGroupBodySchema
) => {
	try {
		// Build update object with only provided fields
		const updateData: Partial<{ name: string; description: string }> = {}

		if (name !== undefined) {
			updateData.name = name
		}

		if (description !== undefined) {
			updateData.description = description
		}

		// update partial
		const productGroup = await db(c.env)
			.update(productGroupsTable)
			.set(updateData)
			.where(eq(productGroupsTable.id, groupId))
		return productGroup
	} catch (error) {
		console.error(error)
		return null
	}
}

export const deleteProductGroup = async (
	c: Context<AppContext>,
	{ groupId }: ProductGroupParamSchema
) => {
	try {
		// check if product group has products
		const products = await db(c.env)
			.select()
			.from(productsTable)
			.where(eq(productsTable.product_group_id, groupId))
		if (products.length > 0) {
			throw new Error("Product group has products")
		}
		// delete product group
		const productGroup = await db(c.env)
			.delete(productGroupsTable)
			.where(eq(productGroupsTable.id, groupId))
		return productGroup
	} catch (error) {
		console.error(error)
		return null
	}
}

export const getProductsByGroupId = async (
	c: Context<AppContext>,
	{
		groupId,
		keyword,
		sort,
		order,
		page = 1,
		limit = 10,
	}: SearchAndPaginationSchema & { groupId: number }
) => {
	try {
		// Build where conditions
		const whereConditions = [eq(productsTable.product_group_id, groupId)]

		// Add keyword search for both name and description if provided
		if (keyword && keyword.trim()) {
			const searchTerm = `%${keyword.trim()}%`
			whereConditions.push(
				or(
					// Use LIKE instead of ILIKE for SQLite (Cloudflare D1)
					// SQLite LIKE is case-insensitive by default and supports Vietnamese characters
					like(productsTable.name, searchTerm),
					like(productsTable.description, searchTerm)
				)!
			)
		}

		// Build order by clause
		let orderByClause
		if (sort) {
			switch (sort) {
				case "id":
					orderByClause =
						order === "desc"
							? desc(productsTable.id)
							: asc(productsTable.id)
					break
				case "name":
					orderByClause =
						order === "desc"
							? desc(productsTable.name)
							: asc(productsTable.name)
					break
				case "description":
					orderByClause =
						order === "desc"
							? desc(productsTable.description)
							: asc(productsTable.description)
					break
				case "price":
					orderByClause =
						order === "desc"
							? desc(productsTable.price)
							: asc(productsTable.price)
					break
				case "product_group_id":
					orderByClause =
						order === "desc"
							? desc(productsTable.product_group_id)
							: asc(productsTable.product_group_id)
					break
				default:
					orderByClause = asc(productsTable.id)
			}
		} else {
			// Default sort by id ascending
			orderByClause = asc(productsTable.id)
		}

		// Execute query
		const products = await db(c.env)
			.select()
			.from(productsTable)
			.where(and(...whereConditions))
			.orderBy(orderByClause)
			.limit(limit)
			.offset((page - 1) * limit)

		// If no products found, return empty array
		if (!products.length) {
			return []
		}

		// Get images for all products
		const productIds = products.map((p) => p.id)
		const allImages = await db(c.env)
			.select({
				productId: productImagesTable.product_id,
				url: productImagesTable.image_url,
				altText: productImagesTable.alt_text,
				index: productImagesTable.index,
			})
			.from(productImagesTable)
			.where(inArray(productImagesTable.product_id, productIds))
			.orderBy(
				asc(productImagesTable.product_id),
				asc(productImagesTable.index)
			)

		// Group images by product ID
		const imagesByProduct = allImages.reduce((acc, img) => {
			if (img.productId) {
				if (!acc[img.productId]) {
					acc[img.productId] = []
				}
				acc[img.productId].push({
					url: img.url,
					altText: img.altText || "",
					index: img.index,
				})
			}
			return acc
		}, {} as Record<number, Array<{ url: string; altText: string; index: number }>>)

		// Generate presigned URLs for all images at once
		const allImageUrls = allImages.map((img) => img.url)
		const presignedUrls =
			allImageUrls.length > 0
				? await generateMultiplePresignedUrls(c, allImageUrls)
				: []

		// Map presigned URLs back to images
		let urlIndex = 0
		const imagesByProductWithPresigned = Object.keys(
			imagesByProduct
		).reduce((acc, productId) => {
			const productImages = imagesByProduct[parseInt(productId)]
			acc[parseInt(productId)] = productImages.map((img) => ({
				...img,
				presignedUrl: presignedUrls[urlIndex++] || img.url,
			}))
			return acc
		}, {} as Record<number, Array<{ url: string; altText: string; index: number; presignedUrl: string }>>)

		// Combine products with their images
		const productsWithImages = products.map((product) => ({
			...product,
			imageUrls: imagesByProductWithPresigned[product.id] || [],
		}))

		return productsWithImages
	} catch (error) {
		console.error(error)
		return null
	}
}

export const getProductByGroupIdAndProductId = async (
	c: Context<AppContext>,
	{ groupId, productId }: ProductGroupParamSchema & ProductParamSchema
) => {
	try {
		// First, get the product details
		const productResult = await db(c.env)
			.select({
				id: productsTable.id,
				name: productsTable.name,
				description: productsTable.description,
				price: productsTable.price,
				metadata: productsTable.metadata,
				product_group_id: productsTable.product_group_id,
			})
			.from(productsTable)
			.where(
				and(
					eq(productsTable.product_group_id, groupId),
					eq(productsTable.id, productId)
				)
			)
			.limit(1)

		if (!productResult || productResult.length === 0) {
			return null
		}

		const product = productResult[0]

		// Then, get all images for this product, sorted by index to preserve order
		const images = await db(c.env)
			.select({
				url: productImagesTable.image_url,
				altText: productImagesTable.alt_text,
				index: productImagesTable.index,
			})
			.from(productImagesTable)
			.where(eq(productImagesTable.product_id, productId))
			.orderBy(asc(productImagesTable.index))

		// Enhance images with presigned URLs
		const imagesWithPresignedUrls = await enhanceImagesWithPresignedUrls(
			c,
			images.map((img) => ({
				url: img.url,
				altText: img.altText || "",
				index: img.index,
			}))
		)

		// Combine product details with images array
		return {
			...product,
			imageUrls: imagesWithPresignedUrls,
		}
	} catch (error) {
		console.error("Error getting product by groupId and productId:", error)
		return null
	}
}

export const createProduct = async (
	c: Context<AppContext>,
	{
		groupId,
		name,
		description,
		price,
		metadata,
		images,
	}: {
		groupId: number
		name: string
		description?: string
		price: number
		metadata?: string
		images: string[]
	}
) => {
	try {
		// Start a transaction to create product and associated images
		const dbConnection = db(c.env)

		// First, create the product
		const productResult = await dbConnection
			.insert(productsTable)
			.values({
				name,
				description: description || "",
				price,
				metadata: metadata || "",
				product_group_id: groupId,
			})
			.returning({
				id: productsTable.id,
				name: productsTable.name,
				description: productsTable.description,
				price: productsTable.price,
				metadata: productsTable.metadata,
				product_group_id: productsTable.product_group_id,
			})

		if (!productResult || productResult.length === 0) {
			throw new Error("Failed to create product")
		}

		const product = productResult[0]

		// If images are provided, insert them into the product_images table
		if (images && images.length > 0) {
			const imageInsertValues = images.map((imageUrl, index) => ({
				product_id: product.id,
				image_url: imageUrl,
				alt_text: `${product.name} image`,
				index: index,
			}))

			await dbConnection
				.insert(productImagesTable)
				.values(imageInsertValues)
		}

		// Generate presigned URLs for the uploaded images
		const presignedUrls =
			images && images.length > 0
				? await generateMultiplePresignedUrls(c, images)
				: []

		// Return the created product with presigned URLs
		return {
			...product,
			imageUrls:
				images?.map((url, index) => ({
					url,
					altText: `${product.name} image ${index + 1}`,
					index,
					presignedUrl: presignedUrls[index] || url,
				})) || [],
		}
	} catch (error) {
		console.error("Error creating product:", error)
		return null
	}
}

export const updateProduct = async (
	c: Context<AppContext>,
	{
		groupId,
		productId,
		name,
		description,
		price,
		metadata,
		images,
	}: {
		groupId: number
		productId: number
		name?: string
		description?: string
		price?: number
		metadata?: string
		images?: string[]
	}
) => {
	try {
		const dbConnection = db(c.env)

		// Check if product exists and belongs to the group
		const existingProduct = await dbConnection
			.select()
			.from(productsTable)
			.where(
				and(
					eq(productsTable.id, productId),
					eq(productsTable.product_group_id, groupId)
				)
			)
			.limit(1)

		if (!existingProduct || existingProduct.length === 0) {
			throw new Error("Product not found or doesn't belong to this group")
		}

		// Build update object with only provided fields
		const updateData: Partial<{
			name: string
			description: string
			price: number
			metadata: string
		}> = {}

		if (name !== undefined) updateData.name = name
		if (description !== undefined) updateData.description = description
		if (price !== undefined) updateData.price = price
		if (metadata !== undefined) updateData.metadata = metadata

		// Update product if there are fields to update
		if (Object.keys(updateData).length > 0) {
			await dbConnection
				.update(productsTable)
				.set(updateData)
				.where(eq(productsTable.id, productId))
		}

		// Handle images update if provided
		if (images !== undefined) {
			// Delete existing images
			await dbConnection
				.delete(productImagesTable)
				.where(eq(productImagesTable.product_id, productId))

			// Insert new images if any
			if (images.length > 0) {
				const imageInsertValues = images.map((imageUrl, index) => ({
					product_id: productId,
					image_url: imageUrl,
					alt_text: `${
						updateData.name || existingProduct[0].name
					} image ${index + 1}`,
					index: index,
				}))

				await dbConnection
					.insert(productImagesTable)
					.values(imageInsertValues)
			}
		}

		// Return updated product with images and presigned URLs
		const updatedProduct = await dbConnection
			.select()
			.from(productsTable)
			.where(eq(productsTable.id, productId))
			.limit(1)

		// Get updated images if they were changed
		if (images !== undefined) {
			const productImages = await dbConnection
				.select({
					url: productImagesTable.image_url,
					altText: productImagesTable.alt_text,
					index: productImagesTable.index,
				})
				.from(productImagesTable)
				.where(eq(productImagesTable.product_id, productId))
				.orderBy(asc(productImagesTable.index))

			// Generate presigned URLs for images
			const imageUrls = productImages.map((img) => img.url)
			const presignedUrls =
				imageUrls.length > 0
					? await generateMultiplePresignedUrls(c, imageUrls)
					: []

			return {
				...updatedProduct[0],
				imageUrls: productImages.map((img, index) => ({
					...img,
					presignedUrl: presignedUrls[index] || img.url,
				})),
			}
		}

		return updatedProduct[0]
	} catch (error) {
		console.error("Error updating product:", error)
		return null
	}
}

export const deleteProduct = async (
	c: Context<AppContext>,
	{ groupId, productId }: { groupId: number; productId: number }
) => {
	try {
		const dbConnection = db(c.env)

		// Check if product exists and belongs to the group
		const existingProduct = await dbConnection
			.select()
			.from(productsTable)
			.where(
				and(
					eq(productsTable.id, productId),
					eq(productsTable.product_group_id, groupId)
				)
			)
			.limit(1)

		if (!existingProduct || existingProduct.length === 0) {
			throw new Error("Product not found or doesn't belong to this group")
		}

		// Delete product images first (foreign key constraint)
		await dbConnection
			.delete(productImagesTable)
			.where(eq(productImagesTable.product_id, productId))

		// Delete the product
		const result = await dbConnection
			.delete(productsTable)
			.where(eq(productsTable.id, productId))

		return { success: true, deletedProduct: existingProduct[0] }
	} catch (error) {
		console.error("Error deleting product:", error)
		return null
	}
}
