# API Documentation

This document provides documentation for the available APIs.

## Postman Collection

You can import the following JSON into Postman to test the APIs.

```json
{
	"info": {
		"_postman_id": "a6b1c4e7-9b3e-4b0e-8c1a-9c2d7f8e3d0a",
		"name": "WA BOT API",
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	},
	"item": [
		{
			"name": "Message",
			"item": [
				{
					"name": "/api/message/send",
					"request": {
						"method": "POST",
						"header": [],
						"body": {
							"mode": "raw",
							"raw": "{\n    \"contact_id\": \"\",\n    \"message\": \"\"\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{base_url}}/api/message/send",
							"host": [
								"{{base_url}}"
							],
							"path": [
								"api",
								"message",
								"send"
							]
						}
					},
					"response": []
				}
			]
		},
		{
			"name": "Schedule",
			"item": [
				{
					"name": "/api/schedule",
					"request": {
						"method": "POST",
						"header": [],
						"body": {
							"mode": "raw",
							"raw": "{\n    \"contactId\": \"\",\n    \"message\": \"\",\n    \"scheduledTime\": \"\",\n    \"creatorUserId\": \"\"\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{base_url}}/api/schedule",
							"host": [
								"{{base_url}}"
							],
							"path": [
								"api",
								"schedule"
							]
						}
					},
					"response": []
				},
				{
					"name": "/api/schedule",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{base_url}}/api/schedule",
							"host": [
								"{{base_url}}"
							],
							"path": [
								"api",
								"schedule"
							]
						}
					},
					"response": []
				},
				{
					"name": "/api/schedule/:id",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{base_url}}/api/schedule/1",
							"host": [
								"{{base_url}}"
							],
							"path": [
								"api",
								"schedule",
								"1"
							]
						}
					},
					"response": []
				},
				{
					"name": "/api/schedule/:id",
					"request": {
						"method": "PUT",
						"header": [],
						"body": {
							"mode": "raw",
							"raw": "{\n    \"message\": \"updated message\"\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{base_url}}/api/schedule/1",
							"host": [
								"{{base_url}}"
							],
							"path": [
								"api",
								"schedule",
								"1"
							]
						}
					},
					"response": []
				},
				{
					"name": "/api/schedule/:id",
					"request": {
						"method": "DELETE",
						"header": [],
						"url": {
							"raw": "{{base_url}}/api/schedule/1",
							"host": [
								"{{base_url}}"
							],
							"path": [
								"api",
								"schedule",
								"1"
							]
						}
					},
					"response": []
				}
			]
		}
	]
}
```

---

## Message API

### POST `/api/message/send`

Sends a message to a specific contact.

**Request Body:**

*   `contact_id` (string, required): The ID of the contact to send the message to.
*   `message` (string, required): The content of the message.

**Responses:**

*   `200 OK`: Message sent successfully.
    ```json
    {
        "success": true,
        "message_id": "..."
    }
    ```
*   `400 Bad Request`: Missing `contact_id` or `message` in the request body.
    ```json
    {
        "error": "Missing contact_id or message"
    }
    ```
*   `500 Internal Server Error`: Failed to send the message.

---

## Schedule API

### POST `/api/schedule`

Creates a new scheduled message.

**Request Body:**

*   `contactId` (string, required): The ID of the contact to send the message to.
*   `message` (string, required): The content of the message.
*   `scheduledTime` (string, required): The time to send the message in ISO 8601 format.
*   `creatorUserId` (string, required): The ID of the user who created the scheduled message.

**Responses:**

*   `201 Created`: The scheduled message was created successfully.
*   `400 Bad Request`: Missing required fields in the request body.
*   `500 Internal Server Error`: Failed to create the scheduled message.

### GET `/api/schedule`

Retrieves a list of all scheduled messages.

**Responses:**

*   `200 OK`: A list of scheduled messages.
*   `500 Internal Server Error`: Failed to fetch scheduled messages.

### GET `/api/schedule/:id`

Retrieves a specific scheduled message by its ID.

**URL Parameters:**

*   `id` (integer, required): The ID of the scheduled message.

**Responses:**

*   `200 OK`: The scheduled message object.
*   `404 Not Found`: The scheduled message with the specified ID was not found.
*   `500 Internal Server Error`: Failed to fetch the scheduled message.

### PUT `/api/schedule/:id`

Updates a specific scheduled message by its ID.

**URL Parameters:**

*   `id` (integer, required): The ID of the scheduled message.

**Request Body:**

*   Any of the fields from the scheduled message model can be included.

**Responses:**

*   `200 OK`: The updated scheduled message object.
*   `404 Not Found`: The scheduled message with the specified ID was not found.
*   `500 Internal Server Error`: Failed to update the scheduled message.

### DELETE `/api/schedule/:id`

Deletes a specific scheduled message by its ID.

**URL Parameters:**

*   `id` (integer, required): The ID of the scheduled message.

**Responses:**

*   `200 OK`: The scheduled message was deleted successfully.
    ```json
    {
        "success": true
    }
    ```
*   `404 Not Found`: The scheduled message with the specified ID was not found.
*   `500 Internal Server Error`: Failed to delete the scheduled message.
