package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"deakr/aicm/internal/ai"
	"deakr/aicm/internal/database"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

type seededUser struct {
	Key        string
	ID         string
	Name       string
	Email      string
	Role       string
	Password   string
	Attributes string
}

type seededArticle struct {
	Title      string
	Collection string
	Section    string
	Content    string
	Status     string
}

type seededMessage struct {
	SenderKey     string
	Content       string
	IsAIGenerated bool
	IsInternal    bool
	MinutesAgo    int
}

type seededConversation struct {
	Key                    string
	CustomerKey            string
	AssigneeKey            string
	Source                 string
	Subject                string
	Status                 string
	Tags                   []string
	AIConfidenceScore      float64
	AIConfidenceLabel      string
	AILastOutcome          string
	AISourceTitle          string
	CreatedMinutesAgo      int
	UpdatedMinutesAgo      int
	CustomerReadMinutesAgo int
	AgentReadMinutesAgo    int
	Messages               []seededMessage
}

type seededTicketComment struct {
	AuthorKey  string
	Content    string
	MinutesAgo int
}

type seededTicketNotification struct {
	Message    string
	MinutesAgo int
}

type seededTicket struct {
	ConversationKey   string
	CustomerKey       string
	AssigneeKey       string
	Title             string
	Description       string
	Priority          string
	Status            string
	CreatedMinutesAgo int
	UpdatedMinutesAgo int
	Comments          []seededTicketComment
	Notifications     []seededTicketNotification
}

type seededWorkflow struct {
	Name              string
	TriggerType       string
	TriggerCondition  string
	ActionType        string
	ActionPayload     string
	IsActive          bool
	CreatedMinutesAgo int
}

func main() {
	for _, path := range []string{"../.env", ".env"} {
		_ = godotenv.Load(path)
	}

	db := database.New()
	defer db.Close()

	ctx := context.Background()
	if err := resetTables(ctx, db); err != nil {
		log.Fatalf("reset failed: %v", err)
	}

	if err := seedAISettings(ctx, db); err != nil {
		log.Fatalf("failed to seed AI settings: %v", err)
	}
	if err := seedArticles(ctx, db); err != nil {
		log.Fatalf("failed to seed articles: %v", err)
	}

	users, err := seedUsers(ctx, db)
	if err != nil {
		log.Fatalf("failed to seed users: %v", err)
	}

	conversations, err := seedConversations(ctx, db, users)
	if err != nil {
		log.Fatalf("failed to seed conversations: %v", err)
	}

	if err := seedTickets(ctx, db, users, conversations); err != nil {
		log.Fatalf("failed to seed tickets: %v", err)
	}

	if err := seedWorkflows(ctx, db, users, conversations); err != nil {
		log.Fatalf("failed to seed workflows: %v", err)
	}

	fmt.Println("Database reset complete.")
	fmt.Println("Seeded users and login credentials:")
	fmt.Println("  Workspace (/workspace/login):")
	fmt.Printf("    admin  -> %s / %s\n", users["admin"].Email, users["admin"].Password)
	fmt.Printf("    agent  -> %s / %s\n", users["agent"].Email, users["agent"].Password)
	fmt.Printf("    billing agent -> %s / %s\n", users["billing_agent"].Email, users["billing_agent"].Password)
	fmt.Println("  Customer (/login):")
	fmt.Printf("    customer -> %s / %s\n", users["customer_priya"].Email, users["customer_priya"].Password)
	fmt.Printf("    customer -> %s / %s\n", users["customer_arjun"].Email, users["customer_arjun"].Password)
	fmt.Printf("    customer -> %s / %s\n", users["customer_enterprise"].Email, users["customer_enterprise"].Password)
	fmt.Println("Seeded content: 14 articles, 5 conversations, 3 tickets, 3 workflows, and workflow/ticket logs.")
}

