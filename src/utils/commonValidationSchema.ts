import { z } from "zod"

export const searchAndPaginationSchema = z.object({
	keyword: z.string().optional(),
	sort: z
		.enum(["id", "name", "description", "price", "product_group_id"])
		.optional(),
	order: z.enum(["asc", "desc"]).optional(),
	page: z.coerce.number().min(1).default(1),
	limit: z.coerce.number().min(1).max(100).default(10),
})
// generate type from schema
export type SearchAndPaginationSchema = z.infer<
	typeof searchAndPaginationSchema
>
