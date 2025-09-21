import { Context } from "hono"
import { AppContext } from "../types/env"
import { getMetaAccessToken } from "../routes/meta/meta.repo"
import ky from "ky"
import { MetaFanpageList } from "../types/meta"

const metaBaseAPI = (accessToken: string) =>
	ky.create({
		prefixUrl: "https://graph.facebook.com/v23.0/me/accounts",
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	})

export const getFanpagesFromMeta = async (c: Context<AppContext>) => {
	const metaAccessToken = await getMetaAccessToken(c)

	if (!metaAccessToken) {
		throw new Error(
			"Meta access token not found. Please configure metaAccessToken in app settings."
		)
	}

	try {
		const fanpages = await metaBaseAPI(metaAccessToken)
			.get("me/accounts")
			.json<MetaFanpageList>()
		return fanpages
	} catch (error) {
		console.error("Error fetching fanpages from Meta API:", error)
		throw new Error(
			"Failed to fetch fanpages from Meta. Please check your access token and try again."
		)
	}
}
