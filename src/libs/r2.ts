import { Context } from "hono"
import { AppContext } from "../types/env"

// Convert base64 to ArrayBuffer (Workers compatible)
const base64ToArrayBuffer = (base64String: string): ArrayBuffer => {
	// Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
	const base64Data = base64String.includes(",")
		? base64String.split(",")[1]
		: base64String

	// Decode base64 to binary string
	const binaryString = atob(base64Data)

	// Convert binary string to ArrayBuffer
	const bytes = new Uint8Array(binaryString.length)
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i)
	}

	return bytes.buffer
}

// Generate unique filename
const generateFileName = (
	originalIndex: number,
	fileExtension: string = "jpg"
): string => {
	const timestamp = Date.now()
	const randomString = Math.random().toString(36).substring(2, 15)
	return `products/${timestamp}-${originalIndex}-${randomString}.${fileExtension}`
}

// Detect file extension from base64 data
const detectFileExtension = (base64String: string): string => {
	if (base64String.startsWith("data:image/")) {
		const match = base64String.match(/data:image\/([a-zA-Z0-9]+);/)
		return match ? match[1] : "jpg"
	}
	return "jpg"
}

// Detect content type from file extension
const getContentType = (fileExtension: string): string => {
	const contentTypes: Record<string, string> = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		svg: "image/svg+xml",
	}
	return contentTypes[fileExtension.toLowerCase()] || "image/jpeg"
}

// Upload images to R2 using Workers native API
export const uploadImages = async (
	c: Context<AppContext>,
	images: { url: string; altText?: string; index: number }[]
): Promise<
	Array<{ secure_url: string; originalIndex: number; altText: string }>
> => {
	try {
		// Get R2 bucket from bindings
		const bucket = c.env.sale_chatbot_r2

		// Upload all images in parallel while preserving order
		const uploadPromises = images.map(async (image) => {
			const fileExtension = detectFileExtension(image.url)
			const fileName = generateFileName(image.index, fileExtension)
			const fileBuffer = base64ToArrayBuffer(image.url)
			const contentType = getContentType(fileExtension)

			// Upload to R2
			const object = await bucket.put(fileName, fileBuffer, {
				httpMetadata: {
					contentType: contentType,
				},
				customMetadata: {
					originalIndex: image.index.toString(),
					altText: image.altText || `Image ${image.index + 1}`,
					uploadedAt: new Date().toISOString(),
				},
			})

			if (!object) {
				throw new Error(`Failed to upload image ${fileName}`)
			}

			// Return R2 object key as secure_url (we'll use this to generate presigned URLs)
			return {
				secure_url: fileName, // Store the object key
				originalIndex: image.index,
				altText: image.altText || `Image ${image.index + 1}`,
			}
		})

		const results = await Promise.all(uploadPromises)

		// Sort by originalIndex to maintain order
		return results.sort((a, b) => a.originalIndex - b.originalIndex)
	} catch (error) {
		console.error("Error uploading images to R2:", error)
		throw new Error("Failed to upload images to R2")
	}
}

// Generate a temporary URL using custom token-based approach
// Since R2 doesn't have native presigned URLs in Workers, we'll create our own token system
export const generatePresignedUrl = async (
	c: Context<AppContext>,
	objectKey: string,
	expiresIn: number = 7 * 24 * 60 * 60 // 1 week in seconds
): Promise<string> => {
	try {
		// Get R2 bucket from bindings
		const bucket = c.env.sale_chatbot_r2

		// Check if object exists (optional - can skip for performance)
		// const object = await bucket.head(objectKey)
		// if (!object) {
		//   throw new Error(`Object ${objectKey} not found`)
		// }

		// Create a simple access token with expiration
		const expirationTime = Math.floor(Date.now() / 1000) + expiresIn
		const tokenPayload = {
			key: objectKey,
			exp: expirationTime,
		}

		// Create a simple signed token (you can use JWT or custom signing)
		const token = btoa(JSON.stringify(tokenPayload))

		// Return URL with access token - this would need a custom endpoint to serve
		// For now, we'll use the public R2 URL directly
		const baseUrl = `https://pub-${c.env.CLOUDFLARE_ACCOUNT_ID}.r2.dev`
		return `${baseUrl}/${objectKey}`
	} catch (error) {
		console.error("Error generating presigned URL:", error)
		// Fallback: return a basic URL
		const baseUrl = `https://pub-${c.env.CLOUDFLARE_ACCOUNT_ID}.r2.dev`
		return `${baseUrl}/${objectKey}`
	}
}

// Generate presigned URLs for multiple object keys
export const generateMultiplePresignedUrls = async (
	c: Context<AppContext>,
	objectKeys: string[],
	expiresIn?: number
): Promise<string[]> => {
	try {
		const presignedUrlPromises = objectKeys.map((objectKey) =>
			generatePresignedUrl(c, objectKey, expiresIn)
		)

		return await Promise.all(presignedUrlPromises)
	} catch (error) {
		console.error("Error generating multiple presigned URLs:", error)
		throw new Error("Failed to generate presigned URLs")
	}
}

// Helper function to convert image URLs with presigned URLs for response
export const enhanceImagesWithPresignedUrls = async (
	c: Context<AppContext>,
	images: Array<{ url: string; altText: string; index: number }>
): Promise<
	Array<{ url: string; altText: string; index: number; presignedUrl: string }>
> => {
	try {
		const objectKeys = images.map((img) => img.url)
		const presignedUrls = await generateMultiplePresignedUrls(c, objectKeys)

		return images.map((img, idx) => ({
			...img,
			presignedUrl: presignedUrls[idx],
		}))
	} catch (error) {
		console.error("Error enhancing images with presigned URLs:", error)
		// Return original images without presigned URLs if generation fails
		return images.map((img) => ({
			...img,
			presignedUrl: `https://pub-${c.env.CLOUDFLARE_ACCOUNT_ID}.r2.dev/${img.url}`, // Fallback to public URL
		}))
	}
}

// Delete image from R2 (useful for cleanup)
export const deleteImage = async (
	c: Context<AppContext>,
	objectKey: string
): Promise<boolean> => {
	try {
		const bucket = c.env.sale_chatbot_r2
		await bucket.delete(objectKey)
		return true
	} catch (error) {
		console.error("Error deleting image from R2:", error)
		return false
	}
}

// Delete multiple images from R2
export const deleteMultipleImages = async (
	c: Context<AppContext>,
	objectKeys: string[]
): Promise<{ success: string[]; failed: string[] }> => {
	const results = {
		success: [] as string[],
		failed: [] as string[],
	}

	for (const objectKey of objectKeys) {
		try {
			const deleted = await deleteImage(c, objectKey)
			if (deleted) {
				results.success.push(objectKey)
			} else {
				results.failed.push(objectKey)
			}
		} catch (error) {
			results.failed.push(objectKey)
		}
	}

	return results
}
