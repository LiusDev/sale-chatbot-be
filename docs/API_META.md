# Meta API Documentation

## Overview

API quản lý tích hợp Meta (Facebook/Instagram) bao gồm việc lấy danh sách fanpages từ Meta API và lưu trữ thông tin các trang trong database. Hỗ trợ đồng bộ hóa dữ liệu fanpages, conversations, và messages giữa Meta và hệ thống nội bộ.

## Base URL

```
/meta
```

## Authentication

Tất cả endpoints (trừ webhook endpoints) đều yêu cầu authentication token trong header:

```
Authorization: Bearer <your-jwt-token>
```

---

## API Endpoints

### 1. Webhook Endpoints

#### GET `/meta/webhook`

Webhook verification endpoint for Meta webhook setup. Meta sẽ gọi endpoint này để verify webhook URL.

##### Query Parameters

| Parameter          | Type   | Required | Description              |
| ------------------ | ------ | -------- | ------------------------ |
| `hub.mode`         | string | ✅       | Should be "subscribe"    |
| `hub.challenge`    | string | ✅       | Challenge string từ Meta |
| `hub.verify_token` | string | ✅       | Verify token để xác thực |

##### Response

```
<challenge_string>
```

Returns the challenge string if verification is successful.

##### Error Response

```json
{
	"message": "Verify failed"
}
```

#### POST `/meta/webhook`

Webhook endpoint để nhận events từ Meta (messages, conversations, etc.).

##### Headers

```
Content-Type: application/json
X-Hub-Signature-256: sha256=<signature>
```

##### Request Body

```json
{
	"object": "page",
	"entry": [
		{
			"id": "PAGE_ID",
			"time": 1234567890,
			"messaging": [
				{
					"sender": {
						"id": "USER_ID"
					},
					"recipient": {
						"id": "PAGE_ID"
					},
					"timestamp": 1234567890,
					"message": {
						"mid": "MESSAGE_ID",
						"text": "Hello World"
					}
				}
			]
		}
	]
}
```

##### Response

```json
{
	"message": "Webhook received"
}
```

### 2. Get Meta Fanpages

**GET** `/meta/meta-pages`

Lấy danh sách tất cả fanpages từ Meta API. Endpoint này gọi trực tiếp đến Meta Graph API để lấy thông tin real-time về các trang mà user có quyền quản lý.

#### Response

```json
{
	"success": true,
	"data": [
		{
			"id": "123456789012345",
			"name": "My Business Page",
			"accessToken": "EAAxxxxxxxxxxxxxxx",
			"category": "Business"
		},
		{
			"id": "987654321098765",
			"name": "My Shop Page",
			"accessToken": "EAAyyyyyyyyyyyyyy",
			"category": "Shopping/Retail"
		}
	],
	"meta": {
		"total": 2,
		"page": 1,
		"limit": 50
	}
}
```

#### Response Fields

| Field         | Type   | Description            |
| ------------- | ------ | ---------------------- |
| `id`          | string | Meta Page ID           |
| `name`        | string | Tên trang              |
| `accessToken` | string | Access token của trang |
| `category`    | string | Danh mục trang         |

#### Error Responses

```json
{
	"message": "Failed to fetch fanpages from Meta",
	"error": "Meta access token not found. Please configure metaAccessToken in app settings."
}
```

### 3. Get Stored Pages

**GET** `/meta/pages`

Lấy danh sách các trang đã được lưu trữ trong database. Đây là dữ liệu local, có thể khác với dữ liệu real-time từ Meta API.

#### Response

```json
{
	"success": true,
	"data": [
		{
			"id": "123456789012345",
			"name": "My Business Page",
			"access_token": "EAAxxxxxxxxxxxxxxx",
			"category": "Business"
		},
		{
			"id": "987654321098765",
			"name": "My Shop Page",
			"access_token": "EAAyyyyyyyyyyyyyy",
			"category": "Shopping/Retail"
		}
	],
	"meta": {
		"total": 2,
		"page": 1,
		"limit": 50
	}
}
```

#### Response Fields

| Field          | Type   | Description            |
| -------------- | ------ | ---------------------- |
| `id`           | string | Meta Page ID           |
| `name`         | string | Tên trang              |
| `access_token` | string | Access token của trang |
| `category`     | string | Danh mục trang         |

