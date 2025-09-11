import type { Context } from "hono"
import { AppContext } from "../types/env"

export function errorHandler(err: unknown, c: Context<AppContext>) {
	const status = (err as any)?.status ?? 500
	const message = (err as any)?.message ?? "Internal Server Error"
	return c.json({ error: { message } }, status)
}
