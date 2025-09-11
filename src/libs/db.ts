import { drizzle } from "drizzle-orm/d1"

export const db = (env: CloudflareBindings) => {
	return drizzle(env.sale_chatbot)
}
