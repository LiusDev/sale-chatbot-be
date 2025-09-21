import { sqliteTable, AnySQLiteColumn, integer, text, foreignKey, uniqueIndex } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const productGroups = sqliteTable("product_groups", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	name: text().notNull(),
	description: text().default(""),
});

export const productImages = sqliteTable("product_images", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	productId: integer("product_id").references(() => products.id),
	imageUrl: text("image_url").notNull(),
	altText: text("alt_text").default(""),
	index: integer().notNull(),
});

export const products = sqliteTable("products", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	name: text().notNull(),
	description: text().default(""),
	price: integer().notNull(),
	metadata: text().default(""),
	productGroupId: integer("product_group_id").references(() => productGroups.id),
});

export const systemUsers = sqliteTable("system_users", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	name: text().notNull(),
	email: text().notNull(),
	role: text().default("super_admin").notNull(),
	avatar: text().default(""),
},
(table) => [
	uniqueIndex("system_users_email_unique").on(table.email),
]);

export const aiAgents = sqliteTable("ai_agents", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	name: text().notNull(),
	description: text().default(""),
	model: text().notNull(),
	systemPrompt: text("system_prompt").notNull(),
	knowledgeSourceGroupId: integer("knowledge_source_group_id").references(() => productGroups.id),
	topK: integer("top_k").default(5).notNull(),
	temperature: integer().default(70).notNull(),
	maxTokens: integer("max_tokens").default(1000).notNull(),
	createdBy: integer("created_by").references(() => systemUsers.id),
	createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
	updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

export const commonAppInfo = sqliteTable("common_app_info", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	key: text().notNull(),
	value: text().notNull(),
	isPrivate: integer().default(false).notNull(),
});

export const metaPages = sqliteTable("meta_pages", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	pageId: text("page_id").notNull(),
	name: text().notNull(),
	accessToken: text("access_token"),
	category: text(),
	createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
	updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

