import { JwtVariables } from "hono/jwt"
import { JwtPayload } from "./jwt.type"

interface Variables extends JwtVariables {
	jwtPayload: JwtPayload
}

export type AppContext = { Bindings: CloudflareBindings; Variables: Variables }
