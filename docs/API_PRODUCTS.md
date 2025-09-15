# Products API Documentation

## Overview

API quản lý sản phẩm với cấu trúc 2 cấp: **Product Groups** (nhóm sản phẩm) và **Products** (sản phẩm).

-   Mỗi product group chứa nhiều products
-   Mỗi product có thể có nhiều ảnh
-   Hỗ trợ upload ảnh lên R2 storage và tạo presigned URLs

## Base URL

```
/products
```

## Authentication

Tất cả endpoints đều yêu cầu authentication token trong header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Product Groups API

### 1. Get Product Groups

**GET** `/products`

Lấy danh sách tất cả nhóm sản phẩm với phân trang.

#### Query Parameters

| Parameter | Type   | Required | Default | Description               |
| --------- | ------ | -------- | ------- | ------------------------- |
| `page`    | number | ❌       | 1       | Số trang                  |
| `limit`   | number | ❌       | 10      | Số items per page         |
| `keyword` | string | ❌       | -       | Từ khóa tìm kiếm          |
| `sort`    | string | ❌       | "id"    | Sắp xếp theo field        |
| `order`   | string | ❌       | "asc"   | Thứ tự: "asc" hoặc "desc" |

#### Response

```json
{
	"success": true,
	"data": [
		{
			"id": 1,
			"name": "Electronics",
			"description": "Electronic devices",
			"productCount": 15
		}
	],
	"pagination": {
		"total": 50,
		"page": 1,
		"limit": 10
	}
}
```

### 2. Create Product Group

**POST** `/products`

Tạo nhóm sản phẩm mới.

#### Request Body

```json
{
	"name": "Electronics",
	"description": "Electronic devices and gadgets"
}
```

#### Response

```json
{
	"success": true,
	"data": {
		"id": 1,
		"name": "Electronics",
		"description": "Electronic devices and gadgets"
	}
}
```

### 3. Update Product Group

**PUT** `/products/:groupId`

Cập nhật thông tin nhóm sản phẩm.

#### Path Parameters

| Parameter | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| `groupId` | number | ✅       | ID của product group |

#### Request Body (tất cả fields optional)

```json
{
	"name": "Updated Electronics",
	"description": "Updated description"
}
```

#### Response

```json
{
	"success": true,
	"data": {
		"id": 1,
		"name": "Updated Electronics",
		"description": "Updated description"
	}
}
```

### 4. Delete Product Group

**DELETE** `/products/:groupId`

Xóa nhóm sản phẩm (chỉ xóa được nếu không có products).

#### Path Parameters

| Parameter | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| `groupId` | number | ✅       | ID của product group |

#### Response

```json
{
	"success": true
}
```

---

## Products API

### 5. Get Products by Group

**GET** `/products/:groupId`

Lấy danh sách sản phẩm trong một nhóm với phân trang và tìm kiếm.

#### Path Parameters

| Parameter | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| `groupId` | number | ✅       | ID của product group |

#### Query Parameters

| Parameter | Type   | Required | Default | Description                                   |
| --------- | ------ | -------- | ------- | --------------------------------------------- |
| `page`    | number | ❌       | 1       | Số trang                                      |
| `limit`   | number | ❌       | 10      | Số items per page                             |
| `keyword` | string | ❌       | -       | Tìm kiếm trong tên và mô tả                   |
| `sort`    | string | ❌       | "id"    | Sắp xếp: "id", "name", "description", "price" |
| `order`   | string | ❌       | "asc"   | Thứ tự: "asc" hoặc "desc"                     |

#### Response

```json
{
	"success": true,
	"data": [
		{
			"id": 1,
			"name": "iPhone 15",
			"description": "Latest iPhone model",
			"price": 999.99,
			"metadata": "{}",
			"product_group_id": 1,
			"imageUrls": [
				{
					"url": "products/timestamp-0-randomstring.jpg",
					"altText": "iPhone 15 image 1",
					"index": 0,
					"presignedUrl": "https://yourdomain.com/products/timestamp-0-randomstring.jpg"
				}
			]
		}
	],
	"pagination": {
		"total": 25,
		"page": 1,
		"limit": 10
	}
}
```

### 6. Get Single Product

**GET** `/products/:groupId/:productId`

Lấy thông tin chi tiết một sản phẩm.

#### Path Parameters

| Parameter   | Type   | Required | Description          |
| ----------- | ------ | -------- | -------------------- |
| `groupId`   | number | ✅       | ID của product group |
| `productId` | number | ✅       | ID của product       |

#### Response