### 4. Get Page Conversations

**GET** `/meta/pages/:pageId`

Lấy danh sách tất cả conversations của một trang Meta từ database.

#### Path Parameters

| Parameter | Type   | Required | Description  |
| --------- | ------ | -------- | ------------ |
| `pageId`  | string | ✅       | Meta Page ID |

#### Response

```json
{
	"success": true,
	"data": [
		{
			"id": "t_123456789012345",
			"page_id": "123456789012345",
			"recipientId": "USER_ID_123",
			"recipientName": "John Doe",
			"agentmode": "auto",
			"isConfirmOrder": false
		}
	],
	"meta": {
		"total": 1,
		"page": 1,
		"limit": 99
	}
}
```

#### Response Fields

| Field            | Type    | Description                 |
| ---------------- | ------- | --------------------------- |
| `id`             | string  | Conversation ID             |
| `page_id`        | string  | Meta Page ID                |
| `recipientId`    | string  | ID của người nhận tin nhắn  |
| `recipientName`  | string  | Tên của người nhận tin nhắn |
| `agentmode`      | string  | Agent mode (auto/manual)    |
| `isConfirmOrder` | boolean | Order confirmation status   |

### 5. Upsert Meta Pages

**PATCH** `/meta/pages`

Thêm mới hoặc cập nhật thông tin các trang Meta vào database. Nếu trang đã tồn tại (dựa trên page_id), sẽ cập nhật thông tin. Nếu chưa tồn tại, sẽ tạo mới.

### 6. Get Conversation Messages

**GET** `/meta/pages/:pageId/:conversationId`

Lấy danh sách tất cả messages trong một conversation từ database, được sắp xếp theo thời gian giảm dần.

#### Path Parameters

| Parameter        | Type   | Required | Description     |
| ---------------- | ------ | -------- | --------------- |
| `pageId`         | string | ✅       | Meta Page ID    |
| `conversationId` | string | ✅       | Conversation ID |

#### Response

```json
{
	"success": true,
	"data": [
		{
			"id": "m_987654321098765",
			"conversation_id": "t_123456789012345",
			"created_time": "2024-01-15T10:30:00.000Z",
			"message": "Hello, I need help with my order",
			"from": {
				"name": "John Doe",
				"id": "USER_ID_123"
			},
			"attachments": null
		},
		{
			"id": "m_123456789012345",
			"conversation_id": "t_123456789012345",
			"created_time": "2024-01-15T10:25:00.000Z",
			"message": "Hi! How can I assist you today?",
			"from": {
				"name": "My Business Page",
				"id": "123456789012345"
			},
			"attachments": null
		}
	],
	"meta": {
		"total": 2,
		"page": 1,
		"limit": 99
	}
}
```

#### Response Fields

| Field             | Type   | Description                      |
| ----------------- | ------ | -------------------------------- |
| `id`              | string | Message ID                       |
| `conversation_id` | string | Conversation ID                  |
| `created_time`    | string | Thời gian tạo message (ISO 8601) |
| `message`         | string | Nội dung tin nhắn                |
| `from`            | object | Thông tin người gửi              |
| `attachments`     | object | File đính kèm (nếu có)           |

### 7. Send Message to Conversation

**POST** `/meta/pages/:pageId/:conversationId`

Gửi tin nhắn đến một conversation thông qua Meta API và lưu vào database.

#### Path Parameters

| Parameter        | Type   | Required | Description     |
| ---------------- | ------ | -------- | --------------- |
| `pageId`         | string | ✅       | Meta Page ID    |
| `conversationId` | string | ✅       | Conversation ID |

#### Request Body

```json
{
	"message": "Thank you for your message. How can I help you?"
}
```

#### Response

```json
{
	"success": true,
	"data": null
}
```

#### Error Responses

```json
{
	"success": false,
	"error": {
		"message": "Conversation not found",
		"status": 404
	}
}
```

```json
{
	"success": false,
	"error": {
		"message": "Failed to send message to Meta",
		"status": 500
	}
}
```

### 8. Sync Page Conversations

**PATCH** `/meta/pages/:pageId/sync`

Đồng bộ hóa tất cả conversations và messages của một trang Meta từ Meta API vào database. Endpoint này sẽ:

