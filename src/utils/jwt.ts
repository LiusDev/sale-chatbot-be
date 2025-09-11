import { Context } from "hono"
import { AppContext } from "../types/env"
import { sign } from "hono/jwt"
import { JwtPayload } from "../types/jwt.type"
import { JwtExp } from "./constant"

export const generateToken = (
	c: Context<AppContext>,
	{
		sub,
		name,
		exp = Math.floor(Date.now() / 1000) + JwtExp.ONE_WEEK,
	}: JwtPayload
) => {
	return sign({ sub, name, exp }, c.env.JWT_SECRET)
}
