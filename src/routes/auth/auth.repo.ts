import { Context } from "hono"
import { AppContext } from "../../types/env"
import { db } from "../../libs/db"
import { systemUsersTable } from "../../libs/schema"
import { eq } from "drizzle-orm"

// get system user by id
export const getSystemUser = async (
	c: Context<AppContext>,
	{
		id,
	}: {
		id: number
	}
) => {
	try {
		const user = await db(c.env)
			.select()
			.from(systemUsersTable)
			.where(eq(systemUsersTable.id, id))
			.limit(1)
		return user[0]
	} catch (error) {
		console.error(error)
		return null
	}
}

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

export const updateSystemUserByEmail = async (
	c: Context<AppContext>,
	{
		email,
		avatar,
		name,
	}: {
		email: string
		avatar: string
		name: string
	}
) => {
	try {
		await db(c.env)
			.update(systemUsersTable)
			.set({ avatar, name })
			.where(eq(systemUsersTable.email, email))
	} catch (error) {
		console.error(error)
		return null
	}
}
