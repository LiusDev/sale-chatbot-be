import { AppContext } from "../../types/env"
import { Hono } from "hono"
import { listResponse, response } from "../../utils/response"
import { error } from "../../utils/error"
import { searchAndPaginationSchema } from "../../utils/commonValidationSchema"
import { zValidator } from "@hono/zod-validator"
import {
	createProductGroupBodySchema,
	createProductBodySchema,
	productGroupParamSchema,
	productParamSchema,
	updateProductGroupBodySchema,
	updateProductBodySchema,
} from "./products.schema"
import {
	createProduct,
	createProductGroup,
	deleteProduct,
	deleteProductGroup,
	getProductByGroupIdAndProductId,
	getProductGroups,
	getProductsByGroupId,
	updateProduct,
	updateProductGroup,
} from "./products.repo"
import { authMiddleware } from "../../middlewares"
import { uploadImages, cleanupOldImages } from "../../libs/r2"
import status from "http-status"

const products = new Hono<AppContext>()

products.use(authMiddleware)

// Get product groups
products.get("/", zValidator("query", searchAndPaginationSchema), async (c) => {
	try {
		const { page, limit } = c.req.valid("query")
		const result = await getProductGroups(c, { page, limit })
		if (!result) {
			return error(c, {
				message: "Failed to get product groups",
				status: 500,
			})
		}
		return listResponse(c, result.data, {
			total: result.total,
			page,
			limit,
		})
	} catch (err: any) {
		console.error("Error in GET /products:", err.message)
		return error(c, {
			message: `Failed to get product groups: ${err.message}`,
			status: 500,
		})
	}
})

// Create product group
products.post(
	"/",
	zValidator("json", createProductGroupBodySchema),
	async (c) => {
		try {
			const { name, description } = c.req.valid("json")
			const productGroup = await createProductGroup(c, {
				name,
				description,
			})
			return response(c, productGroup)
		} catch (err: any) {
			console.error("Error in POST /products:", err.message)
			return error(c, {
				message: `Failed to create product group: ${err.message}`,
				status: 500,
			})
		}
	}
)

// Update product group
products.put(
	"/:groupId",
	zValidator("param", productGroupParamSchema),
	zValidator("json", updateProductGroupBodySchema),
	async (c) => {
		try {
			const { groupId } = c.req.valid("param")
			const { name, description } = c.req.valid("json")
			const productGroup = await updateProductGroup(c, {
				groupId,
				name,
				description,
			})
			return response(c, productGroup)
		} catch (err: any) {
			console.error("Error in PUT /products/:id:", err.message)
			return error(c, {
				message: `Failed to update product group: ${err.message}`,
				status: 500,
			})
		}
	}
)

// Delete product group
products.delete(
	"/:groupId",
	zValidator("param", productGroupParamSchema),
	async (c) => {
		try {
			const { groupId } = c.req.valid("param")
			await deleteProductGroup(c, { groupId })
			return response(c, undefined, status.NO_CONTENT)
		} catch (err: any) {
			console.error("Error in DELETE /products/:id:", err.message)
			return error(c, {
				message: `Failed to delete product group: ${err.message}`,
				status: 500,
			})
		}
	}
)

// Get products by group id
products.get(
	"/:groupId",
	zValidator("param", productGroupParamSchema),
	zValidator("query", searchAndPaginationSchema),
	async (c) => {
		try {
			const groupId = c.req.valid("param").groupId
			const { keyword, sort, order, page, limit } = c.req.valid("query")
			const result = await getProductsByGroupId(c, {
				groupId,
				keyword,
				sort,
				order,
				page,
				limit,
			})
			if (!result) {
				return error(c, {
					message: "Failed to get products by group",
					status: 500,
				})
			}
			return listResponse(c, result.data, {
				total: result.total,
				page,
				limit,
			})
		} catch (err: any) {
			console.error("Error in GET /products/:groupId:", err.message)
			return error(c, {
				message: `Failed to get products by group: ${err.message}`,
				status: 500,
			})
		}
	}
)

