package server

import (
	"encoding/json"
	"net/http"
)

func schemaRef(name string) map[string]interface{} {
	return map[string]interface{}{"$ref": "#/components/schemas/" + name}
}

func bearerSecurity() []map[string][]string {
	return []map[string][]string{{"BearerAuth": {}}}
}

func jsonResponse(description string, schema map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"description": description,
		"content": map[string]interface{}{
			"application/json": map[string]interface{}{"schema": schema},
		},
	}
}

func textResponse(description string) map[string]interface{} {
	return map[string]interface{}{
		"description": description,
		"content": map[string]interface{}{
			"text/plain": map[string]interface{}{
				"schema": map[string]interface{}{"type": "string"},
			},
		},
	}
}

func jsonRequestBody(schema map[string]interface{}, required bool, example interface{}) map[string]interface{} {
	content := map[string]interface{}{"schema": schema}
	if example != nil {
		content["example"] = example
	}
	return map[string]interface{}{
		"required": required,
		"content": map[string]interface{}{
			"application/json": content,
		},
	}
}

func pathParam(name, description string) map[string]interface{} {
	return map[string]interface{}{
		"name":        name,
		"in":          "path",
		"required":    true,
		"description": description,
		"schema": map[string]interface{}{
			"type":    "string",
			"example": "example-id",
		},
	}
}

func queryParam(name, description, schemaType string, example interface{}) map[string]interface{} {
	schema := map[string]interface{}{"type": schemaType}
	if example != nil {
		schema["example"] = example
	}
	return map[string]interface{}{
		"name":        name,
		"in":          "query",
		"required":    false,
		"description": description,
		"schema":      schema,
	}
}

