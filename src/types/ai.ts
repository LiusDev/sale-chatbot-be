// Allowed AI models (using available models in Cloudflare Workers AI)
export const AI_MODELS = ["gpt-4.1-mini-2025-04-14", "gpt-5-mini"] as const

export type AIModel = (typeof AI_MODELS)[number]