// Get product by group id and product id
products.get(
	"/:groupId/:productId",
	zValidator(
		"param",
		productGroupParamSchema.extend(productParamSchema.shape)
	),
	async (c) => {
		try {
			const { groupId, productId } = c.req.valid("param")
			const product = await getProductByGroupIdAndProductId(c, {
				groupId,
				productId,
			})
			if (!product) {
				return error(c, {
					message: "Product not found",
					status: 404,
				})
			}
			return response(c, product)
		} catch (err: any) {
			console.error(
				"Error in GET /products/:groupId/:productId:",
				err.message
			)
			return error(c, {
				message: `Failed to get product: ${err.message}`,
				status: 500,
			})
		}
	}
)

// Create product
products.post(
	"/:groupId",
	zValidator("param", productGroupParamSchema),
	zValidator("json", createProductBodySchema),
	async (c) => {
		try {
			const { groupId } = c.req.valid("param")
			const {
				name,
				description,
				price,
				metadata,
				images: rawImages,
			} = c.req.valid("json")

			const uploadedImageUrls =
				rawImages && rawImages.length > 0
					? (await uploadImages(c, rawImages)).map(
							(img) => img.secure_url
					  )
					: []

			const product = await createProduct(c, {
				groupId,
				name,
				description,
				price,
				metadata,
				images: uploadedImageUrls,
			})

			if (!product) {
				return error(c, {
					message: "Failed to create product",
					status: 500,
				})
			}

			return response(c, product)
		} catch (err: any) {
			console.error("Error in POST /products/:groupId:", err.message)
			return error(c, {
				message: `Failed to create product: ${err.message}`,
				status: 500,
			})
		}
	}
)

// Update product
products.put(
	"/:groupId/:productId",
	zValidator(
		"param",
		productGroupParamSchema.extend(productParamSchema.shape)
	),
	zValidator("json", updateProductBodySchema),
	async (c) => {
		try {
			const { groupId, productId } = c.req.valid("param")
			const {
				name,
				description,
				price,
				metadata,
				images: rawImages,
			} = c.req.valid("json")

			// Process images if provided - separate existing vs new
			let processedImages:
				| { existingImages: string[]; newImages: string[] }
				| undefined

			if (rawImages && rawImages.length > 0) {
				const existingImages: string[] = []
				const newImages: {
					url: string
					altText?: string
					index: number
				}[] = []

				// Separate existing images (to keep) from new images (to upload)
				rawImages.forEach((img) => {
					if (img.isExisting) {
						// This is an existing image URL to keep
						existingImages.push(img.url)
					} else {
						// This is a new base64 image to upload
						newImages.push({
							url: img.url,
							altText: img.altText,
							index: img.index,
						})
					}
				})

				// Upload new images if any
				const uploadedNewImages =
					newImages.length > 0
						? (await uploadImages(c, newImages)).map(
								(img) => img.secure_url
						  )
						: []

				// Combine existing URLs with newly uploaded URLs, maintaining order
				const allImageUrls: string[] = []
				let newImageIndex = 0

				rawImages.forEach((img) => {
					if (img.isExisting) {
						allImageUrls.push(img.url) // Keep existing
					} else {
						allImageUrls.push(uploadedNewImages[newImageIndex++]) // Add new
					}
				})

				processedImages = {
					existingImages,
					newImages: allImageUrls,
				}
			}

			const product = await updateProduct(c, {
				groupId,
				productId,
				name,
				description,
				price,
				metadata,
				images: processedImages?.newImages,
				imagesToKeep: processedImages?.existingImages,
			})

			if (!product) {
				return error(c, {
					message: "Failed to update product or product not found",
					status: 404,
				})
			}

			return response(c, product)
		} catch (err: any) {
			console.error("Error in PUT /products/:groupId/:productId:", err)
			return error(c, {
				message: `Failed to update product: ${err.message}`,
				status: 500,
			})
		}
	}
)

// Delete product
products.delete(
	"/:groupId/:productId",
	zValidator(
		"param",
		productGroupParamSchema.extend(productParamSchema.shape)
	),
	async (c) => {
		try {
			const { groupId, productId } = c.req.valid("param")

			const result = await deleteProduct(c, {
				groupId,
				productId,
			})

			if (!result) {
				return error(c, {
					message: "Failed to delete product or product not found",
					status: 404,
				})
			}

			return response(c, result)
		} catch (err: any) {
			console.error(
				"Error in DELETE /products/:groupId/:productId:",
				err.message
			)
			return error(c, {
				message: `Failed to delete product: ${err.message}`,
				status: 500,
			})
		}
	}
)

export default products
