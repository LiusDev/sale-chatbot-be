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
