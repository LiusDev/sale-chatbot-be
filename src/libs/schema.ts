import { int, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const systemUsersTable = sqliteTable("system_users", {
	id: int().primaryKey({ autoIncrement: true }),
	name: text().notNull(),
	email: text().notNull().unique(),
	role: text().notNull().default("super_admin"),
})
