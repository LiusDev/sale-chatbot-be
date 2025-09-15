import z from "zod"

export const createProductGroupBodySchema = z.object({
	name: z.string(),
	description: z.string().optional(),
})
export type CreateProductGroupBodySchema = z.infer<
	typeof createProductGroupBodySchema
>

export const productGroupParamSchema = z.object({
	groupId: z.coerce.number(),
})
export type ProductGroupParamSchema = z.infer<typeof productGroupParamSchema>

export const updateProductGroupBodySchema =
	createProductGroupBodySchema.partial()
export type UpdateProductGroupBodySchema = z.infer<
	typeof updateProductGroupBodySchema
>

export const productParamSchema = z.object({
	productId: z.coerce.number(),
})
export type ProductParamSchema = z.infer<typeof productParamSchema>

export const createProductBodySchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	price: z.number(),
	metadata: z.string().optional(),
	images: z
		.object({
			url: z.string(),
			altText: z.string().optional(),
			index: z.number(),
		})
		.array(),
})
export type CreateProductBodySchema = z.infer<typeof createProductBodySchema>

// Schema for update - supports both new images and existing image IDs
export const updateProductBodySchema = z.object({
	name: z.string().optional(),
	description: z.string().optional(),
	price: z.number().optional(),
	metadata: z.string().optional(),
	// Mixed array of new images (base64) and existing images (just URLs to keep)
	images: z
		.object({
			url: z.string(),
			altText: z.string().optional(),
			index: z.number(),
			isExisting: z.boolean().optional(), // true = keep existing, false/undefined = new upload
		})
		.array()
		.optional(),
})
export type UpdateProductBodySchema = z.infer<typeof updateProductBodySchema>
