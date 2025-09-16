# AI Agents API Documentation

## Overview

API hệ thống AI Agent cho phép tạo, quản lý và sử dụng các AI Agent thông minh với khả năng Agentic RAG (Retrieval-Augmented Generation). Mỗi agent có thể được cấu hình với model AI, system prompt, và nguồn tri thức riêng.

## Base URL

```
https://sale-chatbot-be.tuanngoanbaoai.workers.dev
```

## Authentication

Sử dụng cookie-based authentication với `session-token`.

## Models Support

Hệ thống hỗ trợ các AI models sau:

-   `gpt-4.1-mini-2025-04-14`

---

## API Endpoints

### 1. Create AI Agent

Tạo một AI Agent mới với cấu hình tùy chỉnh.

**Endpoint:** `POST /ai`

**Request Body:**

```json
{
	"name": "string",
	"description": "string (optional)",
	"model": "gpt-4.1-mini-2025-04-14",
	"system_prompt": "string",
	"knowledge_source_group_id": "number (optional)",
	"top_k": "number (optional, default: 5)",
	"temperature": "number (optional, default: 70, range: 0-100)",
	"max_tokens": "number (optional, default: 5000)"
}
```

**Request Example:**

```json
{
	"name": "Tư vấn điện thoại",
	"description": "AI Agent chuyên tư vấn điện thoại và phụ kiện",
	"model": "gpt-4.1-mini-2025-04-14",
	"system_prompt": "Bạn là chuyên gia tư vấn điện thoại với nhiều năm kinh nghiệm...",
	"knowledge_source_group_id": 1,
	"top_k": 10,
	"temperature": 80,
	"max_tokens": 4000
}
```

**Response:**

```json
{
	"success": true,
	"data": {
		"id": 1,
		"name": "Tư vấn điện thoại",
		"description": "AI Agent chuyên tư vấn điện thoại và phụ kiện",
		"model": "gpt-4.1-mini-2025-04-14",
		"system_prompt": "Bạn là chuyên gia tư vấn điện thoại...",
		"knowledge_source_group_id": 1,
		"top_k": 10,
		"temperature": 80,
		"max_tokens": 4000,
		"created_by": 1,
		"created_at": "2025-01-16T10:30:00Z",
		"updated_at": "2025-01-16T10:30:00Z"
	}
}
```

**Status Codes:**

-   `201 Created` - Agent được tạo thành công
-   `400 Bad Request` - Dữ liệu đầu vào không hợp lệ
-   `401 Unauthorized` - Chưa đăng nhập
-   `500 Internal Server Error` - Lỗi server

---

### 2. Get All AI Agents

Lấy danh sách tất cả AI Agents.

**Endpoint:** `GET /ai`

**Response:**

```json
{
	"success": true,
	"data": [
		{
			"id": 1,
			"name": "Tư vấn điện thoại",
			"description": "AI Agent chuyên tư vấn điện thoại và phụ kiện",
			"model": "gpt-4.1-mini-2025-04-14",
			"system_prompt": "Bạn là chuyên gia tư vấn điện thoại...",
			"knowledge_source_group_id": 1,
			"knowledge_source_name": "Điện thoại & Phụ kiện",
			"top_k": 10,
			"temperature": 80,
			"max_tokens": 4000,
			"created_by": 1,
			"creator_name": "Admin User",
			"created_at": "2025-01-16T10:30:00Z",
			"updated_at": "2025-01-16T10:30:00Z"
		},
		{
			"id": 2,
			"name": "Tư vấn laptop",
			"description": "AI Agent chuyên tư vấn laptop gaming và văn phòng",
			"model": "gpt-4.1-mini-2025-04-14",
			"system_prompt": "Bạn là chuyên gia laptop...",
			"knowledge_source_group_id": 2,
			"knowledge_source_name": "Laptop & Máy tính",
			"top_k": 5,
			"temperature": 70,
			"max_tokens": 3000,
			"created_by": 1,
			"creator_name": "Admin User",
			"created_at": "2025-01-16T11:00:00Z",
			"updated_at": "2025-01-16T11:00:00Z"
		}
	],
	"total": 2
}
```