```json
{
	"success": true,
	"data": {
		"id": 1,
		"name": "iPhone 15",
		"description": "Latest iPhone model",
		"price": 999.99,
		"metadata": "{}",
		"product_group_id": 1,
		"imageUrls": [
			{
				"url": "products/timestamp-0-randomstring.jpg",
				"altText": "iPhone 15 image 1",
				"index": 0,
				"presignedUrl": "https://yourdomain.com/products/timestamp-0-randomstring.jpg"
			}
		]
	}
}
```

### 7. Create Product

**POST** `/products/:groupId`

Tạo sản phẩm mới trong một nhóm.

#### Path Parameters

| Parameter | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| `groupId` | number | ✅       | ID của product group |

#### Request Body

```json
{
	"name": "iPhone 15",
	"description": "Latest iPhone model",
	"price": 999.99,
	"metadata": "{\"color\": \"blue\", \"storage\": \"128GB\"}",
	"images": [
		{
			"url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
			"altText": "Front view",
			"index": 0
		},
		{
			"url": "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUg...",
			"altText": "Back view",
			"index": 1
		}
	]
}
```

#### Field Details

| Field              | Type   | Required | Description                     |
| ------------------ | ------ | -------- | ------------------------------- |
| `name`             | string | ✅       | Tên sản phẩm                    |
| `description`      | string | ❌       | Mô tả sản phẩm                  |
| `price`            | number | ✅       | Giá sản phẩm                    |
| `metadata`         | string | ❌       | JSON string chứa thông tin thêm |
| `images`           | array  | ❌       | Mảng ảnh base64                 |
| `images[].url`     | string | ✅       | Base64 image data với prefix    |
| `images[].altText` | string | ❌       | Mô tả ảnh                       |
| `images[].index`   | number | ✅       | Thứ tự ảnh (0, 1, 2...)         |

#### Response

```json
{
	"success": true,
	"data": {
		"id": 1,
		"name": "iPhone 15",
		"description": "Latest iPhone model",
		"price": 999.99,
		"metadata": "{\"color\": \"blue\", \"storage\": \"128GB\"}",
		"product_group_id": 1,
		"imageUrls": [
			{
				"url": "products/timestamp-0-randomstring.jpg",
				"altText": "Front view",
				"index": 0,
				"presignedUrl": "https://yourdomain.com/products/timestamp-0-randomstring.jpg"
			}
		]
	}
}
```

### 8. Update Product (Optimized for R2 Storage)

**PUT** `/products/:groupId/:productId`

Cập nhật sản phẩm với tối ưu hóa quản lý ảnh để tránh tràn bộ nhớ R2.

#### Path Parameters

| Parameter   | Type   | Required | Description          |
| ----------- | ------ | -------- | -------------------- |
| `groupId`   | number | ✅       | ID của product group |
| `productId` | number | ✅       | ID của product       |

#### Request Body (tất cả fields optional)

```json
{
	"name": "iPhone 15 Pro",
	"description": "Updated description",
	"price": 1099.99,
	"metadata": "{\"color\": \"titanium\", \"storage\": \"256GB\"}",
	"images": [
		{
			"url": "products/existing-image-1.jpg",
			"altText": "Existing image to keep",
			"index": 0,
			"isExisting": true
		},
		{
			"url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
			"altText": "New uploaded image",
			"index": 1,
			"isExisting": false
		},
		{
			"url": "products/existing-image-3.jpg",
			"altText": "Another existing image",
			"index": 2,
			"isExisting": true
		}
	]
}
```

#### Images Array Logic

-   **`isExisting: true`**: Giữ ảnh cũ, `url` là đường dẫn R2 hiện tại
-   **`isExisting: false`** hoặc không có: Upload ảnh mới, `url` là base64 data
-   Ảnh cũ không có trong array sẽ bị **xóa khỏi R2** để tiết kiệm bộ nhớ

#### Response

```json
{
	"success": true,
	"data": {
		"id": 1,
		"name": "iPhone 15 Pro",
		"description": "Updated description",
		"price": 1099.99,
		"metadata": "{\"color\": \"titanium\", \"storage\": \"256GB\"}",
		"product_group_id": 1,
		"imageUrls": [
			{
				"url": "products/existing-image-1.jpg",
				"altText": "Existing image to keep",
				"index": 0,
				"presignedUrl": "https://yourdomain.com/products/existing-image-1.jpg"
			},
			{
				"url": "products/timestamp-1-newrandom.jpg",
				"altText": "New uploaded image",
				"index": 1,
				"presignedUrl": "https://yourdomain.com/products/timestamp-1-newrandom.jpg"
			}
		]
	}
}
```

