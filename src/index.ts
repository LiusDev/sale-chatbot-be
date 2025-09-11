import { Context, Hono } from "hono"
import { env } from "hono/adapter"
import { cors } from "hono/cors"
import { AppContext } from "./types/env"
import { errorHandler } from "./middlewares"
import auth from "./routes/auth"
const app = new Hono<AppContext>().basePath("/api")

app.use(
	"*",
	cors({
		origin: (origin, c: Context<AppContext>) => {
			const frontendUrl = env(c).FE_URL
			return origin === frontendUrl || origin?.endsWith(".localhost:3000")
				? origin
				: frontendUrl
		},
		credentials: true,
	})
)

app.get("/", (c: Context<AppContext>) => {
	return c.text("Hello World!")
})

// Auth routes
app.route("/auth", auth)

app.onError(errorHandler)

export default app