**Status Codes:**

-   `200 OK` - Lấy danh sách thành công
-   `401 Unauthorized` - Chưa đăng nhập
-   `500 Internal Server Error` - Lỗi server

---

### 3. Get AI Agent by ID

Lấy thông tin chi tiết của một AI Agent cụ thể.

**Endpoint:** `GET /ai/{agentId}`

**Path Parameters:**

-   `agentId` (number, required) - ID của AI Agent

**Response:**

```json
{
	"success": true,
	"data": {
		"id": 1,
		"name": "Tư vấn điện thoại",
		"description": "AI Agent chuyên tư vấn điện thoại và phụ kiện",
		"model": "gpt-4.1-mini-2025-04-14",
		"system_prompt": "Bạn là chuyên gia tư vấn điện thoại với nhiều năm kinh nghiệm trong ngành công nghệ...",
		"knowledge_source_group_id": 1,
		"knowledge_source_name": "Điện thoại & Phụ kiện",
		"top_k": 10,
		"temperature": 80,
		"max_tokens": 4000,
		"created_by": 1,
		"creator_name": "Admin User",
		"created_at": "2025-01-16T10:30:00Z",
		"updated_at": "2025-01-16T10:30:00Z"
	}
}
```

**Status Codes:**

-   `200 OK` - Lấy thông tin thành công
-   `404 Not Found` - Không tìm thấy agent
-   `401 Unauthorized` - Chưa đăng nhập
-   `500 Internal Server Error` - Lỗi server

---

### 4. Update AI Agent

Cập nhật thông tin của một AI Agent.

**Endpoint:** `PUT /ai/{agentId}`

**Path Parameters:**

-   `agentId` (number, required) - ID của AI Agent

**Request Body:**

```json
{
	"name": "string (optional)",
	"description": "string (optional)",
	"model": "string (optional)",
	"system_prompt": "string (optional)",
	"knowledge_source_group_id": "number (optional)",
	"top_k": "number (optional)",
	"temperature": "number (optional)",
	"max_tokens": "number (optional)"
}
```

**Request Example:**

```json
{
	"name": "Tư vấn điện thoại Pro",
	"description": "AI Agent chuyên tư vấn điện thoại cao cấp và phụ kiện",
	"temperature": 85,
	"max_tokens": 5000
}
```

**Response:**

```json
{
	"success": true,
	"data": {
		"id": 1,
		"name": "Tư vấn điện thoại Pro",
		"description": "AI Agent chuyên tư vấn điện thoại cao cấp và phụ kiện",
		"model": "gpt-4.1-mini-2025-04-14",
		"system_prompt": "Bạn là chuyên gia tư vấn điện thoại...",
		"knowledge_source_group_id": 1,
		"top_k": 10,
		"temperature": 85,
		"max_tokens": 5000,
		"created_by": 1,
		"created_at": "2025-01-16T10:30:00Z",
		"updated_at": "2025-01-16T12:00:00Z"
	}
}
```

**Status Codes:**

-   `200 OK` - Cập nhật thành công
-   `400 Bad Request` - Dữ liệu đầu vào không hợp lệ
-   `404 Not Found` - Không tìm thấy agent
-   `401 Unauthorized` - Chưa đăng nhập
-   `500 Internal Server Error` - Lỗi server

---

### 5. Delete AI Agent

Xóa một AI Agent.

**Endpoint:** `DELETE /ai/{agentId}`

**Path Parameters:**

-   `agentId` (number, required) - ID của AI Agent

**Response:**

```json
{
	"success": true,
	"message": "Agent deleted successfully"
}
```

**Status Codes:**

-   `200 OK` - Xóa thành công
-   `404 Not Found` - Không tìm thấy agent
-   `401 Unauthorized` - Chưa đăng nhập
-   `500 Internal Server Error` - Lỗi server

---

## AI Agent Configuration

### Model Parameters

