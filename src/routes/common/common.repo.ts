import { Context } from "hono"
import { AppContext } from "../../types/env"
import { db } from "../../libs/db"
import { commonAppInfo } from "../../libs/schema"
import { eq } from "drizzle-orm"
import { UpdateAppInfoBodySchema } from "./common.schema"

const maskPrivateAppInfo = (appInfo: (typeof commonAppInfo.$inferSelect)[]) => {
	return appInfo.map((item) => {
		if (item.isPrivate) {
			return { ...item, value: "********" }
		}
		return item
	})
}

const keyValueResponse = (appInfo: (typeof commonAppInfo.$inferSelect)[]) => {
	return appInfo.reduce((acc, item) => {
		acc[item.key] = item.value
		return acc
	}, {} as Record<string, string>)
}

export const getAppInfo = async (c: Context<AppContext>) => {
	const appInfo = await db(c.env).select().from(commonAppInfo)
	const publicAppInfo = maskPrivateAppInfo(appInfo)
	return keyValueResponse(publicAppInfo)
}

export const getLLMAppContext = async (c: Context<AppContext>) => {
	const appInfo = await db(c.env)
		.select()
		.from(commonAppInfo)
		.where(eq(commonAppInfo.isPrivate, false))
	// parse to string
	const appContext = appInfo
		.map((item) => {
			return `${item.key}: ${item.value}`
		})
		.join("\n")
	return appContext
}

export const upsertAppInfo = async (
	c: Context<AppContext>,
	appInfo: UpdateAppInfoBodySchema
) => {
	const dbConnection = db(c.env)

	// Upsert each key using INSERT ... ON CONFLICT DO UPDATE in a single batch
	const queries = [] as any[]
	for (const [key, value] of Object.entries(appInfo)) {
		queries.push(
			dbConnection
				.insert(commonAppInfo)
				.values({ key, value })
				.onConflictDoUpdate({
					target: commonAppInfo.key,
					set: { value },
				})
		)
	}

	if (queries.length > 0) {
		await dbConnection.batch(queries as any)
	}

	return getAppInfo(c)
}
