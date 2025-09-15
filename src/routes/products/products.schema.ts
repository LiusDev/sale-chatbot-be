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

export const updateProductBodySchema = createProductBodySchema.partial()
export type UpdateProductBodySchema = z.infer<typeof updateProductBodySchema>