| Parameter     | Type   | Range    | Default | Description                                            |
| ------------- | ------ | -------- | ------- | ------------------------------------------------------ |
| `top_k`       | number | 1-50     | 5       | Số lượng kết quả tìm kiếm tối đa                       |
| `temperature` | number | 0-100    | 70      | Độ sáng tạo của AI (0 = deterministic, 100 = creative) |
| `max_tokens`  | number | 100-8000 | 5000    | Số token tối đa trong response                         |

### Knowledge Source Groups

AI Agent có thể được liên kết với một nhóm sản phẩm cụ thể để giới hạn phạm vi tìm kiếm:

-   **Không set `knowledge_source_group_id`**: Agent có thể truy cập tất cả sản phẩm
-   **Set `knowledge_source_group_id`**: Agent chỉ tìm kiếm trong nhóm sản phẩm được chỉ định

### AI Agent Tools

Mỗi AI Agent được trang bị 3 công cụ chính:

1. **Structured Query Tool**: Tìm kiếm sản phẩm theo tiêu chí cụ thể (giá, tên, metadata)
2. **Semantic Search Tool**: Tìm kiếm bằng ngôn ngữ tự nhiên và độ tương đồng ngữ nghĩa
3. **Product Details Tool**: Lấy thông tin chi tiết về sản phẩm cụ thể

---

## Error Handling

### Standard Error Format

```json
{
	"success": false,
	"error": "Error message describing what went wrong",
	"code": "ERROR_CODE (optional)"
}
```

### Common Error Codes

| HTTP Status | Error Code        | Description                            |
| ----------- | ----------------- | -------------------------------------- |
| 400         | `INVALID_INPUT`   | Dữ liệu đầu vào không hợp lệ           |
| 401         | `UNAUTHORIZED`    | Chưa đăng nhập hoặc token không hợp lệ |
| 404         | `AGENT_NOT_FOUND` | Không tìm thấy AI Agent                |
| 500         | `INTERNAL_ERROR`  | Lỗi server nội bộ                      |

---

## Usage Examples

### Creating a Phone Consultant Agent

```bash
curl -X POST https://sale-chatbot-be.tuanngoanbaoai.workers.dev/api/ai \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=your-session-token" \
  -d '{
    "name": "Tư vấn điện thoại",
    "description": "Chuyên gia tư vấn điện thoại",
    "model": "gpt-4.1-mini-2025-04-14",
    "system_prompt": "Bạn là chuyên gia tư vấn điện thoại với 10 năm kinh nghiệm...",
    "knowledge_source_group_id": 1,
    "top_k": 10,
    "temperature": 80
  }'
```

### Getting All Agents

```bash
curl -X GET https://sale-chatbot-be.tuanngoanbaoai.workers.dev/api/ai \
  -H "Cookie: auth_token=your-session-token"
```

### Updating an Agent

```bash
curl -X PUT https://sale-chatbot-be.tuanngoanbaoai.workers.dev/api/ai/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=your-session-token" \
  -d '{
    "temperature": 90,
    "max_tokens": 6000
  }'
```

### Deleting an Agent

```bash
curl -X DELETE https://sale-chatbot-be.tuanngoanbaoai.workers.dev/api/ai/1 \
  -H "Cookie: auth_token=your-session-token"
```

---

## Best Practices

### System Prompt Guidelines

1. **Cụ thể và rõ ràng**: Mô tả vai trò và nhiệm vụ của agent
2. **Ngữ cảnh domain**: Bao gồm kiến thức chuyên môn về lĩnh vực
3. **Hướng dẫn tương tác**: Cách agent nên trả lời và tương tác
4. **Giới hạn phạm vi**: Rõ ràng về những gì agent có thể và không thể làm

### Model Selection

-   **gpt-4.1-mini-2025-04-14**: Phù hợp cho toàn bộ

### Performance Optimization

1. **Sử dụng knowledge_source_group_id**: Giới hạn phạm vi tìm kiếm để tăng tốc độ
2. **Điều chỉnh top_k**: Giảm để tăng tốc độ, tăng để có nhiều lựa chọn hơn
3. **Tối ưu system_prompt**: Ngắn gọn nhưng đầy đủ thông tin

---

## Version History

-   **v1.0.0** (2025-01-16): Initial release with CRUD operations for AI Agents