1. Xóa tất cả conversations cũ của trang
2. Lấy danh sách conversations mới từ Meta API
3. Insert conversations và messages vào database

#### Path Parameters

| Parameter | Type   | Required | Description  |
| --------- | ------ | -------- | ------------ |
| `pageId`  | string | ✅       | Meta Page ID |

#### Response

```json
{
	"success": true,
	"data": [
		{
			"id": "t_123456789012345",
			"page_id": "123456789012345",
			"agentmode": "auto",
			"recipientId": "USER_ID_123",
			"recipientName": "John Doe",
			"isConfirmOrder": false
		}
	]
}
```

#### Response Fields

| Field            | Type    | Description                 |
| ---------------- | ------- | --------------------------- |
| `id`             | string  | Conversation ID             |
| `page_id`        | string  | Meta Page ID                |
| `agentmode`      | string  | Agent mode (auto/manual)    |
| `recipientId`    | string  | ID của người nhận tin nhắn  |
| `recipientName`  | string  | Tên của người nhận tin nhắn |
| `isConfirmOrder` | boolean | Order confirmation status   |

#### Error Responses

```json
{
	"success": false,
	"error": {
		"message": "Failed to sync page conversations",
		"status": 500
	}
}
```

### 9. Delete Meta Page

**DELETE** `/meta/pages/:pageId`

Xóa một trang Meta khỏi database dựa trên page_id.

#### Path Parameters

| Parameter | Type   | Required | Description  |
| --------- | ------ | -------- | ------------ |
| `pageId`  | string | ✅       | Meta Page ID |

#### Response

```json
{
	"success": true,
	"data": null
}
```

#### Error Responses

```json
{
	"success": false,
	"error": {
		"message": "Failed to delete page",
		"status": 500
	}
}
```

---

## Data Structure

### Meta Pages Table Schema

```sql
CREATE TABLE meta_pages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    access_token TEXT,
    category TEXT
);
```

### Meta Page Conversations Table Schema

```sql
CREATE TABLE meta_page_conversations (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL REFERENCES meta_pages(id) ON DELETE CASCADE,
    agentmode TEXT NOT NULL DEFAULT 'auto',
    recipientId TEXT,
    recipientName TEXT,
    isConfirmOrder INTEGER NOT NULL DEFAULT 0
);
```

### Meta Page Conversation Messages Table Schema

```sql
CREATE TABLE meta_page_conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES meta_page_conversations(id) ON DELETE CASCADE,
    created_time TEXT NOT NULL,
    message TEXT NOT NULL,
    from TEXT NOT NULL, -- JSON object
    attachments TEXT -- JSON object
);
```

### Meta Fanpage Types

```typescript
interface MetaFanpage {
	access_token: string
	category: string
	category_list: {
		id: string
		name: string
	}[]
	name: string
	id: string
	tasks: string[]
}

interface MetaFanpageList {
	data: MetaFanpage[]
	paging: {
		cursors: {
			before: string
			after: string
		}
	}
}

interface MetaPage {
	id: string
	name: string
	access_token?: string
	category?: string
}

interface MetaPageConversation {
	id: string
	page_id: string
	recipientId?: string
	recipientName?: string
	agentmode: string
	isConfirmOrder: boolean
}

interface MetaPageConversationMessage {
	id: string
	conversation_id: string
	created_time: string
	message: string
	from: {
		name: string
		id: string
	}
	attachments?: any
}

interface MetaWebhookPayload {
	object: string
	entry: Array<{
		id: string
		time: number
		messaging?: Array<{
			sender: {
				id: string
			}
			recipient: {
				id: string
			}
			timestamp: number
			message?: {
				mid: string
				text: string
				attachments?: any
			}
		}>
	}>
}
```

---

## Error Handling

### Common Error Codes

| Status | Code           | Description                 |
| ------ | -------------- | --------------------------- |
| 400    | BAD_REQUEST    | Invalid request body/params |
| 401    | UNAUTHORIZED   | Missing/invalid auth token  |
| 500    | INTERNAL_ERROR | Server error                |

### Error Response Format

```json
{
	"success": false,
	"error": {
		"message": "Failed to fetch fanpages from Meta",
		"status": 500
	}
}
```

### Validation Errors

