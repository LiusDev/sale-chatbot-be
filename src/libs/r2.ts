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

// Generate a public URL for R2 object using custom domain
export const generatePresignedUrl = (
	c: Context<AppContext>,
	objectKey: string
): string => {
	// Ensure custom domain doesn't end with slash and objectKey doesn't start with slash
	const domain = c.env.R2_CUSTOM_DOMAIN.replace(/\/$/, "")
	const key = objectKey.replace(/^\//, "")
	return `${domain}/${key}`
}

// Generate public URLs for multiple object keys
export const generateMultiplePresignedUrls = (
	c: Context<AppContext>,
	objectKeys: string[]
): string[] => {
	return objectKeys.map((objectKey) => generatePresignedUrl(c, objectKey))
}

// Helper function to convert image URLs with public URLs for response
export const enhanceImagesWithPresignedUrls = (
	c: Context<AppContext>,
	images: Array<{ url: string; altText: string; index: number }>
): Array<{
	url: string
	altText: string
	index: number
	presignedUrl: string
}> => {
	const objectKeys = images.map((img) => img.url)
	const publicUrls = generateMultiplePresignedUrls(c, objectKeys)

	return images.map((img, idx) => ({
		...img,
		presignedUrl: publicUrls[idx],
	}))
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

// Generate public URL for uploading files (now just returns public URL)
export const generateUploadPresignedUrl = (
	c: Context<AppContext>,
	objectKey: string,
	contentType?: string,
	expiresIn?: number
): string => {
	return generatePresignedUrl(c, objectKey)
}

// Generate public URL for downloading files
export const generateDownloadPresignedUrl = (
	c: Context<AppContext>,
	objectKey: string,
	expiresIn?: number
): string => {
	return generatePresignedUrl(c, objectKey)
}

// Test public URL generation (for debugging)
export const testPresignedUrlGeneration = (
	c: Context<AppContext>
): { success: boolean; url?: string; error?: string } => {
	try {
		const testObjectKey = "test/sample-image.jpg"
		const url = generatePresignedUrl(c, testObjectKey)

		console.log("✅ Public URL generated successfully:", url)
		return { success: true, url }
	} catch (error) {
		console.error("❌ Public URL generation failed:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		}
	}
}
