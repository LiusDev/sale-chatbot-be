import { Context } from "hono"
import { AppContext } from "../types/env"
import {
	ContentfulStatusCode,
	RedirectStatusCode,
} from "hono/utils/http-status"
import { status as httpStatus } from "http-status"

export const response = (
	c: Context<AppContext>,
	data: any,
	status: number = httpStatus.OK
) => {
	return c.json(data, status as ContentfulStatusCode)
}

export const listResponse = (
	c: Context<AppContext>,
	data: any,
	meta: {
		total: number
		page: number
		limit: number
	},
	status: number = httpStatus.OK
) => {
	return c.json({ data, meta }, status as ContentfulStatusCode)
}

export const redirect = (
	c: Context<AppContext>,
	url: string,
	status: number = httpStatus.PERMANENT_REDIRECT
) => {
	return c.redirect(url, status as RedirectStatusCode)
}
