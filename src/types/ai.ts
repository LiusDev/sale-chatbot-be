// Allowed AI models
export const AI_MODELS = ["gpt-4.1-mini-2025-04-14"] as const

export type AIModel = (typeof AI_MODELS)[number]