func resetTables(ctx context.Context, db *database.Service) error {
	resetSQL := `
		TRUNCATE TABLE
			workflow_logs,
			ticket_notifications,
			ticket_comments,
			tickets,
			messages,
			conversations,
			workflows,
			articles,
			users
		RESTART IDENTITY CASCADE
	`
	_, err := db.Pool.Exec(ctx, resetSQL)
	return err
}

func seedAISettings(ctx context.Context, db *database.Service) error {
	_, err := db.Pool.Exec(
		ctx,
		`INSERT INTO ai_settings (id, name, greeting, tone, brand_name, accent_color, updated_at)
		 VALUES (1, 'AICM Concierge', 'Thanks for reaching out.', 'friendly', 'AICM Support', '#2563EB', CURRENT_TIMESTAMP)
		 ON CONFLICT (id) DO UPDATE
		 SET name = EXCLUDED.name,
		     greeting = EXCLUDED.greeting,
		     tone = EXCLUDED.tone,
		     brand_name = EXCLUDED.brand_name,
		     accent_color = EXCLUDED.accent_color,
		     updated_at = CURRENT_TIMESTAMP`,
	)
	return err
}

func createUser(ctx context.Context, db *database.Service, user seededUser) (seededUser, error) {
	passwordHash := ""
	if strings.TrimSpace(user.Password) != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
		if err != nil {
			return seededUser{}, err
		}
		passwordHash = string(hashed)
	}

	user.Email = strings.TrimSpace(strings.ToLower(user.Email))
	user.Attributes = strings.TrimSpace(user.Attributes)
	if user.Attributes == "" {
		user.Attributes = "{}"
	}

	err := db.Pool.QueryRow(
		ctx,
		`INSERT INTO users (role, name, email, password_hash, custom_attributes) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
		user.Role,
		user.Name,
		user.Email,
		passwordHash,
		user.Attributes,
	).Scan(&user.ID)
	if err != nil {
		return seededUser{}, err
	}

	return user, nil
}

func seedUsers(ctx context.Context, db *database.Service) (map[string]seededUser, error) {
	seed := []seededUser{
		{
			Key:        "admin",
			Name:       "Rohith Admin",
			Email:      "admin@aicm.local",
			Role:       "admin",
			Password:   "Admin12345!",
			Attributes: `{"team":"leadership"}`,
		},
		{
			Key:        "agent",
			Name:       "Maya Support",
			Email:      "agent@aicm.local",
			Role:       "agent",
			Password:   "Agent12345!",
			Attributes: `{"team":"support","specialty":"general"}`,
		},
		{
			Key:        "billing_agent",
			Name:       "Vikram Billing",
			Email:      "billing@aicm.local",
			Role:       "agent",
			Password:   "Billing12345!",
			Attributes: `{"team":"support","specialty":"billing"}`,
		},
		{
			Key:        "customer_priya",
			Name:       "Priya Mehta",
			Email:      "priya.customer@aicm.local",
			Role:       "customer",
			Password:   "Customer12345!",
			Attributes: `{"plan":"pro","region":"india","status":"active"}`,
		},
		{
			Key:        "customer_arjun",
			Name:       "Arjun Nair",
			Email:      "arjun.customer@aicm.local",
			Role:       "customer",
			Password:   "Customer12345!",
			Attributes: `{"plan":"starter","region":"india","status":"active"}`,
		},
		{
			Key:        "customer_enterprise",
			Name:       "Asha Enterprises",
			Email:      "enterprise.customer@aicm.local",
			Role:       "customer",
			Password:   "Customer12345!",
			Attributes: `{"plan":"enterprise","region":"uae","status":"active"}`,
		},
	}

	users := make(map[string]seededUser, len(seed))
	for _, user := range seed {
		created, err := createUser(ctx, db, user)
		if err != nil {
			return nil, fmt.Errorf("failed to create user %s: %w", user.Email, err)
		}
		users[user.Key] = created
	}

	return users, nil
}

func seedConversations(ctx context.Context, db *database.Service, users map[string]seededUser) (map[string]string, error) {
	seed := []seededConversation{
		{
			Key:                    "delayed_shipment",
			CustomerKey:            "customer_priya",
			AssigneeKey:            "",
			Source:                 "web",
			Subject:                "My order still hasn't arrived and tracking shows no updates",
			Status:                 "open",
			Tags:                   []string{"shipping", "tracking", "urgent"},
			AIConfidenceScore:      0.89,
			AIConfidenceLabel:      "high",
			AILastOutcome:          "answered",
			AISourceTitle:          "Order Not Arrived - What To Do",
			CreatedMinutesAgo:      280,
			UpdatedMinutesAgo:      42,
			CustomerReadMinutesAgo: 40,
			AgentReadMinutesAgo:    39,
			Messages: []seededMessage{
				{SenderKey: "customer_priya", Content: "My order hasn't arrived after 5 days", MinutesAgo: 270},
				{SenderKey: "admin", Content: "Hi, I'm AICM Concierge. How can I help you today? Check your tracking for updates from the courier to see if there are any delays or issues. Wait 2 to 3 more days past the estimated date as delays can occur.", IsAIGenerated: true, MinutesAgo: 269},
				{SenderKey: "customer_priya", Content: "can you forward me to a human agent?", MinutesAgo: 244},
				{SenderKey: "admin", Content: "I've noted your request. A human support agent will be with you shortly.", IsAIGenerated: true, MinutesAgo: 244},
			},
		},
		{
			Key:                    "address_change",
			CustomerKey:            "customer_arjun",
			AssigneeKey:            "agent",
			Source:                 "web",
			Subject:                "Can I change my delivery address before the order ships?",
			Status:                 "resolved",
			Tags:                   []string{"delivery", "address"},
			AIConfidenceScore:      0.93,
			AIConfidenceLabel:      "high",
			AILastOutcome:          "answered",
			AISourceTitle:          "Changing Delivery Address",
			CreatedMinutesAgo:      240,
			UpdatedMinutesAgo:      95,
			CustomerReadMinutesAgo: 92,
			AgentReadMinutesAgo:    94,
			Messages: []seededMessage{
				{SenderKey: "customer_arjun", Content: "Can I change my delivery address before dispatch?", MinutesAgo: 230},
				{SenderKey: "admin", Content: "You can update the address before the order reaches Packed status. If it is already packed or shipped, changes are no longer possible from the dashboard.", IsAIGenerated: true, MinutesAgo: 229},
				{SenderKey: "agent", Content: "Your order is still processing, so you can update the address now from your account. Let me know if you want me to guide you.", MinutesAgo: 95},
			},
		},
		{
			Key:                    "damaged_package",
			CustomerKey:            "customer_priya",
			AssigneeKey:            "agent",
			Source:                 "web",
			Subject:                "Package arrived damaged - Item is broken",
			Status:                 "open",
			Tags:                   []string{"damage", "return", "refund"},
			AIConfidenceScore:      0.86,
			AIConfidenceLabel:      "high",
			AILastOutcome:          "answered",
			AISourceTitle:          "Damaged or Incomplete Orders",
			CreatedMinutesAgo:      210,
			UpdatedMinutesAgo:      70,
			CustomerReadMinutesAgo: 66,
			AgentReadMinutesAgo:    68,
			Messages: []seededMessage{
				{SenderKey: "customer_priya", Content: "My package came damaged and one item is broken.", MinutesAgo: 205},
				{SenderKey: "admin", Content: "Please upload clear photos of the damaged box and product. We can file a courier claim and arrange either replacement or refund after verification.", IsAIGenerated: true, MinutesAgo: 204},
				{SenderKey: "agent", Content: "Please send me photos of the damaged box and broken item. Once I receive them, I'll immediately file a damage claim with the courier and we can arrange a replacement or refund.", MinutesAgo: 70},
			},
		},
		{
			Key:                    "return_refund",
			CustomerKey:            "customer_arjun",
			AssigneeKey:            "billing_agent",
			Source:                 "web",
			Subject:                "How long does refund take after returning the item?",
			Status:                 "open",
			Tags:                   []string{"return", "refund", "shipping"},
			AIConfidenceScore:      0.9,
			AIConfidenceLabel:      "high",
			AILastOutcome:          "answered",
			AISourceTitle:          "Return and Refund Process",
			CreatedMinutesAgo:      185,
			UpdatedMinutesAgo:      60,
			CustomerReadMinutesAgo: 58,
			AgentReadMinutesAgo:    59,
			Messages: []seededMessage{
				{SenderKey: "customer_arjun", Content: "How long does the refund take once I return the item?", MinutesAgo: 180},
				{SenderKey: "admin", Content: "Refunds are usually completed in 3 to 5 business days after the return is received and inspected.", IsAIGenerated: true, MinutesAgo: 179},
				{SenderKey: "billing_agent", Content: "I can arrange a return label for you right now. Just confirm you have the original packaging and tags attached.", MinutesAgo: 60},
			},
		},
		{
			Key:                    "express_shipping",
			CustomerKey:            "customer_enterprise",
			AssigneeKey:            "agent",
			Source:                 "web",
			Subject:                "Do you offer overnight delivery?",
			Status:                 "resolved",
			Tags:                   []string{"shipping", "expedited", "time-sensitive"},
			AIConfidenceScore:      0.91,
			AIConfidenceLabel:      "high",
			AILastOutcome:          "answered",
			AISourceTitle:          "Expedited Shipping",
			CreatedMinutesAgo:      160,
			UpdatedMinutesAgo:      45,
			CustomerReadMinutesAgo: 40,
			AgentReadMinutesAgo:    42,
			Messages: []seededMessage{
				{SenderKey: "customer_enterprise", Content: "Do you offer overnight shipping for urgent orders?", MinutesAgo: 155},
				{SenderKey: "admin", Content: "Yes, expedited shipping is available and usually delivers in 1 to 2 business days after dispatch, with overnight options in select metro areas.", IsAIGenerated: true, MinutesAgo: 154},
				{SenderKey: "agent", Content: "Overnight shipping is available to your area! I can help expedite this order if you'd like.", MinutesAgo: 45},
			},
		},
	}

	conversationIDs := make(map[string]string, len(seed))
	for _, conversation := range seed {
		customer, ok := users[conversation.CustomerKey]
		if !ok {
			return nil, fmt.Errorf("missing customer key %s", conversation.CustomerKey)
		}

		var assigneeID interface{}
		if strings.TrimSpace(conversation.AssigneeKey) != "" {
			assignee, exists := users[conversation.AssigneeKey]
			if !exists {
				return nil, fmt.Errorf("missing assignee key %s", conversation.AssigneeKey)
			}
			assigneeID = assignee.ID
		}

		var conversationID string
		err := db.Pool.QueryRow(ctx, `
			INSERT INTO conversations (
				customer_id,
				assignee_id,
				source,
				subject,
				status,
				tags,
				ai_confidence_score,
				ai_confidence_label,
				ai_last_outcome,
				ai_source_title,
				created_at,
				updated_at,
				customer_last_read_at,
				agent_last_read_at
			) VALUES (
				$1,
				$2,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8,
				$9,
				$10,
				CURRENT_TIMESTAMP - ($11 * INTERVAL '1 minute'),
				CURRENT_TIMESTAMP - ($12 * INTERVAL '1 minute'),
				CURRENT_TIMESTAMP - ($13 * INTERVAL '1 minute'),
				CURRENT_TIMESTAMP - ($14 * INTERVAL '1 minute')
			)
			RETURNING id
		`,
			customer.ID,
			assigneeID,
			conversation.Source,
			conversation.Subject,
			conversation.Status,
			conversation.Tags,
			conversation.AIConfidenceScore,
			conversation.AIConfidenceLabel,
			conversation.AILastOutcome,
			conversation.AISourceTitle,
			conversation.CreatedMinutesAgo,
			conversation.UpdatedMinutesAgo,
			conversation.CustomerReadMinutesAgo,
			conversation.AgentReadMinutesAgo,
		).Scan(&conversationID)
		if err != nil {
			return nil, fmt.Errorf("failed to create conversation %s: %w", conversation.Key, err)
		}

		conversationIDs[conversation.Key] = conversationID

		for _, message := range conversation.Messages {
			sender, exists := users[message.SenderKey]
			if !exists {
				return nil, fmt.Errorf("missing sender key %s", message.SenderKey)
			}

			if _, err := db.Pool.Exec(ctx, `
				INSERT INTO messages (conversation_id, sender_id, content, is_ai_generated, is_internal, created_at)
				VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP - ($6 * INTERVAL '1 minute'))
			`,
				conversationID,
				sender.ID,
				message.Content,
				message.IsAIGenerated,
				message.IsInternal,
				message.MinutesAgo,
			); err != nil {
				return nil, fmt.Errorf("failed to create message for %s: %w", conversation.Key, err)
			}
		}
	}

	return conversationIDs, nil
}

func seedTickets(ctx context.Context, db *database.Service, users map[string]seededUser, conversations map[string]string) error {
	seed := []seededTicket{
		{
			ConversationKey:   "delayed_shipment",
			CustomerKey:       "customer_priya",
			AssigneeKey:       "agent",
			Title:             "Courier delay investigation",
			Description:       "Order delayed beyond expected timeline. Verify live tracking and courier handoff status.",
			Priority:          "urgent",
			Status:            "in_progress",
			CreatedMinutesAgo: 120,
			UpdatedMinutesAgo: 30,
			Comments: []seededTicketComment{
				{AuthorKey: "agent", Content: "Courier investigation has been opened. Awaiting first scan update from sorting hub.", MinutesAgo: 46},
				{AuthorKey: "admin", Content: "If no movement in 24 hours, proceed with replacement shipment option.", MinutesAgo: 30},
			},
			Notifications: []seededTicketNotification{
				{Message: "Your shipment issue ticket is now in progress.", MinutesAgo: 34},
			},
		},
		{
			ConversationKey:   "damaged_package",
			CustomerKey:       "customer_priya",
			AssigneeKey:       "agent",
			Title:             "Damaged package claim",
			Description:       "Customer reported product damage on arrival. Collect proof and process claim.",
			Priority:          "high",
			Status:            "open",
			CreatedMinutesAgo: 100,
			UpdatedMinutesAgo: 26,
			Comments: []seededTicketComment{
				{AuthorKey: "agent", Content: "Requested images of parcel and damaged product from customer.", MinutesAgo: 52},
			},
			Notifications: []seededTicketNotification{
				{Message: "Your damage claim is being reviewed by support.", MinutesAgo: 26},
			},
		},
		{
			ConversationKey:   "return_refund",
			CustomerKey:       "customer_arjun",
			AssigneeKey:       "billing_agent",
			Title:             "Return authorization and refund timeline",
			Description:       "Customer requested return support and expected refund timeline.",
			Priority:          "medium",
			Status:            "open",
			CreatedMinutesAgo: 90,
			UpdatedMinutesAgo: 22,
			Comments: []seededTicketComment{
				{AuthorKey: "billing_agent", Content: "Return label shared; refund should complete within 3 to 5 business days after warehouse receipt.", MinutesAgo: 22},
			},
			Notifications: []seededTicketNotification{
				{Message: "Your return request is open and under review.", MinutesAgo: 20},
			},
		},
	}

	for _, ticket := range seed {
		conversationID, ok := conversations[ticket.ConversationKey]
		if !ok {
			return fmt.Errorf("missing conversation key %s", ticket.ConversationKey)
		}
		customer, ok := users[ticket.CustomerKey]
		if !ok {
			return fmt.Errorf("missing customer key %s", ticket.CustomerKey)
		}
		assignee, ok := users[ticket.AssigneeKey]
		if !ok {
			return fmt.Errorf("missing assignee key %s", ticket.AssigneeKey)
		}

		var ticketID string
		err := db.Pool.QueryRow(ctx, `
			INSERT INTO tickets (
				conversation_id,
				customer_id,
				assignee_id,
				title,
				description,
				priority,
				status,
				created_at,
				updated_at
			) VALUES (
				$1,
				$2,
				$3,
				$4,
				$5,
				$6,
				$7,
				CURRENT_TIMESTAMP - ($8 * INTERVAL '1 minute'),
				CURRENT_TIMESTAMP - ($9 * INTERVAL '1 minute')
			)
			RETURNING id
		`,
			conversationID,
			customer.ID,
			assignee.ID,
			ticket.Title,
			ticket.Description,
			ticket.Priority,
			ticket.Status,
			ticket.CreatedMinutesAgo,
			ticket.UpdatedMinutesAgo,
		).Scan(&ticketID)
		if err != nil {
			return fmt.Errorf("failed to create ticket %s: %w", ticket.Title, err)
		}

		for _, comment := range ticket.Comments {
			author, exists := users[comment.AuthorKey]
			if !exists {
				return fmt.Errorf("missing ticket comment author key %s", comment.AuthorKey)
			}

			if _, err := db.Pool.Exec(ctx, `
				INSERT INTO ticket_comments (ticket_id, author_id, content, created_at)
				VALUES ($1, $2, $3, CURRENT_TIMESTAMP - ($4 * INTERVAL '1 minute'))
			`, ticketID, author.ID, comment.Content, comment.MinutesAgo); err != nil {
				return fmt.Errorf("failed to create ticket comment for %s: %w", ticket.Title, err)
			}
		}

		for _, notification := range ticket.Notifications {
			if _, err := db.Pool.Exec(ctx, `
				INSERT INTO ticket_notifications (ticket_id, customer_id, message, created_at)
				VALUES ($1, $2, $3, CURRENT_TIMESTAMP - ($4 * INTERVAL '1 minute'))
			`, ticketID, customer.ID, notification.Message, notification.MinutesAgo); err != nil {
				return fmt.Errorf("failed to create ticket notification for %s: %w", ticket.Title, err)
			}
		}
	}

	return nil
}

func seedWorkflows(ctx context.Context, db *database.Service, users map[string]seededUser, conversations map[string]string) error {
	seed := []seededWorkflow{
		{
			Name:              "Auto-tag shipping issues",
			TriggerType:       "message_contains",
			TriggerCondition:  "shipping",
			ActionType:        "add_tag",
			ActionPayload:     "shipping",
			IsActive:          true,
			CreatedMinutesAgo: 180,
		},
		{
			Name:              "Escalate damaged package claims",
			TriggerType:       "message_contains",
			TriggerCondition:  "damaged",
			ActionType:        "escalate_to_human",
			ActionPayload:     "",
			IsActive:          true,
			CreatedMinutesAgo: 150,
		},
		{
			Name:              "Assign return requests to specialist",
			TriggerType:       "message_contains",
			TriggerCondition:  "return",
			ActionType:        "assign_agent",
			ActionPayload:     users["billing_agent"].ID,
			IsActive:          true,
			CreatedMinutesAgo: 120,
		},
	}

	workflowIDs := make([]string, 0, len(seed))
	for _, workflow := range seed {
		var workflowID string
		err := db.Pool.QueryRow(ctx, `
			INSERT INTO workflows (
				name,
				trigger_type,
				trigger_condition,
				action_type,
				action_payload,
				is_active,
				created_at
			) VALUES (
				$1,
				$2,
				$3,
				$4,
				$5,
				$6,
				CURRENT_TIMESTAMP - ($7 * INTERVAL '1 minute')
			)
			RETURNING id
		`,
			workflow.Name,
			workflow.TriggerType,
			workflow.TriggerCondition,
			workflow.ActionType,
			workflow.ActionPayload,
			workflow.IsActive,
			workflow.CreatedMinutesAgo,
		).Scan(&workflowID)
		if err != nil {
			return fmt.Errorf("failed to create workflow %s: %w", workflow.Name, err)
		}
		workflowIDs = append(workflowIDs, workflowID)
	}

	logs := []struct {
		WorkflowIndex   int
		ConversationKey string
		MinutesAgo      int
	}{
		{WorkflowIndex: 0, ConversationKey: "delayed_shipment", MinutesAgo: 40},
		{WorkflowIndex: 1, ConversationKey: "damaged_package", MinutesAgo: 30},
		{WorkflowIndex: 2, ConversationKey: "return_refund", MinutesAgo: 18},
	}

	for _, entry := range logs {
		if entry.WorkflowIndex < 0 || entry.WorkflowIndex >= len(workflowIDs) {
			return fmt.Errorf("invalid workflow log index %d", entry.WorkflowIndex)
		}
		conversationID, ok := conversations[entry.ConversationKey]
		if !ok {
			return fmt.Errorf("missing conversation key for workflow log %s", entry.ConversationKey)
		}

		if _, err := db.Pool.Exec(ctx, `
			INSERT INTO workflow_logs (workflow_id, conversation_id, executed_at)
			VALUES ($1, $2, CURRENT_TIMESTAMP - ($3 * INTERVAL '1 minute'))
		`, workflowIDs[entry.WorkflowIndex], conversationID, entry.MinutesAgo); err != nil {
			return fmt.Errorf("failed to create workflow log for %s: %w", entry.ConversationKey, err)
		}
	}

	return nil
}

func seedArticles(ctx context.Context, db *database.Service) error {
	var aiSvc *ai.Service
	if strings.TrimSpace(os.Getenv("GROQ_API_KEY")) != "" {
		aiSvc = ai.New()
	}

	articles := []seededArticle{
		{
			Title:      "How to Upload a New Prescription",
			Collection: "Online Pharmacy Support",
			Section:    "Prescription Management",
			Content:    "You can upload a clear photo or PDF of a valid prescription from the checkout flow or your account prescriptions page. Our team verifies license details and medication instructions before dispensing.",
			Status:     "published",
		},
		{
			Title:      "Prescription Verification Timelines",
			Collection: "Online Pharmacy Support",
			Section:    "Prescription Management",
			Content:    "Most prescriptions are verified within 2 to 6 business hours during pharmacy operating times. If details are missing, we contact you before processing to avoid dispensing delays.",
			Status:     "published",
		},
		{
			Title:      "Transfer a Prescription From Another Pharmacy",
			Collection: "Online Pharmacy Support",
			Section:    "Prescription Management",
			Content:    "Start a transfer request by providing your current pharmacy name, phone number, and prescription label details. We coordinate directly with the previous pharmacy and notify you when transfer is complete.",
			Status:     "published",
		},
		{
			Title:      "Requesting a Refill Online",
			Collection: "Online Pharmacy Support",
			Section:    "Refills",
			Content:    "Open your active prescription and select Refill to submit a new request. Refill orders are processed only when refill count and refill date rules from the prescriber are met.",
			Status:     "published",
		},
		{
			Title:      "Why a Refill Request Is Marked Too Early",
			Collection: "Online Pharmacy Support",
			Section:    "Refills",
			Content:    "Refill requests can be delayed when insurance refill-too-soon limits or prescriber instructions block immediate dispensing. You can submit again on the next eligible date shown in your account.",
			Status:     "published",
		},
		{
			Title:      "Refill Out of Stock - Next Steps",
			Collection: "Online Pharmacy Support",
			Section:    "Refills",
			Content:    "If a refill is temporarily out of stock, we can place your request on hold, propose an equivalent pack size if permitted, or ship when inventory is replenished. We will message you with ETA updates.",
			Status:     "published",
		},
		{
			Title:      "Order Processing and Dispatch Windows",
			Collection: "Online Pharmacy Support",
			Section:    "Orders & Delivery",
			Content:    "Verified medication orders are usually prepared the same day if approved before cutoff. Orders approved after cutoff are dispatched on the next business day.",
			Status:     "published",
		},
		{
			Title:      "Tracking Your Medication Order",
			Collection: "Online Pharmacy Support",
			Section:    "Orders & Delivery",
			Content:    "Tracking links are sent by email and SMS once courier pickup is confirmed. Courier movement can take up to 24 hours to appear after label creation.",
			Status:     "published",
		},
		{
			Title:      "Cold-Chain Medication Delivery Requirements",
			Collection: "Online Pharmacy Support",
			Section:    "Orders & Delivery",
			Content:    "Temperature-sensitive medications are packed with validated cold-chain materials and time-limited delivery windows. Please collect and refrigerate promptly based on package instructions.",
			Status:     "published",
		},
		{
			Title:      "Changing Delivery Address for Medication Orders",
			Collection: "Online Pharmacy Support",
			Section:    "Orders & Delivery",
			Content:    "Address changes are allowed only before a pharmacy order reaches packed status. For controlled medications, delivery address changes may be restricted by regulation.",
			Status:     "published",
		},
		{
			Title:      "Damaged, Incorrect, or Missing Medication Orders",
			Collection: "Online Pharmacy Support",
			Section:    "Orders & Delivery",
			Content:    "Report packaging damage, wrong items, or missing items within 24 hours with clear photos of labels and contents. We review eligibility and arrange replacement or refund when applicable.",
			Status:     "published",
		},
		{
			Title:      "Accepted Payment Methods and HSA/FSA Cards",
			Collection: "Online Pharmacy Support",
			Section:    "Billing & Insurance",
			Content:    "We accept major credit and debit cards, selected wallets, and eligible HSA/FSA cards for qualifying items. Payment authorization occurs at order placement and capture occurs at dispatch.",
			Status:     "published",
		},
		{
			Title:      "Insurance Claims and Copay Questions",
			Collection: "Online Pharmacy Support",
			Section:    "Billing & Insurance",
			Content:    "Insurance pricing depends on plan formulary, eligibility, and pharmacy benefit rules. Copay amounts are finalized after claim adjudication and may differ from pre-checkout estimates.",
			Status:     "published",
		},
		{
			Title:      "Account Access, Password Reset, and Privacy Requests",
			Collection: "Online Pharmacy Support",
			Section:    "Account & Privacy",
			Content:    "Use Forgot Password on the login page to restore access, then verify recent prescriptions in your account timeline. For privacy requests, contact support from your verified email so we can confirm identity before sharing account data.",
			Status:     "published",
		},
	}

	for _, article := range articles {
		var embeddingParam *string
		if aiSvc != nil {
			embedding, err := aiSvc.GenerateEmbedding(ctx, article.Title+"\n\n"+article.Content)
			if err != nil {
				fmt.Printf("Warning: failed to create embedding for article %s: %v\n", article.Title, err)
			} else {
				embeddingParam = seedVectorLiteral(embedding)
			}
		}

		if _, err := db.Pool.Exec(
			ctx,
			`INSERT INTO articles (title, collection_name, section_name, content, status, view_count, embedding)
			 VALUES ($1, $2, $3, $4, $5, 0, $6::vector)`,
			article.Title,
			article.Collection,
			article.Section,
			article.Content,
			article.Status,
			embeddingParam,
		); err != nil {
			return err
		}
	}

	return nil
}

func seedVectorLiteral(values []float32) *string {
	if len(values) == 0 {
		return nil
	}

	parts := make([]string, len(values))
	for i, value := range values {
		parts[i] = strconv.FormatFloat(float64(value), 'f', -1, 32)
	}

	literal := "[" + strings.Join(parts, ",") + "]"
	return &literal
}
