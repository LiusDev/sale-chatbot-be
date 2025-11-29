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

/**
 * Invalidate (clear) cached messages for a conversation
 * Call this when a new message arrives to ensure fresh data
 * @param conversationId - The conversation ID to invalidate cache for
 */
export const invalidateCachedMessages = async (
	conversationId: string
): Promise<void> => {
	try {
		const cache = await caches.open(CACHE_NAME)
		const cacheKey = `https://cache.internal/messages/${conversationId}`
		const deleted = await cache.delete(cacheKey)
		if (deleted) {
			console.log(
				`[Cache] INVALIDATED for conversation ${conversationId}`
			)
		}
	} catch (error) {
		console.error("[Cache] Error invalidating cached messages:", error)
		// Don't throw - caching is optional, continue without it
	}
}

/**
 * Append a new message to cached messages
 * This is more efficient than invalidating and refetching from Meta API
 * @param conversationId - The conversation ID
 * @param newMessage - The new message to append
 */
export const appendMessageToCache = async (
	conversationId: string,
	newMessage: any
): Promise<void> => {
	try {
		const cache = await caches.open(CACHE_NAME)
		const cacheKey = `https://cache.internal/messages/${conversationId}`

		// Get existing cached messages
		const cachedResponse = await cache.match(cacheKey)
		let messages: any[] = []

		if (cachedResponse) {
			messages = (await cachedResponse.json()) as any[]
		}

		// Append the new message
		messages.push(newMessage)

		// Update cache with new message list
		const response = new Response(JSON.stringify(messages), {
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": `max-age=${CACHE_TTL_SECONDS}`,
			},
		})

		await cache.put(cacheKey, response)
		console.log(
			`[Cache] APPENDED message to conversation ${conversationId} (total: ${messages.length})`
		)
	} catch (error) {
		console.error("[Cache] Error appending message to cache:", error)
		// Don't throw - caching is optional, continue without it
	}
}
