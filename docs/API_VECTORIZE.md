# Vectorize Integration for Product Search

## Overview

The sale-chatbot-be API now includes Cloudflare Vectorize integration for semantic product search using the BAAI/bge-m3 embedding model. This enables intelligent product discovery based on natural language queries.

## Features

### 1. Automatic Embedding Generation

-   **Model**: `@cf/baai/bge-m3`
-   **Data Embedded**: `product_name + product_description + metadata (parsed key-value)`
-   **Metadata Stored**: `group_id`, `product_id`, `price`

### 2. Integrated CRUD Operations

All product operations now automatically manage vector embeddings:

#### Create Product (`POST /products/:groupId`)

-   Automatically generates and stores vector embedding
-   Embedding includes product name, description, and parsed metadata
-   Vector metadata includes: group_id, product_id, price

#### Update Product (`PUT /products/:groupId/:productId`)

-   Updates vector embedding when product data changes
-   Only updates embedding if name, description, price, or metadata fields are modified

#### Delete Product (`DELETE /products/:groupId/:productId`)

-   Automatically removes vector embedding from Vectorize index
-   Cleanup happens after successful product deletion

### 3. Semantic Search API

#### Endpoint: `POST /products/search`

**Request Body:**

```json
{
	"query": "smartphone with good camera",
	"topK": 10,
	"groupId": 1,
	"priceRange": {
		"min": 100,
		"max": 1000
	}
}
```

**Parameters:**

-   `query` (required): Natural language search query
-   `topK` (optional): Number of results to return (1-50, default: 10)
-   `groupId` (optional): Filter by product group
-   `priceRange` (optional): Filter by price range
    -   `min` (optional): Minimum price
    -   `max` (optional): Maximum price

**Response:**

```json
{
	"success": true,
	"data": [
		{
			"id": 1,
			"name": "iPhone 15 Pro",
			"description": "Latest smartphone with advanced camera system",
			"price": 999,
			"metadata": "{\"color\": \"Space Black\", \"storage\": \"256GB\"}",
			"product_group_id": 1,
			"similarityScore": 0.95,
			"imageUrls": [
				{
					"url": "image-key-1.jpg",
					"altText": "iPhone 15 Pro image 1",
					"index": 0,
					"presignedUrl": "https://r2-presigned-url..."
				}
			]
		}
	],
	"pagination": {
		"total": 5,
		"page": 1,
		"limit": 10
	}
}
```

## Vector Index Configuration

The Vectorize index `sale-chatbot-product-index` has the following metadata indexes:

| Property Name | Type   | Description                 |
| ------------- | ------ | --------------------------- |
| group_id      | Number | Product group identifier    |
| product_id    | Number | Product identifier          |
| price         | Number | Product price for filtering |

## Error Handling

The vectorize integration is designed to be resilient:

-   If embedding generation fails during product creation/update, the operation logs the error but doesn't fail
-   If vector deletion fails during product deletion, it logs the error but continues
-   Search errors are properly handled and returned as API errors

## Metadata Parsing

The system automatically parses product metadata for embedding:

-   JSON metadata is converted to "key: value" pairs
-   Non-JSON metadata is used as-is
-   Empty metadata is handled gracefully

## Example Usage

### 1. Create a Product (Auto-generates embedding)

```bash
POST /products/1
{
  "name": "MacBook Pro M3",
  "description": "Professional laptop with M3 chip",
  "price": 1999,
  "metadata": "{\"color\": \"Silver\", \"memory\": \"16GB\", \"storage\": \"512GB\"}",
  "images": []
}
```

### 2. Search for Similar Products

```bash
POST /products/search
{
  "query": "professional laptop for development",
  "topK": 5,
  "groupId": 1,
  "priceRange": {
    "min": 1000,
    "max": 3000
  }
}
```

### 3. Update Product (Auto-updates embedding)

```bash
PUT /products/1/1
{
  "name": "MacBook Pro M3 - Updated",
  "description": "Professional laptop with M3 chip and enhanced performance"
}
```

## Performance Considerations

-   Embedding generation adds ~500-1000ms to product operations
-   Search queries typically respond in 100-300ms
-   Vector operations are performed asynchronously where possible
-   Bulk operations should be batched for optimal performance

## Monitoring

Monitor the following for vector operations:

-   Console logs for embedding generation success/failure
-   Vector search performance metrics
-   Vectorize index usage and limits

## Development Notes

-   The vectorize integration uses the production index even in development mode
-   Vector IDs follow the pattern: `product_{productId}`
-   All vector operations include proper error handling and logging
