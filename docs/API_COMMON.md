# Common API Documentation

## Overview

API quản lý thông tin cấu hình ứng dụng (App Info) với hệ thống key-value pairs. Hỗ trợ lưu trữ và cập nhật các thông tin cấu hình như thông tin shop, token API, và các thiết lập khác. Đặc biệt hỗ trợ tự động tạo webhook verify key cho Meta integration.

## Base URL

```
/common
```

## Authentication

Tất cả endpoints đều yêu cầu authentication token trong header:

```
Authorization: Bearer <your-jwt-token>
```

---

## API Endpoints

### 1. Get App Info

**GET** `/common`

Lấy tất cả thông tin cấu hình ứng dụng. Các thông tin private sẽ được mask với `********`.

#### Response

```json
{
	"success": true,
	"data": {
		"zalo": "0987654321",
		"shopName": "My Shop",
		"metaAccessToken": "********",
		"metaWebhookVerifyKey": "********"
	}
}
```

#### Response Fields

| Field                  | Type   | Description                      |
| ---------------------- | ------ | -------------------------------- |
| `zalo`                 | string | Số điện thoại Zalo của shop      |
| `shopName`             | string | Tên shop                         |
| `metaAccessToken`      | string | Meta access token (masked)       |
| `metaWebhookVerifyKey` | string | Meta webhook verify key (masked) |

### 2. Generate Webhook Verify Key

**POST** `/common/webhook-verify-key`

Tự động tạo và lưu webhook verify key mới. Key được tạo bằng `crypto.randomUUID()` và tự động cập nhật vào database.

#### Response

```json
{
	"success": true,
	"data": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

#### Response Fields

| Field  | Type   | Description                   |
| ------ | ------ | ----------------------------- |
| `data` | string | Webhook verify key mới (UUID) |

### 3. Update App Info

**PUT** `/common`

Cập nhật thông tin cấu hình ứng dụng. Chỉ cho phép cập nhật các key được định nghĩa trước.

#### Request Body

```json
{
	"zalo": "0987654321",
	"shopName": "Updated Shop Name",
	"metaAccessToken": "new_meta_token",
	"metaWebhookVerifyKey": "new_webhook_key"
}
```

#### Allowed Keys

| Key                    | Type   | Required | Description                 |
| ---------------------- | ------ | -------- | --------------------------- |
| `zalo`                 | string | ❌       | Số điện thoại Zalo của shop |
| `shopName`             | string | ❌       | Tên shop                    |
| `metaAccessToken`      | string | ❌       | Meta access token           |
| `metaWebhookVerifyKey` | string | ❌       | Meta webhook verify key     |

#### Validation Rules

-   Ít nhất một key-value pair phải được cung cấp
-   Chỉ các key trong danh sách allowed mới được chấp nhận
-   Tất cả values phải là string

#### Response

```json
{
	"success": true,
	"data": {
		"zalo": "https://zalo.me/new-zalo-link",
		"shopName": "Updated Shop Name",
		"metaAccessToken": "********",
		"metaWebhookVerifyKey": "********"
	}
}
```

---

## Data Structure

### App Info Table Schema

```sql
CREATE TABLE common_app_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    isPrivate BOOLEAN NOT NULL DEFAULT FALSE
);
```

### Key-Value Mapping

Hệ thống sử dụng cấu trúc key-value để lưu trữ cấu hình:

-   **Key**: Tên định danh của cấu hình
-   **Value**: Giá trị cấu hình
-   **isPrivate**: Đánh dấu thông tin nhạy cảm (sẽ được mask khi trả về)

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
		"message": "Failed to get app info: Database connection error",
		"status": 500
	}
}
```

### Validation Errors

```json
{
	"success": false,
	"error": {
		"message": "Only the following keys are allowed: zalo, shopName, metaAccessToken, metaWebhookVerifyKey",
		"status": 400
	}
}
```

---

## Usage Examples

### JavaScript/TypeScript

