import { z } from "zod"

export const getAuthProviderPathSchema = z.object({
	provider: z.enum(["google"]),
})

export const getAuthUrlQuerySchema = z.object({
	redirect_uri: z.url().optional(),
})
