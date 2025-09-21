import { int, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const systemUsers = sqliteTable("system_users", {
	id: int().primaryKey({ autoIncrement: true }),
	name: text().notNull(),
	email: text().notNull().unique(),
	role: text().notNull().default("super_admin"),
	avatar: text().default(""),
})

export const productGroups = sqliteTable("product_groups", {
	id: int().primaryKey({ autoIncrement: true }),
	name: text().notNull(),
	description: text().default(""),
})

export const products = sqliteTable("products", {
	id: int().primaryKey({ autoIncrement: true }),
	name: text().notNull(),
	description: text().default(""),
	price: int().notNull(),
	metadata: text().default(""),
	product_group_id: int().references(() => productGroups.id),
})

export const productImages = sqliteTable("product_images", {
	id: int().primaryKey({ autoIncrement: true }),
	product_id: int().references(() => products.id),
	image_url: text().notNull(),
	alt_text: text().default(""),
	index: int().notNull(),
})

export const aiAgents = sqliteTable("ai_agents", {
	id: int().primaryKey({ autoIncrement: true }),
	name: text().notNull(),
	description: text().default(""),
	model: text().notNull(), // @cf/openai/gpt-oss-120b or @cf/meta/llama-3.3-70b-instruct-fp8-fast
	system_prompt: text().notNull(),
	knowledge_source_group_id: int().references(() => productGroups.id),
	top_k: int().notNull().default(5),
	temperature: int().notNull().default(70), // 0-100, will be converted to 0.0-1.0
	max_tokens: int().notNull().default(1000),
	created_by: int().references(() => systemUsers.id),
	created_at: text().default("CURRENT_TIMESTAMP"),
	updated_at: text().default("CURRENT_TIMESTAMP"),
})

export const commonAppInfo = sqliteTable("common_app_info", {
	id: int().primaryKey({ autoIncrement: true }),
	key: text().notNull(),
	value: text().notNull(),
	isPrivate: int({ mode: "boolean" }).notNull().default(false),
})