func openAPISpec() map[string]interface{} {
	schemas := map[string]interface{}{
		"AuthPayload": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"name":     map[string]interface{}{"type": "string", "example": "Alex Johnson"},
				"email":    map[string]interface{}{"type": "string", "format": "email", "example": "alex@example.com"},
				"password": map[string]interface{}{"type": "string", "format": "password", "example": "supersecret123"},
				"role":     map[string]interface{}{"type": "string", "enum": []string{"customer", "agent", "admin"}, "example": "agent"},
			},
			"required": []string{"email", "password"},
		},
		"MessageResponse": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"message": map[string]interface{}{"type": "string", "example": "User created successfully"},
				"id":      map[string]interface{}{"type": "string", "example": "7ae70d3d-5008-4277-8f18-6376ce5e43b6"},
			},
		},
		"AuthTokenResponse": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"token": map[string]interface{}{"type": "string", "example": "eyJhbGciOiJI..."},
			},
		},
		"CustomerChatSessionResponse": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"conversation_id": map[string]interface{}{"type": "string"},
			},
		},
		"PublicSettings": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"assistant_name": map[string]interface{}{"type": "string", "example": "AI Agent"},
				"brand_name":     map[string]interface{}{"type": "string", "example": "AICM Support"},
				"accent_color":   map[string]interface{}{"type": "string", "example": "#2563EB"},
			},
		},
		"CustomerOverview": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"profile": schemaRef("User"),
				"conversations": map[string]interface{}{
					"type": "array",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"id":                    map[string]interface{}{"type": "string"},
							"source":                map[string]interface{}{"type": "string", "enum": []string{"web", "email"}},
							"subject":               map[string]interface{}{"type": "string", "nullable": true},
							"status":                map[string]interface{}{"type": "string"},
							"created_at":            map[string]interface{}{"type": "string", "format": "date-time"},
							"updated_at":            map[string]interface{}{"type": "string", "format": "date-time"},
							"customer_last_read_at": map[string]interface{}{"type": "string", "format": "date-time", "nullable": true},
							"agent_last_read_at":    map[string]interface{}{"type": "string", "format": "date-time", "nullable": true},
							"preview":               map[string]interface{}{"type": "string"},
							"last_sender_name":      map[string]interface{}{"type": "string"},
							"last_sender_role":      map[string]interface{}{"type": "string"},
						},
					},
				},
				"tickets": map[string]interface{}{
					"type":  "array",
					"items": schemaRef("Ticket"),
				},
				"recent_notifications": map[string]interface{}{
					"type":  "array",
					"items": schemaRef("TicketNotification"),
				},
				"stats": map[string]interface{}{
					"type": "object",
					"additionalProperties": map[string]interface{}{
						"type": "integer",
					},
				},
			},
		},
		"User": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":         map[string]interface{}{"type": "string"},
				"role":       map[string]interface{}{"type": "string", "enum": []string{"customer", "agent", "admin"}},
				"name":       map[string]interface{}{"type": "string"},
				"email":      map[string]interface{}{"type": "string", "format": "email"},
				"created_at": map[string]interface{}{"type": "string", "format": "date-time"},
			},
		},
		"Conversation": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":                    map[string]interface{}{"type": "string"},
				"customer_id":           map[string]interface{}{"type": "string"},
				"assignee_id":           map[string]interface{}{"type": "string", "nullable": true},
				"source":                map[string]interface{}{"type": "string", "enum": []string{"web", "email"}, "example": "web"},
				"subject":               map[string]interface{}{"type": "string", "nullable": true, "example": "Still waiting for password reset email"},
				"status":                map[string]interface{}{"type": "string", "enum": []string{"open", "pending", "resolved", "snoozed"}},
				"created_at":            map[string]interface{}{"type": "string", "format": "date-time"},
				"updated_at":            map[string]interface{}{"type": "string", "format": "date-time"},
				"customer_last_read_at": map[string]interface{}{"type": "string", "format": "date-time", "nullable": true},
				"agent_last_read_at":    map[string]interface{}{"type": "string", "format": "date-time", "nullable": true},
				"ai_confidence_score":   map[string]interface{}{"type": "number", "example": 0.82},
				"ai_confidence_label":   map[string]interface{}{"type": "string", "enum": []string{"unknown", "none", "low", "medium", "high"}, "example": "high"},
				"ai_last_outcome":       map[string]interface{}{"type": "string", "enum": []string{"unknown", "answered", "escalated", "unanswered"}, "example": "answered"},
				"ai_source_title":       map[string]interface{}{"type": "string", "nullable": true, "example": "Refund Policy"},
				"tags":                  map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}, "example": []string{"billing", "vip"}},
				"customer_name":         map[string]interface{}{"type": "string"},
				"preview":               map[string]interface{}{"type": "string"},
			},
		},
		"Message": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":              map[string]interface{}{"type": "string"},
				"conversation_id": map[string]interface{}{"type": "string"},
				"sender_id":       map[string]interface{}{"type": "string"},
				"content":         map[string]interface{}{"type": "string"},
				"is_ai_generated": map[string]interface{}{"type": "boolean"},
				"is_internal":     map[string]interface{}{"type": "boolean"},
				"created_at":      map[string]interface{}{"type": "string", "format": "date-time"},
				"sender_name":     map[string]interface{}{"type": "string"},
			},
		},
		"MessagePayload": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"content": map[string]interface{}{"type": "string", "example": "Can you help me with pricing?"},
			},
			"required": []string{"content"},
		},
		"ConversationUpdatePayload": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"assignee_id": map[string]interface{}{"type": "string", "nullable": true},
				"status":      map[string]interface{}{"type": "string", "enum": []string{"open", "pending", "resolved", "snoozed"}, "example": "pending"},
				"tags":        map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}, "example": []string{"billing", "priority"}},
			},
		},
		"EmailSimulationPayload": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"name":    map[string]interface{}{"type": "string", "example": "Emma Williams"},
				"email":   map[string]interface{}{"type": "string", "format": "email", "example": "emma@example.com"},
				"subject": map[string]interface{}{"type": "string", "example": "Still waiting for password reset email"},
				"content": map[string]interface{}{"type": "string", "example": "Hi team, I requested a password reset twice in the last 15 minutes but nothing has arrived yet."},
			},
			"required": []string{"name", "email", "subject", "content"},
		},
		"CopilotResponse": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"summary":         map[string]interface{}{"type": "string"},
				"suggested_reply": map[string]interface{}{"type": "string"},
				"articles": map[string]interface{}{
					"type": "array",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"id":          map[string]interface{}{"type": "string"},
							"title":       map[string]interface{}{"type": "string"},
							"excerpt":     map[string]interface{}{"type": "string"},
							"match_score": map[string]interface{}{"type": "number", "example": 0.74},
						},
					},
				},
				"prior_conversations": map[string]interface{}{
					"type": "array",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"id":              map[string]interface{}{"type": "string"},
							"status":          map[string]interface{}{"type": "string", "example": "resolved"},
							"source":          map[string]interface{}{"type": "string", "enum": []string{"web", "email"}, "example": "email"},
							"subject":         map[string]interface{}{"type": "string", "nullable": true, "example": "Follow-up on refund review"},
							"updated_at":      map[string]interface{}{"type": "string", "format": "date-time"},
							"preview":         map[string]interface{}{"type": "string"},
							"ai_last_outcome": map[string]interface{}{"type": "string", "example": "answered"},
						},
					},
				},
			},
		},
		"Article": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":         map[string]interface{}{"type": "string"},
				"title":      map[string]interface{}{"type": "string"},
				"collection": map[string]interface{}{"type": "string", "example": "Billing"},
				"section":    map[string]interface{}{"type": "string", "example": "Refunds"},
				"content":    map[string]interface{}{"type": "string"},
				"status":     map[string]interface{}{"type": "string", "enum": []string{"draft", "published", "archived"}},
				"view_count": map[string]interface{}{"type": "integer"},
				"created_at": map[string]interface{}{"type": "string", "format": "date-time"},
			},
		},
		"ArticlePayload": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"title":      map[string]interface{}{"type": "string", "example": "Refund Policy"},
				"collection": map[string]interface{}{"type": "string", "example": "Billing"},
				"section":    map[string]interface{}{"type": "string", "example": "Refunds"},
				"content":    map[string]interface{}{"type": "string", "example": "We offer refunds within 30 days of purchase."},
				"status":     map[string]interface{}{"type": "string", "enum": []string{"draft", "published", "archived"}, "example": "published"},
			},
			"required": []string{"title", "content"},
		},
		"Ticket": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":                         map[string]interface{}{"type": "string"},
				"conversation_id":            map[string]interface{}{"type": "string", "nullable": true},
				"customer_id":                map[string]interface{}{"type": "string"},
				"assignee_id":                map[string]interface{}{"type": "string", "nullable": true},
				"title":                      map[string]interface{}{"type": "string"},
				"description":                map[string]interface{}{"type": "string"},
				"priority":                   map[string]interface{}{"type": "string", "enum": []string{"low", "medium", "high", "urgent"}},
				"status":                     map[string]interface{}{"type": "string", "enum": []string{"open", "in_progress", "resolved", "closed"}},
				"created_at":                 map[string]interface{}{"type": "string", "format": "date-time"},
				"updated_at":                 map[string]interface{}{"type": "string", "format": "date-time"},
				"customer_name":              map[string]interface{}{"type": "string"},
				"customer_email":             map[string]interface{}{"type": "string", "nullable": true},
				"assignee_name":              map[string]interface{}{"type": "string", "nullable": true},
				"last_customer_notification": map[string]interface{}{"type": "string", "format": "date-time", "nullable": true},
			},
		},
		"TicketPayload": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"conversation_id": map[string]interface{}{"type": "string", "nullable": true},
				"customer_id":     map[string]interface{}{"type": "string"},
				"assignee_id":     map[string]interface{}{"type": "string", "nullable": true},
				"title":           map[string]interface{}{"type": "string"},
				"description":     map[string]interface{}{"type": "string"},
				"priority":        map[string]interface{}{"type": "string", "enum": []string{"low", "medium", "high", "urgent"}},
				"status":          map[string]interface{}{"type": "string", "enum": []string{"open", "in_progress", "resolved", "closed"}},
			},
			"required": []string{"customer_id", "title", "description"},
		},
		"TicketCommentPayload": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"content": map[string]interface{}{"type": "string", "example": "Customer confirmed the issue is resolved."},
			},
			"required": []string{"content"},
		},
		"TicketComment": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":          map[string]interface{}{"type": "string"},
				"ticket_id":   map[string]interface{}{"type": "string"},
				"author_id":   map[string]interface{}{"type": "string"},
				"author_name": map[string]interface{}{"type": "string"},
				"content":     map[string]interface{}{"type": "string"},
				"created_at":  map[string]interface{}{"type": "string", "format": "date-time"},
			},
		},
		"TicketNotification": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":          map[string]interface{}{"type": "string"},
				"ticket_id":   map[string]interface{}{"type": "string"},
				"customer_id": map[string]interface{}{"type": "string"},
				"message":     map[string]interface{}{"type": "string"},
				"created_at":  map[string]interface{}{"type": "string", "format": "date-time"},
			},
		},
		"Workflow": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":                map[string]interface{}{"type": "string"},
				"name":              map[string]interface{}{"type": "string"},
				"trigger_type":      map[string]interface{}{"type": "string", "enum": []string{"message_contains", "new_conversation"}},
				"trigger_condition": map[string]interface{}{"type": "string"},
				"action_type":       map[string]interface{}{"type": "string", "enum": []string{"assign_agent", "auto_reply", "add_tag"}},
				"action_payload":    map[string]interface{}{"type": "string"},
				"is_active":         map[string]interface{}{"type": "boolean"},
				"created_at":        map[string]interface{}{"type": "string", "format": "date-time"},
			},
		},
		"WorkflowUpdatePayload": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"is_active": map[string]interface{}{"type": "boolean", "example": false},
			},
			"required": []string{"is_active"},
		},
		"WorkflowLog": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"id":              map[string]interface{}{"type": "string"},
				"workflow_id":     map[string]interface{}{"type": "string"},
				"conversation_id": map[string]interface{}{"type": "string"},
				"executed_at":     map[string]interface{}{"type": "string", "format": "date-time"},
				"workflow_name":   map[string]interface{}{"type": "string"},
			},
		},
		"Analytics": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"total_conversations":            map[string]interface{}{"type": "integer"},
				"total_tickets":                  map[string]interface{}{"type": "integer"},
				"open_tickets":                   map[string]interface{}{"type": "integer"},
				"ai_messages":                    map[string]interface{}{"type": "integer"},
				"human_messages":                 map[string]interface{}{"type": "integer"},
				"ai_answered_conversations":      map[string]interface{}{"type": "integer"},
				"ai_escalated_conversations":     map[string]interface{}{"type": "integer"},
				"ai_unanswered_conversations":    map[string]interface{}{"type": "integer"},
				"ai_resolution_rate":             map[string]interface{}{"type": "number"},
				"human_escalation_rate":          map[string]interface{}{"type": "number"},
				"average_first_response_seconds": map[string]interface{}{"type": "number"},
				"csat_score":                     map[string]interface{}{"type": "number"},
				"top_topics": map[string]interface{}{
					"type": "array",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"topic": map[string]interface{}{"type": "string"},
							"count": map[string]interface{}{"type": "integer"},
						},
					},
				},
				"team_performance": map[string]interface{}{
					"type": "array",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"agent":         map[string]interface{}{"type": "string"},
							"conversations": map[string]interface{}{"type": "integer"},
						},
					},
				},
			},
		},
		"AISettings": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"name":         map[string]interface{}{"type": "string", "example": "AI Agent"},
				"greeting":     map[string]interface{}{"type": "string", "example": "Hi, I'm your AI support assistant."},
				"tone":         map[string]interface{}{"type": "string", "enum": []string{"friendly", "balanced", "formal"}, "example": "friendly"},
				"brand_name":   map[string]interface{}{"type": "string", "example": "AICM Support"},
				"accent_color": map[string]interface{}{"type": "string", "example": "#2563EB"},
				"updated_at":   map[string]interface{}{"type": "string", "format": "date-time"},
			},
			"required": []string{"name", "greeting", "tone", "brand_name", "accent_color"},
		},
	}
	paths := map[string]interface{}{
		"/api/health": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":        []string{"System"},
				"summary":     "Health check",
				"description": "Confirms that the API server is running.",
				"responses": map[string]interface{}{
					"200": textResponse("Server is healthy"),
				},
			},
		},
		"/api/auth/register": map[string]interface{}{
			"post": map[string]interface{}{
				"tags":        []string{"Auth"},
				"summary":     "Register a customer",
				"description": "Registers a new customer account. Role input is ignored unless ALLOW_ROLE_FROM_REGISTER is enabled.",
				"requestBody": jsonRequestBody(schemaRef("AuthPayload"), true, map[string]interface{}{
					"name":     "Taylor Customer",
					"email":    "taylor@example.com",
					"password": "supersecret123",
				}),
				"responses": map[string]interface{}{
					"201": jsonResponse("User created", schemaRef("MessageResponse")),
				},
			},
		},
		"/api/auth/bootstrap-admin": map[string]interface{}{
			"post": map[string]interface{}{
				"tags":        []string{"Auth"},
				"summary":     "Create the first human admin",
				"description": "Bootstraps the first admin with a password-backed account. This remains available only until a human admin exists.",
				"requestBody": jsonRequestBody(schemaRef("AuthPayload"), true, map[string]interface{}{
					"name":     "Platform Admin",
					"email":    "owner@example.com",
					"password": "supersecret123",
				}),
				"responses": map[string]interface{}{
					"201": jsonResponse("Admin created", schemaRef("MessageResponse")),
					"409": textResponse("Admin already exists"),
				},
			},
		},
		"/api/auth/login": map[string]interface{}{
			"post": map[string]interface{}{
				"tags":        []string{"Auth"},
				"summary":     "Login",
				"description": "Authenticates a password-backed user and returns a JWT.",
				"requestBody": jsonRequestBody(schemaRef("AuthPayload"), true, map[string]interface{}{
					"email":    "owner@example.com",
					"password": "supersecret123",
				}),
				"responses": map[string]interface{}{
					"200": jsonResponse("Token issued", schemaRef("AuthTokenResponse")),
				},
			},
		},
		"/api/auth/admin/login": map[string]interface{}{
			"post": map[string]interface{}{
				"tags":        []string{"Auth"},
				"summary":     "Login as admin",
				"description": "Authenticates an admin account and returns a JWT.",
				"requestBody": jsonRequestBody(schemaRef("AuthPayload"), true, map[string]interface{}{
					"email":    "admin@aicm.local",
					"password": "Admin12345!",
				}),
				"responses": map[string]interface{}{
					"200": jsonResponse("Token issued", schemaRef("AuthTokenResponse")),
				},
			},
		},
		"/api/auth/agent/login": map[string]interface{}{
			"post": map[string]interface{}{
				"tags":        []string{"Auth"},
				"summary":     "Login as agent",
				"description": "Authenticates an agent account and returns a JWT.",
				"requestBody": jsonRequestBody(schemaRef("AuthPayload"), true, map[string]interface{}{
					"email":    "agent@aicm.local",
					"password": "Agent12345!",
				}),
				"responses": map[string]interface{}{
					"200": jsonResponse("Token issued", schemaRef("AuthTokenResponse")),
				},
			},
		},
		"/api/auth/customer/login": map[string]interface{}{
			"post": map[string]interface{}{
				"tags":        []string{"Auth"},
				"summary":     "Login as customer",
				"description": "Authenticates a customer account and returns a JWT.",
				"requestBody": jsonRequestBody(schemaRef("AuthPayload"), true, map[string]interface{}{
					"email":    "customer@example.com",
					"password": "Customer123!",
				}),
				"responses": map[string]interface{}{
					"200": jsonResponse("Token issued", schemaRef("AuthTokenResponse")),
				},
			},
		},
		"/api/auth/customer/register": map[string]interface{}{
			"post": map[string]interface{}{
				"tags":        []string{"Auth"},
				"summary":     "Register customer account",
				"description": "Creates a password-backed customer account for dashboard access and authenticated chat.",
				"requestBody": jsonRequestBody(schemaRef("AuthPayload"), true, map[string]interface{}{
					"name":     "Jamie Customer",
					"email":    "jamie@example.com",
					"password": "Customer123!",
				}),
				"responses": map[string]interface{}{
					"201": jsonResponse("Customer account created", schemaRef("MessageResponse")),
				},
			},
		},
		"/api/settings/public": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":        []string{"Settings"},
				"summary":     "Get public branding settings",
				"description": "Returns the public widget and help-center branding configuration.",
				"responses": map[string]interface{}{
					"200": jsonResponse("Public settings", schemaRef("PublicSettings")),
				},
			},
		},
		"/api/articles": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":        []string{"Help Center"},
				"summary":     "List public articles",
				"description": "Returns published help center articles.",
				"parameters": []interface{}{
					queryParam("q", "Keyword filter for article title/content", "string", "refund"),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Public article list", map[string]interface{}{"type": "array", "items": schemaRef("Article")}),
				},
			},
		},
		"/api/articles/{id}": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":        []string{"Help Center"},
				"summary":     "Get public article",
				"description": "Returns a single article and increments its view count.",
				"parameters": []interface{}{
					pathParam("id", "Article ID"),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Article loaded", schemaRef("Article")),
				},
			},
		},
		"/api/ws/{id}": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":        []string{"Realtime"},
				"summary":     "Open conversation websocket",
				"description": "WebSocket endpoint for live conversation updates. Pass the JWT as ?token=... in the query string.",
				"x-docs-kind": "websocket",
				"parameters": []interface{}{
					pathParam("id", "Conversation ID"),
					queryParam("token", "JWT used for the websocket handshake", "string", "eyJhbGciOiJI..."),
				},
				"responses": map[string]interface{}{
					"101": map[string]interface{}{"description": "Protocol upgraded to websocket"},
				},
			},
		},
		"/api/protected/me": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":        []string{"Protected"},
				"summary":     "Inspect current token",
				"description": "Returns the authenticated claims for the current bearer token.",
				"security":    bearerSecurity(),
				"responses": map[string]interface{}{
					"200": textResponse("Authenticated claims"),
				},
			},
		},
		"/api/protected/conversations": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":        []string{"Conversations"},
				"summary":     "List conversations",
				"description": "Lists shared inbox conversations for support agents/admins.",
				"security":    bearerSecurity(),
				"parameters": []interface{}{
					queryParam("status", "Filter by status", "string", "open"),
					queryParam("assignee_id", "Filter by assignee user ID", "string", "f8b74c6a-f1c3-4fc0-83b3-dea19f20d7d9"),
					queryParam("days", "Only include conversations updated in the last N days", "integer", 7),
					queryParam("tag", "Only include conversations that contain the specified tag", "string", "billing"),
					queryParam("source", "Only include conversations from the specified source", "string", "email"),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Conversation list", map[string]interface{}{"type": "array", "items": schemaRef("Conversation")}),
				},
			},
		},
		"/api/protected/customer/overview": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":        []string{"Customer"},
				"summary":     "Get customer dashboard overview",
				"description": "Returns the authenticated customer's profile, conversations, tickets, notifications, and summary stats.",
				"security":    bearerSecurity(),
				"responses": map[string]interface{}{
					"200": jsonResponse("Customer overview", schemaRef("CustomerOverview")),
				},
			},
		},
		"/api/protected/customer/chat-session": map[string]interface{}{
			"post": map[string]interface{}{
				"tags":        []string{"Customer"},
				"summary":     "Ensure customer chat session",
				"description": "Finds or creates the authenticated customer's active web conversation for the public widget.",
				"security":    bearerSecurity(),
				"responses": map[string]interface{}{
					"200": jsonResponse("Active customer chat session", schemaRef("CustomerChatSessionResponse")),
				},
			},
		},
		"/api/protected/conversations/email-sim": map[string]interface{}{
			"post": map[string]interface{}{
				"tags":        []string{"Conversations"},
				"summary":     "Simulate inbound email",
				"description": "Creates an email-source conversation and first customer message for omnichannel demo/testing flows.",
				"security":    bearerSecurity(),
				"requestBody": jsonRequestBody(schemaRef("EmailSimulationPayload"), true, map[string]interface{}{
					"name":    "Emma Williams",
					"email":   "emma@example.com",
					"subject": "Still waiting for password reset email",
					"content": "Hi team, I requested a password reset twice in the last 15 minutes but nothing has arrived yet.",
				}),
				"responses": map[string]interface{}{
					"201": jsonResponse("Email conversation created", map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"conversation": schemaRef("Conversation"),
							"message":      schemaRef("Message"),
						},
					}),
				},
			},
		},
		"/api/protected/conversations/{id}/messages": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"Conversations"},
				"summary":  "Get conversation messages",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Conversation ID"),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Message list", map[string]interface{}{"type": "array", "items": schemaRef("Message")}),
				},
			},
			"post": map[string]interface{}{
				"tags":        []string{"Conversations"},
				"summary":     "Send a message",
				"description": "Posts a customer or agent/admin message into the conversation.",
				"security":    bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Conversation ID"),
					queryParam("is_internal", "Set true for internal notes by agent/admin users", "string", "true"),
				},
				"requestBody": jsonRequestBody(schemaRef("MessagePayload"), true, map[string]interface{}{
					"content": "Can you help me with pricing?",
				}),
				"responses": map[string]interface{}{
					"201": jsonResponse("Message created", schemaRef("Message")),
				},
			},
		},
		"/api/protected/conversations/{id}/assign": map[string]interface{}{
			"put": map[string]interface{}{
				"tags":     []string{"Conversations"},
				"summary":  "Assign or update a conversation",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Conversation ID"),
				},
				"requestBody": jsonRequestBody(schemaRef("ConversationUpdatePayload"), true, map[string]interface{}{
					"status":      "pending",
					"assignee_id": "f8b74c6a-f1c3-4fc0-83b3-dea19f20d7d9",
					"tags":        []string{"billing", "priority"},
				}),
				"responses": map[string]interface{}{
					"200": jsonResponse("Conversation updated", schemaRef("Conversation")),
				},
			},
		},
		"/api/protected/conversations/{id}/copilot": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"AI Copilot"},
				"summary":  "Generate copilot insights",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Conversation ID"),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Copilot insight", schemaRef("CopilotResponse")),
				},
			},
		},
		"/api/protected/articles": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"Knowledge Hub"},
				"summary":  "List internal articles",
				"security": bearerSecurity(),
				"responses": map[string]interface{}{
					"200": jsonResponse("Article list", map[string]interface{}{"type": "array", "items": schemaRef("Article")}),
				},
			},
			"post": map[string]interface{}{
				"tags":     []string{"Knowledge Hub"},
				"summary":  "Create article",
				"security": bearerSecurity(),
				"requestBody": jsonRequestBody(schemaRef("ArticlePayload"), true, map[string]interface{}{
					"title":   "Refund Policy",
					"content": "We offer refunds within 30 days of purchase.",
					"status":  "published",
				}),
				"responses": map[string]interface{}{
					"201": jsonResponse("Article created", schemaRef("Article")),
				},
			},
		},
		"/api/protected/articles/{id}": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"Knowledge Hub"},
				"summary":  "Get article",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Article ID"),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Article loaded", schemaRef("Article")),
				},
			},
			"put": map[string]interface{}{
				"tags":     []string{"Knowledge Hub"},
				"summary":  "Update article",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Article ID"),
				},
				"requestBody": jsonRequestBody(schemaRef("ArticlePayload"), true, map[string]interface{}{
					"title":   "Updated Refund Policy",
					"content": "Refunds are processed in 5 business days.",
					"status":  "published",
				}),
				"responses": map[string]interface{}{
					"200": jsonResponse("Article updated", schemaRef("Article")),
				},
			},
			"delete": map[string]interface{}{
				"tags":     []string{"Knowledge Hub"},
				"summary":  "Delete article",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Article ID"),
				},
				"responses": map[string]interface{}{
					"204": map[string]interface{}{"description": "Article deleted"},
				},
			},
		},
		"/api/protected/tickets": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"Tickets"},
				"summary":  "List tickets",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					queryParam("priority", "Filter by priority", "string", "high"),
					queryParam("status", "Filter by status", "string", "open"),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Ticket list", map[string]interface{}{"type": "array", "items": schemaRef("Ticket")}),
				},
			},
			"post": map[string]interface{}{
				"tags":     []string{"Tickets"},
				"summary":  "Create ticket",
				"security": bearerSecurity(),
				"requestBody": jsonRequestBody(schemaRef("TicketPayload"), true, map[string]interface{}{
					"conversation_id": "0f9ec793-179f-4d87-bf0e-9967e9919bc6",
					"customer_id":     "442997e3-9a83-48c5-af06-e438df281d65",
					"title":           "Refund follow-up",
					"description":     "Customer is requesting a refund for duplicate billing.",
					"priority":        "medium",
					"status":          "open",
				}),
				"responses": map[string]interface{}{
					"201": jsonResponse("Ticket created", schemaRef("Ticket")),
				},
			},
		},
		"/api/protected/tickets/{id}": map[string]interface{}{
			"put": map[string]interface{}{
				"tags":     []string{"Tickets"},
				"summary":  "Update ticket",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Ticket ID"),
				},
				"requestBody": jsonRequestBody(schemaRef("TicketPayload"), true, map[string]interface{}{
					"status":   "resolved",
					"priority": "high",
				}),
				"responses": map[string]interface{}{
					"200": jsonResponse("Ticket updated", schemaRef("Ticket")),
				},
			},
		},
		"/api/protected/tickets/{id}/comments": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"Tickets"},
				"summary":  "List ticket comments",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Ticket ID"),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Ticket comments", map[string]interface{}{"type": "array", "items": schemaRef("TicketComment")}),
				},
			},
			"post": map[string]interface{}{
				"tags":     []string{"Tickets"},
				"summary":  "Add ticket comment",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Ticket ID"),
				},
				"requestBody": jsonRequestBody(schemaRef("TicketCommentPayload"), true, map[string]interface{}{
					"content": "Customer confirmed the issue is resolved.",
				}),
				"responses": map[string]interface{}{
					"201": jsonResponse("Comment created", schemaRef("TicketComment")),
				},
			},
		},
		"/api/protected/tickets/{id}/notifications": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"Tickets"},
				"summary":  "List customer ticket notifications",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Ticket ID"),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Ticket notifications", map[string]interface{}{"type": "array", "items": schemaRef("TicketNotification")}),
				},
			},
		},
		"/api/protected/workflows": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"Workflows"},
				"summary":  "List workflows",
				"security": bearerSecurity(),
				"responses": map[string]interface{}{
					"200": jsonResponse("Workflow list", map[string]interface{}{"type": "array", "items": schemaRef("Workflow")}),
				},
			},
			"post": map[string]interface{}{
				"tags":     []string{"Workflows"},
				"summary":  "Create workflow",
				"security": bearerSecurity(),
				"requestBody": jsonRequestBody(schemaRef("Workflow"), true, map[string]interface{}{
					"name":              "Pricing Auto Reply",
					"trigger_type":      "message_contains",
					"trigger_condition": "pricing",
					"action_type":       "auto_reply",
					"action_payload":    "Thanks for asking about pricing. Our plans start at $29/month.",
				}),
				"responses": map[string]interface{}{
					"201": jsonResponse("Workflow created", schemaRef("Workflow")),
				},
			},
		},
		"/api/protected/workflows/logs": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"Workflows"},
				"summary":  "List workflow execution logs",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					queryParam("limit", "Maximum number of log rows to return", "integer", 10),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Workflow logs", map[string]interface{}{"type": "array", "items": schemaRef("WorkflowLog")}),
				},
			},
		},
		"/api/protected/workflows/{id}": map[string]interface{}{
			"put": map[string]interface{}{
				"tags":     []string{"Workflows"},
				"summary":  "Toggle workflow",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					pathParam("id", "Workflow ID"),
				},
				"requestBody": jsonRequestBody(schemaRef("WorkflowUpdatePayload"), true, map[string]interface{}{
					"is_active": false,
				}),
				"responses": map[string]interface{}{
					"200": textResponse("Workflow updated"),
				},
			},
		},
		"/api/protected/analytics": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"Analytics"},
				"summary":  "Get analytics dashboard stats",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					queryParam("days", "Scope analytics to the last N days", "integer", 7),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("Analytics snapshot", schemaRef("Analytics")),
				},
			},
		},
		"/api/protected/users": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":     []string{"Users"},
				"summary":  "List users",
				"security": bearerSecurity(),
				"parameters": []interface{}{
					queryParam("role", "Filter by role", "string", "agent"),
				},
				"responses": map[string]interface{}{
					"200": jsonResponse("User list", map[string]interface{}{"type": "array", "items": schemaRef("User")}),
				},
			},
			"post": map[string]interface{}{
				"tags":     []string{"Users"},
				"summary":  "Create user",
				"security": bearerSecurity(),
				"requestBody": jsonRequestBody(schemaRef("AuthPayload"), true, map[string]interface{}{
					"name":     "Support Agent",
					"email":    "agent@example.com",
					"password": "supersecret123",
					"role":     "agent",
				}),
				"responses": map[string]interface{}{
					"201": jsonResponse("User created", schemaRef("MessageResponse")),
				},
			},
		},
		"/api/protected/settings/ai": map[string]interface{}{
			"get": map[string]interface{}{
				"tags":        []string{"Settings"},
				"summary":     "Get AI settings",
				"description": "Returns the admin-configurable AI assistant persona plus public brand settings.",
				"security":    bearerSecurity(),
				"responses": map[string]interface{}{
					"200": jsonResponse("AI settings", schemaRef("AISettings")),
				},
			},
			"put": map[string]interface{}{
				"tags":        []string{"Settings"},
				"summary":     "Update AI settings",
				"description": "Updates the AI assistant persona and public widget branding used by future AI replies and the help experience.",
				"security":    bearerSecurity(),
				"requestBody": jsonRequestBody(schemaRef("AISettings"), true, map[string]interface{}{
					"name":         "AICM Concierge",
					"greeting":     "Hello, I'm the AICM support assistant.",
					"tone":         "balanced",
					"brand_name":   "AICM Concierge",
					"accent_color": "#1D4ED8",
				}),
				"responses": map[string]interface{}{
					"200": jsonResponse("AI settings updated", schemaRef("AISettings")),
				},
			},
		},
	}
	return map[string]interface{}{
		"openapi": "3.0.3",
		"info": map[string]interface{}{
			"title":       "AICM Support API",
			"version":     "1.1.0",
			"description": "Interactive API documentation for the Go backend powered by Groq.",
		},
		"servers": []map[string]string{{"url": "http://localhost:8900"}},
		"components": map[string]interface{}{
			"securitySchemes": map[string]interface{}{
				"BearerAuth": map[string]interface{}{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "JWT",
				},
			},
			"schemas": schemas,
		},
		"paths": paths,
	}
}

