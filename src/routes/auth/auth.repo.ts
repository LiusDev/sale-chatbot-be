import { Context } from "hono"
import { AppContext } from "../../types/env"
import { db } from "../../libs/db"
import { systemUsersTable } from "../../libs/schema"
import { eq } from "drizzle-orm"

// get system user by email
export const getSystemUserByEmail = async (
	c: Context<AppContext>,
	{
		email,
	}: {
		email: string
	}
) => {
	try {
		const user = await db(c.env)
			.select()
			.from(systemUsersTable)
			.where(eq(systemUsersTable.email, email))
			.limit(1)
		return user[0]
	} catch (error) {
		console.error(error)
		return null
	}
}
