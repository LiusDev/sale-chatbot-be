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

export const updateAppInfo = async (
	c: Context<AppContext>,
	appInfo: UpdateAppInfoBodySchema
) => {
	const dbConnection = db(c.env)

	// Update each key-value pair sequentially
	// Ai lỡ đọc đoạn này đừng đánh giá D:
	// CF D1 không hỗ trợ transaction, và cũng chỉ có <= 10 row nên for loop tạm :v
	for (const [key, value] of Object.entries(appInfo)) {
		await dbConnection
			.update(commonAppInfo)
			.set({ value })
			.where(eq(commonAppInfo.key, key))
	}

	return getAppInfo(c)
}
