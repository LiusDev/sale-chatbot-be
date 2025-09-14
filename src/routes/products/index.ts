import { AppContext } from "../../types/env"
import { Hono } from "hono"
import { response } from "../../utils/response"
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
import { uploadImages } from "../../libs/r2"

const products = new Hono<AppContext>()

products.use(authMiddleware)

// Get product groups
products.get("/", zValidator("query", searchAndPaginationSchema), async (c) => {
	try {
		const { page, limit } = c.req.valid("query")
		const productGroups = await getProductGroups(c, { page, limit })
		return response(c, productGroups)
	} catch (err) {
		console.error("Error in GET /products:", err)
		return error(c, {
			message: "Failed to get product groups",
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
		} catch (err) {
			console.error("Error in POST /products:", err)
			return error(c, {
				message: "Failed to create product group",
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
		} catch (err) {
			console.error("Error in PUT /products/:id:", err)
			return error(c, {
				message: "Failed to update product group",
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
			const productGroup = await deleteProductGroup(c, { groupId })
			return response(c, productGroup)
		} catch (err) {
			console.error("Error in DELETE /products/:id:", err)
			return error(c, {
				message: "Failed to delete product group",
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
			const products = await getProductsByGroupId(c, {
				groupId,
				keyword,
				sort,
				order,
				page,
				limit,
			})
			return response(c, products)
		} catch (err) {
			console.error("Error in GET /products/:groupId:", err)
			return error(c, {
				message: "Failed to get products by group",
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
		} catch (err) {
			console.error("Error in GET /products/:groupId/:productId:", err)
			return error(c, {
				message: "Failed to get product",
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

			// Upload images to Cloudinary and preserve order
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
		} catch (err) {
			console.error("Error in POST /products/:groupId:", err)
			return error(c, {
				message: "Failed to create product",
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

			// Upload new images to Cloudinary if provided
			const uploadedImageUrls =
				rawImages && rawImages.length > 0
					? (await uploadImages(c, rawImages)).map(
							(img) => img.secure_url
					  )
					: undefined

			const product = await updateProduct(c, {
				groupId,
				productId,
				name,
				description,
				price,
				metadata,
				images: uploadedImageUrls,
			})

			if (!product) {
				return error(c, {
					message: "Failed to update product or product not found",
					status: 404,
				})
			}

			return response(c, product)
		} catch (err) {
			console.error("Error in PUT /products/:groupId/:productId:", err)
			return error(c, {
				message: "Failed to update product",
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
		} catch (err) {
			console.error("Error in DELETE /products/:groupId/:productId:", err)
			return error(c, {
				message: "Failed to delete product",
				status: 500,
			})
		}
	}
)

export default products
