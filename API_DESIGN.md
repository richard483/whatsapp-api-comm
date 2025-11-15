# WhatsApp Bot API Design

## Authentication
All endpoints require an API key in the `x-api-key` header. API keys can be generated/revoked via dedicated endpoints.

## Endpoints

### 1. Send Message
**POST /api/message/send**
Send a plain text message to a contact immediately.
- Request:
```json
{
  "contact_id": "string", // Contact.id from DB
  "message": "string"
}
```
- Response:
```json
{
  "success": true,
  "message_id": "string"
}
```
- Error: `{ "error": "description" }`

### 2. Schedule Message
**POST /api/schedule**
Schedule a plain text message to a contact at a specific time (ISO 8601, with timezone).
- Request:
```json
{
  "contact_id": "string",
  "message": "string",
  "scheduled_time": "2025-11-14T10:00:00+07:00"
}
```
- Response:
```json
{
  "success": true,
  "schedule_id": "string"
}
```
- Error: `{ "error": "description" }`

### 3. List Scheduled Messages
**GET /api/schedule**
List all scheduled messages for the API key.
- Response:
```json
[
  {
    "schedule_id": "string",
    "contact_id": "string",
    "message": "string",
    "scheduled_time": "2025-11-14T10:00:00+07:00",
    "status": "pending|sent|failed"
  }
]
```
- Error: `{ "error": "description" }`

### 4. Get Scheduled Message
**GET /api/schedule/{id}**
Get details of a scheduled message.
- Response:
```json
{
  "schedule_id": "string",
  "contact_id": "string",
  "message": "string",
  "scheduled_time": "2025-11-14T10:00:00+07:00",
  "status": "pending|sent|failed"
}
```
- Error: `{ "error": "description" }`

### 5. Update Scheduled Message
**PUT /api/schedule/{id}**
Update message or scheduled time (if not yet sent).
- Request:
```json
{
  "message": "string", // optional
  "scheduled_time": "2025-11-14T11:00:00+07:00" // optional
}
```
- Response:
```json
{
  "success": true
}
```
- Error: `{ "error": "description" }`

### 6. Delete Scheduled Message
**DELETE /api/schedule/{id}**
Delete a scheduled message (if not yet sent).
- Response:
```json
{
  "success": true
}
```
- Error: `{ "error": "description" }`

### 7. API Key Management
**POST /api/key/generate**
Generate a new API key
- Response: `{ "api_key": "string" }`

**POST /api/key/revoke**
Revoke an API key
- Request: `{ "api_key": "string" }`
- Response: `{ "success": true }`

## Error Handling
All errors return `{ "error": "description" }` with appropriate HTTP status codes (400, 401, 404, 500).

## Notes
- All times must be in ISO 8601 format with timezone.
- Only plain text messages and individual contacts are supported for now.
