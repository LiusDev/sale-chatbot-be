import { Context } from "hono"
import { AppContext } from "../types/env"
import { ContentfulStatusCode } from "hono/utils/http-status"
import { status as httpStatus } from "http-status"

export const error = (
	c: Context<AppContext>,
	{
		message = "Internal Server Error",
		status = httpStatus.INTERNAL_SERVER_ERROR,
	}: { message?: string; status?: number } = {}
) => {
	return c.json({ error: message, status }, status as ContentfulStatusCode)
}