```javascript
// Get app info
async function getAppInfo() {
	const response = await fetch("/common", {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	})

	return response.json()
}

// Generate new webhook verify key
async function generateWebhookVerifyKey() {
	const response = await fetch("/common/webhook-verify-key", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	})

	return response.json()
}

// Update app info
async function updateAppInfo(updates) {
	const response = await fetch("/common", {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(updates),
	})

	return response.json()
}

// Example usage
const appInfo = await getAppInfo()
console.log("Shop Name:", appInfo.data.shopName)

// Generate new webhook verify key
const newKey = await generateWebhookVerifyKey()
console.log("New webhook verify key:", newKey.data)

await updateAppInfo({
	shopName: "New Shop Name",
	zalo: "0987654321",
})
```

### cURL Examples

```bash
# Get app info
curl -X GET "https://your-domain.com/common" \
  -H "Authorization: Bearer your-jwt-token"

# Generate new webhook verify key
curl -X POST "https://your-domain.com/common/webhook-verify-key" \
  -H "Authorization: Bearer your-jwt-token"

# Update app info
curl -X PUT "https://your-domain.com/common" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "shopName": "Updated Shop",
    "zalo": "0987654321"
  }'
```

---

## Security Considerations

### 1. **Private Data Masking**

-   Các trường có `isPrivate: true` sẽ được mask với `********`
-   Điều này bảo vệ thông tin nhạy cảm như tokens và keys

### 2. **Key Validation**

-   Chỉ cho phép cập nhật các key được định nghĩa trước
-   Ngăn chặn injection các key không mong muốn

### 3. **Authentication Required**

-   Tất cả endpoints đều yêu cầu JWT token hợp lệ
-   Token phải có quyền truy cập hệ thống

---

## Best Practices

### 1. **Data Management**

-   ✅ Luôn validate dữ liệu trước khi gửi request
-   ✅ Sử dụng HTTPS cho tất cả requests
-   ✅ Lưu trữ JWT token an toàn
-   ✅ Sử dụng endpoint tự động tạo webhook verify key
-   ❌ Không hardcode sensitive data trong client code
-   ❌ Không tự tạo webhook verify key thủ công

### 2. **Error Handling**

-   ✅ Luôn check `success` field trong response
-   ✅ Handle network errors và timeouts
-   ✅ Show user-friendly error messages
-   ✅ Log errors cho debugging

### 3. **Performance**

-   ✅ Cache app info ở client khi có thể
-   ✅ Chỉ update các field cần thiết
-   ✅ Sử dụng debounce cho real-time updates
-   ❌ Không gọi API liên tục không cần thiết

---

## Integration Notes

### AI Agent Context

App info được sử dụng để cung cấp context cho AI agents:

```javascript
// Get LLM app context (only public info)
const appContext = await getLLMAppContext()
// Returns: "zalo: https://zalo.me/123\nshopName: My Shop"
```

### Meta Integration

Các trường `metaAccessToken` và `metaWebhookVerifyKey` được sử dụng cho:

-   Meta webhook verification
-   Meta API calls
-   Facebook/Instagram integration

#### Webhook Verify Key Management

-   **Tự động tạo**: Sử dụng endpoint `POST /common/webhook-verify-key` để tạo key mới
-   **Bảo mật**: Key được tạo bằng `crypto.randomUUID()` đảm bảo tính ngẫu nhiên cao
-   **Tự động lưu**: Key mới được tự động cập nhật vào database
-   **Không cần nhập tay**: Loại bỏ việc người dùng phải tự tạo và nhập key

---

## Rate Limits

-   **Read operations**: 100 requests/minute/user
-   **Write operations**: 50 requests/minute/user
-   **Burst limit**: 10 requests/second

## Storage Information

-   **Database**: SQLite (Cloudflare D1)
-   **Backup**: Automatic daily backups
-   **Retention**: Data được lưu trữ vĩnh viễn
-   **Encryption**: At-rest encryption enabled
