import { Context, Hono } from "hono"
import { env } from "hono/adapter"
import { cors } from "hono/cors"
import { AppContext } from "./types/env"
import { errorHandler } from "./middlewares"
import auth from "./routes/auth"
import products from "./routes/products"
import ai from "./routes/ai"
import { testPresignedUrlGeneration } from "./libs/r2"
import meta from "./routes/meta"
const app = new Hono<AppContext>().basePath("/api")

app.use(
	"*",
	cors({
		origin: (origin, c: Context<AppContext>) => {
			const frontendUrl = env(c).FE_URL

			// Allow configured frontend URL
			if (origin === frontendUrl) {
				return origin
			}

			// Allow localhost origins for development and testing
			if (origin && isLocalhostOrigin(origin)) {
				return origin
			}

			// Default to configured frontend URL
			return frontendUrl
		},
		credentials: true,
	})
)

// Helper function to check if origin is localhost
function isLocalhostOrigin(origin: string): boolean {
	try {
		const url = new URL(origin)
		const isLocalhost =
			url.hostname === "localhost" ||
			url.hostname === "127.0.0.1" ||
			url.hostname.endsWith(".localhost")

		// Common development ports
		const allowedPorts = [
			"3000",
			"3001",
			"5173",
			"5174",
			"4173",
			"8080",
			"8000",
			"9000",
		]
		const isAllowedPort = allowedPorts.includes(url.port) || url.port === ""

		return isLocalhost && isAllowedPort
	} catch {
		return false
	}
}

app.get("/", (c: Context<AppContext>) => {
	try {
		return c.text("Hello World!")
	} catch (err) {
		console.error("Error in root handler:", err)
		return c.json(
			{
				error: {
					message: "Internal Server Error",
				},
			},
			500
		)
	}
})

// Auth routes
app.route("/auth", auth)

// Products routes
app.route("/products", products)

// AI routes
app.route("/ai", ai)

// Meta routes
app.route("/meta", meta)

app.onError(errorHandler)

export default app
