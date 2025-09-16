import z from "zod"
import { type UIMessage } from "ai"

/**
 * @see https://github.com/vercel/ai/blob/main/packages/provider/src/shared/v2/shared-v2-provider-metadata.ts#L24
 */
const providerMetadata = z
	.record(z.string(), z.record(z.string(), z.json()))
	.optional()

/**
 * @see https://github.com/vercel/ai/issues/6763
 * @see https://github.com/vercel/ai/blob/90d212f244a400b3660dd76b2fc183859cb2c5cc/packages/ai/src/ui/ui-messages.ts#L258
 */
export const uiMessageSchema: z.ZodType<UIMessage> = z.object({
	id: z.string(),
	metadata: z.unknown().optional(),
	role: z.enum(["user", "assistant", "system"]),
	parts: z.array(
		// cannot use z.discriminatedUnion because of z.templateLiteral
		z.union([
			z.object({
				type: z.literal("text"),
				text: z.string(),
				state: z.enum(["streaming", "done"]).optional(),
				providerMetadata,
			}),
			z.object({
				type: z.literal("reasoning"),
				text: z.string(),
				state: z.enum(["streaming", "done"]).optional(),
				providerMetadata,
			}),
			z.object({
				type: z.literal("source-url"),
				sourceId: z.string(),
				url: z.string(),
				title: z.string().optional(),
				providerMetadata,
			}),
			z.object({
				type: z.literal("source-document"),
				sourceId: z.string(),
				mediaType: z.string(),
				title: z.string(),
				filename: z.string().optional(),
				providerMetadata,
			}),
			z.object({
				type: z.literal("file"),
				mediaType: z.string(),
				filename: z.string().optional(),
				url: z.string(),
				providerMetadata,
			}),
			z.object({
				type: z.literal("step-start"),
			}),
			z.object({
				type: z.templateLiteral(["data-", z.string()]),
				id: z.string().optional(),
				data: z.unknown(),
			}),
			createToolStates(
				z.object({
					type: z.templateLiteral(["tool-", z.string()]),
					toolCallId: z.string(),
				})
			),
			createToolStates(
				z.object({
					type: z.literal("dynamic-tool"),
					toolName: z.string(),
					toolCallId: z.string(),
				})
			),
		])
	),
})

/**
 * Nested discriminated unions for tool states
 * @see https://zod.dev/api#discriminated-unions
 */
function createToolStates<T extends z.ZodRawShape>(baseSchema: z.ZodObject<T>) {
	return z.discriminatedUnion("state", [
		z.object({
			...baseSchema.shape,
			state: z.literal("input-streaming"),
			input: z.unknown(),
		}),
		z.object({
			...baseSchema.shape,
			state: z.literal("input-available"),
			input: z.unknown(),
			providedExecuted: z.boolean().optional(),
			callProviderMetadata: providerMetadata,
		}),
		z.object({
			...baseSchema.shape,
			state: z.literal("output-available"),
			input: z.unknown(),
			output: z.unknown(),
			providedExecuted: z.boolean().optional(),
			callProviderMetadata: providerMetadata,
		}),
		z.object({
			...baseSchema.shape,
			state: z.literal("output-error"),
			input: z.unknown(),
			errorText: z.string(),
			providedExecuted: z.boolean().optional(),
			callProviderMetadata: providerMetadata,
		}),
	])
}
