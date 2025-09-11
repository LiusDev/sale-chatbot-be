import { Context, Hono } from "hono"
import { AppContext } from "../../types/env"
import { authController } from "./auth.controller"

const auth = new Hono<AppContext>()

auth.get("/url/:provider", (c: Context<AppContext, "/url/:provider">) => {
	return authController.getAuthUrl(c)
})

auth.get(
	"/:provider/callback",
	(c: Context<AppContext, "/:provider/callback">) => {
		return authController.getAuthCallback(c)
	}
)

export default auth
