import { z } from "zod"

// Define the allowed keys for app info updates
const ALLOWED_APP_INFO_KEYS = [
	"zalo",
	"shopName",
	"metaAccessToken",
	"metaWebhookVerifyKey",
] as const

// Schema for validating app info update payload
export const updateAppInfoBodySchema = z
	.record(z.string(), z.string())
	.refine(
		(data) => {
			// Check if all keys in the payload are allowed
			const providedKeys = Object.keys(data)
			return providedKeys.every((key) =>
				ALLOWED_APP_INFO_KEYS.includes(key as any)
			)
		},
		{
			message: `Only the following keys are allowed: ${ALLOWED_APP_INFO_KEYS.join(
				", "
			)}`,
		}
	)
	.refine(
		(data) => {
			// Check if at least one key is provided
			return Object.keys(data).length > 0
		},
		{
			message: "At least one key-value pair must be provided",
		}
	)

export type UpdateAppInfoBodySchema = z.infer<typeof updateAppInfoBodySchema>