func swaggerExplorerHTML() string {
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>AICM API Explorer</title><style>
:root{--bg:#f4f6fb;--panel:#fff;--border:#d7def0;--text:#1c2740;--muted:#5d6985;--blue:#2457f5;--green:#1d8f5f;--purple:#8a52e6;--red:#d64545;font-family:"Segoe UI",Arial,sans-serif}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#edf3ff 0%,var(--bg) 35%,#fff 100%);color:var(--text)}.shell{width:min(1180px,calc(100% - 32px));margin:24px auto 40px}.hero{background:linear-gradient(135deg,#102048 0%,#2457f5 55%,#54a4ff 100%);color:#fff;border-radius:26px;padding:26px;box-shadow:0 18px 40px rgba(18,31,69,.08);margin-bottom:24px}.hero h1{margin:0 0 10px;font-size:30px}.hero p{margin:0;max-width:760px;color:rgba(255,255,255,.86);line-height:1.5}.toolbar{margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}.field{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);border-radius:18px;padding:12px 14px}.field label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;color:rgba(255,255,255,.78)}.field input{width:100%;border:0;border-radius:12px;padding:10px 12px;font-size:14px;color:var(--text)}#app{display:grid;gap:14px}.empty{background:#fff;border:1px dashed var(--border);border-radius:22px;padding:24px;color:var(--muted);text-align:center}.card{background:var(--panel);border:1px solid var(--border);border-radius:22px;overflow:hidden;box-shadow:0 12px 28px rgba(18,31,69,.05)}.card summary{list-style:none;cursor:pointer;padding:18px 22px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.card summary::-webkit-details-marker{display:none}.headline{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.method{min-width:64px;text-align:center;padding:7px 10px;border-radius:999px;font-weight:800;font-size:12px;color:#fff;text-transform:uppercase;letter-spacing:.04em}.get{background:var(--green)}.post{background:var(--blue)}.put{background:var(--purple)}.delete{background:var(--red)}.badge{background:#eef3ff;color:var(--blue);border:1px solid #cdd8ff;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700}.meta{font-size:13px;color:var(--muted);line-height:1.5}.body{border-top:1px solid var(--border);padding:18px 22px 22px;background:linear-gradient(180deg,rgba(36,87,245,.03) 0%,rgba(255,255,255,0) 100%)}.section-title{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 10px}.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-bottom:18px}.param{background:#fff;border:1px solid var(--border);border-radius:16px;padding:12px}.param label{display:block;font-size:13px;font-weight:700;margin-bottom:6px}.param small{display:block;color:var(--muted);margin-bottom:8px;line-height:1.4}.param input,textarea{width:100%;border:1px solid var(--border);border-radius:12px;padding:10px 12px;font:inherit;color:var(--text);background:#fbfcff}textarea{min-height:180px;resize:vertical}.actions{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:14px;flex-wrap:wrap}button{border:0;border-radius:12px;padding:11px 16px;background:var(--blue);color:#fff;font-weight:700;cursor:pointer;box-shadow:0 10px 24px rgba(36,87,245,.2)}button[disabled]{cursor:not-allowed;opacity:.6;box-shadow:none}.note{color:var(--muted);font-size:13px;line-height:1.5}.response{margin-top:16px;background:#0f172a;color:#dbe7ff;border-radius:16px;padding:14px;min-height:96px;white-space:pre-wrap;overflow-x:auto;font:13px/1.55 Consolas,"Courier New",monospace}
</style></head><body><div class="shell"><section class="hero"><h1>AICM API Explorer</h1><p>This local explorer replaces the old CDN-dependent Swagger screen. It reads the OpenAPI document from this Go server, shows request fields for the live Groq-powered API, and lets you execute REST endpoints directly. Groq uses an OpenAI-compatible transport under the hood, but this app does not expose any separate OpenAI integration.</p><div class="toolbar"><div class="field"><label for="baseUrl">Base URL</label><input id="baseUrl" type="text" /></div><div class="field"><label for="bearerToken">Bearer Token</label><input id="bearerToken" type="text" placeholder="Paste a JWT for protected routes" /></div></div></section><div id="app" class="empty">Loading API documentation...</div></div><script>
const app=document.getElementById('app');const tokenInput=document.getElementById('bearerToken');const baseUrlInput=document.getElementById('baseUrl');tokenInput.value=localStorage.getItem('aicm-docs-token')||'';baseUrlInput.value=localStorage.getItem('aicm-docs-base-url')||window.location.origin;tokenInput.addEventListener('input',()=>localStorage.setItem('aicm-docs-token',tokenInput.value.trim()));baseUrlInput.addEventListener('input',()=>localStorage.setItem('aicm-docs-base-url',baseUrlInput.value.trim()));let openapi=null;function create(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el}function resolveSchema(schema){if(!schema)return null;if(schema.$ref){const refName=schema.$ref.split('/').pop();const resolved=openapi.components&&openapi.components.schemas?openapi.components.schemas[refName]:null;return resolved?resolveSchema(resolved):null}return schema}function buildExample(schema){const resolved=resolveSchema(schema);if(!resolved)return undefined;if(resolved.example!==undefined)return resolved.example;if(resolved.default!==undefined)return resolved.default;if(resolved.enum&&resolved.enum.length)return resolved.enum[0];if(resolved.type==='object'){const value={};const props=resolved.properties||{};Object.keys(props).forEach(key=>{const sample=buildExample(props[key]);if(sample!==undefined)value[key]=sample});return value}if(resolved.type==='array')return[buildExample(resolved.items)];if(resolved.type==='integer'||resolved.type==='number')return 0;if(resolved.type==='boolean')return false;return''}function contentExample(content){if(!content||!content['application/json'])return undefined;const jsonContent=content['application/json'];if(jsonContent.example!==undefined)return jsonContent.example;return buildExample(jsonContent.schema)}function render(){const entries=[];Object.keys(openapi.paths||{}).sort().forEach(path=>{const methods=openapi.paths[path];Object.keys(methods).sort().forEach(method=>entries.push({path,method,operation:methods[method]}))});if(!entries.length){app.className='empty';app.textContent='No API operations found.';return}app.className='';app.innerHTML='';entries.forEach(entry=>{const details=create('details','card');details.open=true;const summary=create('summary');const left=create('div');const headline=create('div','headline');headline.appendChild(create('span','method '+entry.method,entry.method.toUpperCase()));const pathCode=create('code','',entry.path);pathCode.style.fontSize='16px';pathCode.style.fontWeight='700';headline.appendChild(pathCode);if(entry.operation.security)headline.appendChild(create('span','badge','Bearer auth'));left.appendChild(headline);left.appendChild(create('div','meta',entry.operation.summary||''));if(entry.operation.description){const d=create('div','meta',entry.operation.description);d.style.marginTop='6px';left.appendChild(d)}summary.appendChild(left);summary.appendChild(create('div','meta',(entry.operation.tags||[]).join(', ')));details.appendChild(summary);const body=create('div','body');const parameters=entry.operation.parameters||[];if(parameters.length){body.appendChild(create('div','section-title','Parameters'));const grid=create('div','grid');parameters.forEach(param=>{const card=create('div','param');card.appendChild(create('label','',param.name+' ('+param.in+')'));card.appendChild(create('small','',param.description||''));const input=create('input');input.dataset.paramName=param.name;input.dataset.paramIn=param.in;const schema=param.schema||{};const example=param.example!==undefined?param.example:(schema.example!==undefined?schema.example:'');input.placeholder=example!==undefined?String(example):'';card.appendChild(input);grid.appendChild(card)});body.appendChild(grid)}let editor=null;const requestBody=entry.operation.requestBody;if(requestBody&&requestBody.content&&requestBody.content['application/json']){body.appendChild(create('div','section-title','JSON body'));editor=create('textarea');editor.value=JSON.stringify(contentExample(requestBody.content)||{},null,2);body.appendChild(editor)}if(entry.operation['x-docs-kind']==='websocket'){const docNote=create('div','note','This endpoint upgrades to WebSocket, so the explorer documents it but does not execute it. Use the token query parameter shown above when connecting from the widget or inbox.');docNote.style.marginTop='12px';body.appendChild(docNote)}const actions=create('div','actions');const execute=create('button','',entry.operation['x-docs-kind']==='websocket'?'Documented only':'Execute');if(entry.operation['x-docs-kind']==='websocket')execute.disabled=true;actions.appendChild(execute);actions.appendChild(create('div','note','Responses are shown below. Protected routes use the bearer token from the page header.'));body.appendChild(actions);const response=create('pre','response','Ready.');body.appendChild(response);execute.addEventListener('click',async()=>{response.textContent='Sending request...';try{let path=entry.path;const query=new URLSearchParams();const headers={};parameters.forEach(param=>{const selector='input[data-param-name="'+param.name+'"][data-param-in="'+param.in+'"]';const input=body.querySelector(selector);const value=input?input.value.trim():'';if(!value)return;if(param.in==='path')path=path.replace('{'+param.name+'}',encodeURIComponent(value));else if(param.in==='query')query.append(param.name,value);else if(param.in==='header')headers[param.name]=value});if(entry.operation.security&&tokenInput.value.trim())headers.Authorization='Bearer '+tokenInput.value.trim();const url=new URL(baseUrlInput.value.replace(/\/$/,'')+path);query.forEach((value,key)=>url.searchParams.append(key,value));const options={method:entry.method.toUpperCase(),headers};if(editor){headers['Content-Type']='application/json';const raw=editor.value.trim();if(raw){JSON.parse(raw);options.body=raw}}const res=await fetch(url.toString(),options);const text=await res.text();let pretty=text;try{pretty=JSON.stringify(JSON.parse(text),null,2)}catch(err){}response.textContent='HTTP '+res.status+' '+res.statusText+'\n\n'+(pretty||'(no response body)')}catch(err){response.textContent='Request failed.\n\n'+err.message}});details.appendChild(body);app.appendChild(details)})}async function load(){try{const res=await fetch('/swagger/openapi.json');openapi=await res.json();render()}catch(err){app.className='empty';app.textContent='Failed to load API documentation: '+err.message}}load();
</script></body></html>`
}

func (s *Server) registerDocsRoutes() {
	s.Router.Get("/swagger", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(swaggerExplorerHTML()))
	})

	s.Router.Get("/swagger/openapi.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(openAPISpec())
	})
}
