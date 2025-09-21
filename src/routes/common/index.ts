import { Hono } from "hono"
import { AppContext } from "../../types/env"
import { authMiddleware } from "../../middlewares"
import { response } from "../../utils/response"
import { getAppInfo, updateAppInfo } from "./common.repo"
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

common.put("/", zValidator("json", updateAppInfoBodySchema), async (c) => {
	const validationResult = c.req.valid("json")
	try {
		const updatedAppInfo = await updateAppInfo(c, validationResult)
		return response(c, updatedAppInfo)
	} catch (err: any) {
		return error(c, {
			message: `Failed to update app info: ${err.message}`,
			status: 500,
		})
	}
})

export default common