```json
{
	"success": false,
	"error": {
		"message": "Page ID is required",
		"status": 400
	}
}
```

### Meta API Errors

```json
{
	"message": "Failed to fetch fanpages from Meta",
	"error": "Meta access token not found. Please configure metaAccessToken in app settings."
}
```

---

## Usage Examples

### JavaScript/TypeScript

```javascript
// Get fanpages from Meta API
async function getMetaFanpages() {
	const response = await fetch("/meta/meta-pages", {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	})

	return response.json()
}

// Get stored pages from database
async function getStoredPages() {
	const response = await fetch("/meta/pages", {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	})

	return response.json()
}

// Sync pages to database
async function syncMetaPages(pages) {
	const response = await fetch("/meta/pages", {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(pages),
	})

	return response.json()
}

// Sync page conversations
async function syncPageConversations(pageId) {
	const response = await fetch(`/meta/pages/${pageId}/sync`, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	})

	return response.json()
}

// Get page conversations
async function getPageConversations(pageId) {
	const response = await fetch(`/meta/pages/${pageId}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	})

	return response.json()
}

// Get conversation messages
async function getConversationMessages(pageId, conversationId) {
	const response = await fetch(`/meta/pages/${pageId}/${conversationId}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	})

	return response.json()
}

// Send message to conversation
async function sendMessageToConversation(pageId, conversationId, message) {
	const response = await fetch(`/meta/pages/${pageId}/${conversationId}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ message }),
	})

	return response.json()
}

// Delete a page from database
async function deleteMetaPage(pageId) {
	const response = await fetch(`/meta/pages/${pageId}`, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	})

	return response.json()
}

// Example usage: Sync Meta fanpages to database
const fanpages = await getMetaFanpages()
const pagesToSync = fanpages.data.map((page) => ({
	id: page.id,
	name: page.name,
	accessToken: page.accessToken,
	category: page.category,
}))

const result = await syncMetaPages(pagesToSync)
console.log("Synced pages:", result.data)

// Example usage: Sync conversations for a page
const syncResult = await syncPageConversations("123456789012345")
console.log("Synced conversations:", syncResult.data)

// Example usage: Get page conversations
const conversations = await getPageConversations("123456789012345")
console.log("Page conversations:", conversations.data)

// Example usage: Get conversation messages
const messages = await getConversationMessages(
	"123456789012345",
	"t_123456789012345"
)
console.log("Conversation messages:", messages.data)

// Example usage: Send message to conversation
const sendResult = await sendMessageToConversation(
	"123456789012345",
	"t_123456789012345",
	"Thank you for your message. How can I help you?"
)
console.log("Message sent:", sendResult)

// Example usage: Delete a page
const deleteResult = await deleteMetaPage("123456789012345")
console.log("Delete result:", deleteResult)
```

### cURL Examples

```bash
# Get fanpages from Meta API
curl -X GET "https://your-domain.com/meta/meta-pages" \
  -H "Authorization: Bearer your-jwt-token"

# Get stored pages
curl -X GET "https://your-domain.com/meta/pages" \
  -H "Authorization: Bearer your-jwt-token"

# Sync pages to database
curl -X PATCH "https://your-domain.com/meta/pages" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": "123456789012345",
      "name": "My Business Page",
      "accessToken": "EAAxxxxxxxxxxxxxxx",
      "category": "Business"
    }
  ]'

# Sync page conversations
curl -X PATCH "https://your-domain.com/meta/pages/123456789012345/sync" \
  -H "Authorization: Bearer your-jwt-token"

# Get page conversations
curl -X GET "https://your-domain.com/meta/pages/123456789012345" \
  -H "Authorization: Bearer your-jwt-token"

# Get conversation messages
curl -X GET "https://your-domain.com/meta/pages/123456789012345/t_123456789012345" \
  -H "Authorization: Bearer your-jwt-token"

# Send message to conversation
curl -X POST "https://your-domain.com/meta/pages/123456789012345/t_123456789012345" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Thank you for your message. How can I help you?"
  }'

# Delete a page
curl -X DELETE "https://your-domain.com/meta/pages/123456789012345" \
  -H "Authorization: Bearer your-jwt-token"
