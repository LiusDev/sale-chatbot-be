import { Hono } from "hono"
import { AppContext } from "../../types/env"
import { authMiddleware } from "../../middlewares"
import { response } from "../../utils/response"
import { getAppInfo, upsertAppInfo } from "./common.repo"
import { updateAppInfoBodySchema } from "./common.schema"
import { zValidator } from "@hono/zod-validator"
import { error } from "../../utils/error"

const common = new Hono<AppContext>()

common.use(authMiddleware)

common.get("/", async (c) => {
	try {
		const appInfo = await getAppInfo(c)
		return response(c, appInfo)
	} catch (err: any) {
		return error(c, {
			message: `Failed to get app info: ${err.message}`,
			status: 500,
		})
	}
})

common.post("/webhook-verify-key", async (c) => {
	// generate a random key, then save to db and response the key
	const metaWebhookVerifyKey = crypto.randomUUID()
	await upsertAppInfo(c, { metaWebhookVerifyKey })
	return response(c, metaWebhookVerifyKey)
})

common.put("/", zValidator("json", updateAppInfoBodySchema), async (c) => {
	const validationResult = c.req.valid("json")
	try {
		const updatedAppInfo = await upsertAppInfo(c, validationResult)
		return response(c, updatedAppInfo)
	} catch (err: any) {
		return error(c, {
			message: `Failed to update app info: ${err.message}`,
			status: 500,
		})
	}
})

export default common