### 9. Delete Product

**DELETE** `/products/:groupId/:productId`

Xóa sản phẩm và tất cả ảnh liên quan.

#### Path Parameters

| Parameter   | Type   | Required | Description          |
| ----------- | ------ | -------- | -------------------- |
| `groupId`   | number | ✅       | ID của product group |
| `productId` | number | ✅       | ID của product       |

#### Response

```json
{
	"success": true
}
```

---

## Image Upload Guide

### Base64 Format

Ảnh phải được encode thành base64 với format:

```
data:image/[type];base64,[base64-data]
```

**Supported formats:**

-   `image/jpeg` → `.jpg`
-   `image/png` → `.png`
-   `image/webp` → `.webp`
-   `image/gif` → `.gif`

### Example JavaScript Upload

```javascript
// Convert file to base64
function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.readAsDataURL(file)
		reader.onload = () => resolve(reader.result)
		reader.onerror = (error) => reject(error)
	})
}

// Create product with images
async function createProduct(groupId, productData, imageFiles) {
	const images = await Promise.all(
		imageFiles.map(async (file, index) => ({
			url: await fileToBase64(file),
			altText: `Product image ${index + 1}`,
			index,
		}))
	)

	const response = await fetch(`/products/${groupId}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			...productData,
			images,
		}),
	})

	return response.json()
}
```

### Example Update with Mixed Images

```javascript
// Update product keeping some old images, adding new ones
async function updateProductWithMixedImages(
	groupId,
	productId,
	updates,
	existingImages,
	newImageFiles
) {
	const newImages = await Promise.all(
		newImageFiles.map(async (file, index) => ({
			url: await fileToBase64(file),
			altText: `New image ${index + 1}`,
			index: existingImages.length + index,
			isExisting: false,
		}))
	)

	const existingImageMapped = existingImages.map((img, index) => ({
		url: img.url, // URL từ response trước đó
		altText: img.altText,
		index,
		isExisting: true,
	}))

	const response = await fetch(`/products/${groupId}/${productId}`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			...updates,
			images: [...existingImageMapped, ...newImages],
		}),
	})

	return response.json()
}
```

---

## Error Handling

### Common Error Codes

| Status | Code           | Description                 |
| ------ | -------------- | --------------------------- |
| 400    | BAD_REQUEST    | Invalid request body/params |
| 401    | UNAUTHORIZED   | Missing/invalid auth token  |
| 404    | NOT_FOUND      | Resource not found          |
| 500    | INTERNAL_ERROR | Server error                |

### Error Response Format

```json
{
	"success": false,
	"error": {
		"message": "Product not found",
		"status": 404
	}
}
```

### Validation Errors

```json
{
	"success": false,
	"error": {
		"message": "Validation failed",
		"status": 400,
		"details": [
			{
				"field": "name",
				"message": "Required"
			},
			{
				"field": "price",
				"message": "Must be a number"
			}
		]
	}
}
```

---

## Best Practices

### 1. **Image Management**

-   ✅ Luôn set `index` cho ảnh để duy trì thứ tự
-   ✅ Sử dụng `isExisting: true` khi update để giữ ảnh cũ
-   ✅ Optimize ảnh trước khi upload (resize, compress)
-   ❌ Không upload ảnh quá lớn (>5MB)

### 2. **Performance**

-   ✅ Sử dụng pagination cho danh sách dài
-   ✅ Cache presigned URLs ở client (có thời hạn)
-   ✅ Upload ảnh song song khi có nhiều ảnh
-   ❌ Không fetch tất cả products 1 lúc

### 3. **Error Handling**

-   ✅ Luôn check `success` trong response
-   ✅ Handle network errors và timeouts
-   ✅ Show user-friendly error messages
-   ✅ Retry upload nếu thất bại

### 4. **Security**

-   ✅ Validate file types trước khi upload
-   ✅ Limit file size ở client
-   ✅ Sanitize user inputs
-   ❌ Không trust data từ server hoàn toàn

---

## Rate Limits

-   **Upload**: Tối đa 10 ảnh/request
-   **File size**: Tối đa 5MB/ảnh
-   **Requests**: 100 requests/minute/user

## Storage Information

-   **Image Storage**: Cloudflare R2
-   **CDN**: Custom domain với presigned URLs
-   **Retention**: Ảnh sẽ tự động cleanup khi không còn reference
-   **Formats**: JPG, PNG, WebP, GIF được support