```

---

## Integration Notes

### Meta API Requirements

Để sử dụng Meta API endpoints, cần cấu hình:

1. **Meta Access Token**: Lưu trong `common_app_info` với key `metaAccessToken`
2. **App Secret**: Lưu trong `common_app_info` với key `metaAppSecret`
3. **Webhook Verify Key**: Lưu trong `common_app_info` với key `metaWebhookVerifyKey`

### Data Synchronization

-   **Real-time data**: `/meta-pages` endpoint lấy dữ liệu trực tiếp từ Meta API
-   **Local data**: `/pages` endpoint lấy dữ liệu từ database local
-   **Sync process**: Sử dụng `/meta/pages` PATCH để đồng bộ dữ liệu
-   **Conversations sync**: Sử dụng `/meta/pages/:pageId/sync` PATCH để đồng bộ conversations và messages
-   **Conversation management**: Sử dụng `/meta/pages/:pageId` GET để lấy danh sách conversations
-   **Message management**: Sử dụng `/meta/pages/:pageId/:conversationId` GET để lấy messages
-   **Message sending**: Sử dụng `/meta/pages/:pageId/:conversationId` POST để gửi tin nhắn
-   **Delete process**: Sử dụng `/meta/pages/:pageId` DELETE để xóa trang

### Webhook Integration

-   **Webhook verification**: Meta sẽ gọi GET `/meta/webhook` để verify webhook URL
-   **Webhook events**: Meta sẽ gửi events đến POST `/meta/webhook` khi có tin nhắn mới
-   **Signature verification**: Tất cả webhook requests đều được verify signature
-   **Event processing**: Webhook events được log và có thể được xử lý để update database

### Access Token Management

-   Mỗi fanpage có access token riêng
-   Access token được lưu trữ an toàn trong database
-   Token có thể được refresh thông qua Meta API

---

## Security Considerations

### 1. **Access Token Protection**

-   Access token được lưu trữ trong database với encryption
-   Không log access token trong console hoặc logs
-   Sử dụng HTTPS cho tất cả API calls

### 2. **Authentication Required**

-   Tất cả endpoints đều yêu cầu JWT token hợp lệ
-   Token phải có quyền truy cập hệ thống

### 3. **Meta API Security**

-   Validate Meta webhook signatures
-   Sử dụng secure tokens và secrets
-   Implement proper error handling cho Meta API calls

---

## Best Practices

### 1. **Data Management**

-   ✅ Sync dữ liệu định kỳ để đảm bảo consistency
-   ✅ Validate dữ liệu trước khi lưu vào database
-   ✅ Handle Meta API rate limits
-   ✅ Xóa dữ liệu không cần thiết để tiết kiệm storage
-   ✅ Sử dụng pagination cho conversations và messages
-   ✅ Sort messages theo thời gian để hiển thị đúng thứ tự
-   ❌ Không cache access token quá lâu
-   ❌ Không gửi tin nhắn quá thường xuyên để tránh spam

### 2. **Error Handling**

-   ✅ Handle Meta API errors gracefully
-   ✅ Provide meaningful error messages
-   ✅ Log errors cho debugging
-   ✅ Implement retry logic cho Meta API calls

### 3. **Performance**

-   ✅ Cache Meta fanpages data khi có thể
-   ✅ Sử dụng pagination cho large datasets
-   ✅ Batch operations khi sync nhiều pages
-   ✅ Sử dụng database indexes cho conversations và messages
-   ❌ Không gọi Meta API quá thường xuyên

### 4. **Webhook Management**

-   ✅ Verify webhook signature để đảm bảo security
-   ✅ Handle webhook events idempotently
-   ✅ Log webhook events để debugging
-   ✅ Respond quickly (under 20 seconds) để tránh timeout
-   ❌ Không xử lý heavy operations trong webhook handler

---

## Rate Limits

-   **Meta API**: Theo giới hạn của Meta Graph API
-   **Database operations**: 100 requests/minute/user
-   **Burst limit**: 10 requests/second
-   **Webhook processing**: 1000 requests/minute
-   **Message sending**: 100 messages/minute/page

## Storage Information

-   **Database**: SQLite (Cloudflare D1)
-   **Backup**: Automatic daily backups
-   **Retention**: Data được lưu trữ vĩnh viễn
-   **Encryption**: At-rest encryption enabled
-   **Meta API**: Real-time data từ Facebook Graph API v23.0
