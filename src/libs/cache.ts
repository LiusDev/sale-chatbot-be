/**
 * Caching utility using Cloudflare Cache API
 * Provides message caching to reduce Meta API calls
 */

const CACHE_NAME = "meta-messages-cache"
const CACHE_TTL_SECONDS = 60

/**
 * Get cached conversation messages using Cloudflare Cache API
 * @param conversationId - The conversation ID to fetch cached messages for
 * @returns Cached messages array or null if not found/expired
 */
export const getCachedMessages = async (
	conversationId: string
): Promise<any[] | null> => {
	try {
		const cache = await caches.open(CACHE_NAME)
		const cacheKey = `https://cache.internal/messages/${conversationId}`
		const cachedResponse = await cache.match(cacheKey)

		if (!cachedResponse) {
			console.log(`[Cache] MISS for conversation ${conversationId}`)
			return null
		}

		const messages = (await cachedResponse.json()) as any[]
		console.log(`[Cache] HIT for conversation ${conversationId}`)
		return messages
	} catch (error) {
		console.error("[Cache] Error getting cached messages:", error)
		return null
	}
}

/**
 * Cache conversation messages using Cloudflare Cache API
 * @param conversationId - The conversation ID to cache messages for
 * @param messages - The messages array to cache
 */
export const setCachedMessages = async (
	conversationId: string,
	messages: any[]
): Promise<void> => {
	try {
		const cache = await caches.open(CACHE_NAME)
		const cacheKey = `https://cache.internal/messages/${conversationId}`

		// Create a response with Cache-Control header for TTL
		const response = new Response(JSON.stringify(messages), {
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": `max-age=${CACHE_TTL_SECONDS}`,
			},
		})

		await cache.put(cacheKey, response)
		console.log(
			`[Cache] SET for conversation ${conversationId} (TTL: ${CACHE_TTL_SECONDS}s)`
		)
	} catch (error) {
		console.error("[Cache] Error setting cached messages:", error)
		// Don't throw - caching is optional, continue without it
	}
}
