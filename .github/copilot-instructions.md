# AICM - AI Customer Support Platform

AI-first customer support prototype with Go backend (port 8900) and React frontend (port 7200). Uses Groq for AI features, PostgreSQL for storage, and WebSocket for real-time messaging.

## Stack

**Backend:**
- Go 1.25+ with `go-chi/chi` router
- PostgreSQL with pgvector extension
- JWT authentication (`golang-jwt/jwt`)
- WebSocket for real-time chat (`gorilla/websocket`)
- Groq API for AI (chat completions, copilot, knowledge retrieval)

**Frontend:**
- React 19 + React Router 7
- Vite build tool
- Vitest for unit tests, Playwright for E2E
- Tailwind CSS 4

## Local Development

### Start the Stack

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Backend (with hot reload using Air)
cd backend
go run ./cmd/api
# Or with Air: air

# 3. Frontend
cd frontend
npm install
npm run dev
```

### Environment Setup

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection string
- `GROQ_API_KEY` - Groq API key for AI features
- `JWT_SECRET` - Signing key for authentication tokens
- `PORT` - Backend API port (default: 8900)

### First Admin Account

Bootstrap an admin on fresh installs:

```bash
curl -X POST http://localhost:8900/api/auth/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"supersecret123"}'
```

Default demo accounts:
- `admin@aicm.local` / `Admin12345!`
- `agent@aicm.local` / `Agent12345!`

## Build, Test, and Lint Commands

### Backend (Go)

```bash
cd backend

# Run tests
go test ./...

# Run tests with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Run single test
go test -run TestClassifyConfidence ./internal/handlers

# Run specific package tests
go test ./internal/handlers
go test ./internal/middleware

# Build binary
go build -o api.exe ./cmd/api

# Hot reload (requires Air: github.com/air-verse/air)
air  # Uses .air.toml config
```

### Frontend (React)

```bash
cd frontend

# Run unit tests (Vitest)
npm test              # Sequential run via custom script
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report

# Run single test file
npx vitest run src/pages/inbox/useInboxConversationsLoader.test.jsx

# Run E2E tests (Playwright)
npm run test:e2e      # Headless
npm run test:e2e:ui   # Interactive UI mode

# Lint
npm run lint

# Build for production
npm run build
```

## Architecture

### Backend Structure

```
backend/
├── cmd/api/main.go              # Entry point
├── internal/
│   ├── server/                  # HTTP server, routing, middleware setup
│   │   ├── server.go            # Chi router, CORS, security headers
│   │   └── swagger.go           # OpenAPI docs at /swagger
│   ├── handlers/                # HTTP request handlers
│   │   ├── auth*.go             # Authentication, bootstrap, user creation
│   │   ├── conversation.go      # Inbox, messages, AI agent responses
│   │   ├── knowledge.go         # Articles, collections, sections
│   │   ├── ticket.go            # Ticketing workflow
│   │   ├── workflow.go          # Automation rules
│   │   ├── analytics.go         # Metrics dashboard
│   │   ├── settings.go          # AI persona, widget branding
│   │   ├── widget.go            # Public messenger initialization
│   │   └── websocket.go         # WebSocket handler
│   ├── middleware/              # Request middleware
│   │   ├── auth.go              # JWT validation, role extraction
│   │   └── rate_limit.go        # IP-based rate limiting
│   ├── ai/                      # AI service integration
│   │   └── groq.go              # Groq chat completions client
│   ├── ws/                      # WebSocket hub
│   │   └── hub.go               # Connection management, message routing
│   ├── database/                # PostgreSQL connection pool (pgx/v5)
│   └── models/                  # Request/response structs
├── schema.sql                   # Database schema (manual apply)
└── uploads/                     # File upload storage (local filesystem)
```

**Server Initialization Flow:**
1. `main.go` loads `.env` and creates `database.Service` and `ai.Service`
2. `server.New()` creates Chi router with CORS and security headers
3. `registerRoutes()` sets up public, auth, and protected endpoints
4. `StartScheduler()` runs background jobs (workflow engine)

**Route Organization:**
- `/api/health` - Health check
- `/api/auth/*` - Registration, login, bootstrap (rate-limited)
- `/api/widget/*` - Public messenger initialization
- `/api/ws/{id}` - WebSocket upgrade endpoint
- `/api/articles` - Public knowledge base (no auth)
- `/api/protected/*` - Authenticated endpoints (requires JWT via `RequireAuth` middleware)

### Frontend Structure

```
frontend/src/
├── pages/                       # Route components
│   ├── inbox/                   # Shared inbox (agent/admin workspace)
│   ├── knowledge/               # Article management
│   ├── dashboard/               # Analytics
│   ├── workflows/               # Automation rules
│   ├── customer/                # Customer dashboard
│   └── landing/                 # Public site, help center
├── components/                  # Reusable UI components
│   ├── ui/                      # Base components (Button, Modal, etc.)
│   ├── messenger/               # Widget messenger embed
│   └── help/                    # Help center article viewer
├── context/                     # React context providers
│   ├── BrandingContext.jsx      # Widget appearance settings
│   └── branding-context.js      # Legacy context (being migrated)
├── auth.js                      # JWT token management
├── branding.js                  # Branding API client
└── App.jsx                      # Route definitions
```

**Frontend Testing Patterns:**
- Unit tests use Vitest with `@testing-library/react`
- Custom hooks tested with `renderHook` from `@testing-library/react`
- E2E tests in `frontend/e2e/` use Playwright
- Tests follow `*.test.jsx` naming convention
- Run sequentially via `scripts/run-vitest-sequential.mjs` to avoid port conflicts

### Database

- PostgreSQL with `pgvector` extension (for future semantic search)
- Connection pooling via `jackc/pgx/v5`
- Schema applied manually via `backend/schema.sql` (no migration tool)
- Tables: `users`, `conversations`, `messages`, `articles`, `tickets`, `workflows`, `workflow_runs`, etc.

**Key Tables:**
- `users` - Three roles: `customer`, `agent`, `admin`
- `conversations` - Inbox entries with status, assignee, tags, AI metadata
- `messages` - Chat messages with `is_internal` flag for notes
- `articles` - Knowledge Hub content with collections/sections

### WebSocket Architecture

Real-time messaging powered by `gorilla/websocket`:

1. **Connection Lifecycle:**
   - Client connects via `GET /api/ws/{id}` with JWT query param
   - Server validates JWT and creates client in hub
   - Client auto-reconnects on disconnect

2. **Message Flow:**
   - Client sends JSON messages to `ws.Hub`
   - Hub broadcasts to all clients in the same conversation
   - Messages persisted to database via handlers
   - Typing indicators and read receipts use ephemeral WebSocket-only messages

3. **Hub Structure (`backend/internal/ws/hub.go`):**
   - Central registry of active connections
   - Routes messages between clients
   - Handles client registration/unregistration
   - Thread-safe with channel-based concurrency

### AI Integration

All AI features use **Groq only** (OpenAI references in code point to Groq's OpenAI-compatible API):

**AI Service (`backend/internal/ai/groq.go`):**
- `GenerateReply()` - Customer-facing AI agent responses
- `GenerateCopilot()` - Internal agent reply suggestions
- `GenerateSummary()` - Conversation summaries
- Knowledge-grounded responses via article retrieval

**Configuration:**
- `GROQ_API_KEY` - API key
- `GROQ_MODEL` - Model identifier (default: `llama-3.1-8b-instant`)

**Knowledge Retrieval:**
- Hybrid search: keyword tokenization + semantic similarity (planned with pgvector)
- Articles matched against customer queries
- Top matches passed as context to Groq

## Key Conventions

### Authentication & Authorization

**JWT Flow:**
1. Login via `POST /api/auth/login` returns JWT token
2. Frontend stores token in `localStorage` (via `auth.js`)
3. Protected routes require `Authorization: Bearer <token>` header
4. `middleware.RequireAuth` validates token and extracts `user_id` and `role`
5. Claims stored in request context via `middleware.UserContextKey`

**Role-Based Access:**
- `customer` - Can only access own conversations and customer dashboard
- `agent` - Can access inbox, knowledge hub, tickets (no admin features)
- `admin` - Full access including user management, settings, workflows

**Context Extraction Pattern:**
```go
userID, role, ok := extractIdentityFromContext(r.Context())
if !ok {
    http.Error(w, "Forbidden", http.StatusForbidden)
    return
}
```

### Error Handling Patterns

**Backend:**
- Return `http.Error(w, message, statusCode)` for simple errors
- Use `errorMessageAndCode` struct for complex validation
- Log internal errors, return generic messages to clients
- No custom error middleware (Chi's Recoverer catches panics)

**Example:**
```go
if err := doSomething(); err != nil {
    log.Printf("Failed to do something: %v", err)
    http.Error(w, "Internal server error", http.StatusInternalServerError)
    return
}
```

**Frontend:**
- Display API errors in UI (modals, toast-like alerts)
- 403 responses trigger navigation to login
- WebSocket reconnection handled automatically

### Testing Conventions

**Go Tests:**
- Table-driven tests preferred (see `conversation_test.go`, `ticket_test.go`)
- Test files colocated with code: `handler_test.go` next to `handler.go`
- Unit tests for business logic functions (scoring, validation)
- No integration tests or test database setup currently

**React Tests:**
- Test user-facing behavior, not implementation details
- Mock `fetch` globally in tests via `vi.stubGlobal`
- Use `waitFor` for async assertions
- Test hooks in isolation with `renderHook`

**Example Test Pattern:**
```jsx
beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

it("loads data on mount", async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => data });
  renderHook(() => useMyHook());
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
});
```

### API Endpoint Naming

- REST-like: `/api/protected/articles` (list), `/api/protected/articles/{id}` (get/update/delete)
- Actions as suffixes: `/api/protected/conversations/{id}/assign`, `/api/protected/conversations/{id}/merge`
- Nested resources: `/api/protected/tickets/{id}/comments`
- Bulk operations: `/api/protected/conversations/bulk`

### Code Style

**Go:**
- Standard `gofmt` formatting
- Prefer explicit error handling (no `must*` helpers)
- Context passed as first argument
- Struct-based handlers with DB/AI dependencies

**React:**
- Functional components with hooks
- Custom hooks prefixed with `use*`
- Context providers for cross-cutting concerns (auth, branding)
- Inline styles avoided (use Tailwind classes)

### Database Queries

- Use `pgx.Pool.QueryRow` for single-row reads
- Use `pgx.Pool.Query` for multi-row reads with `defer rows.Close()`
- Parameterized queries ($1, $2) to prevent SQL injection
- No ORM (raw SQL only)

**Example:**
```go
rows, err := db.Pool.Query(ctx, "SELECT id, name FROM users WHERE role = $1", role)
if err != nil {
    return nil, err
}
defer rows.Close()

var users []User
for rows.Next() {
    var u User
    if err := rows.Scan(&u.ID, &u.Name); err != nil {
        return nil, err
    }
    users = append(users, u)
}
return users, rows.Err()
```

## Deployment

### Docker

Each service has a Dockerfile:
- `backend/Dockerfile` - Multi-stage Go build
- `frontend/Dockerfile` - Vite build with nginx serving

**Production Compose:**
```bash
# Build and push images (requires Docker Hub auth)
./build_and_push.sh  # or build_and_push.ps1 on Windows

# Deploy with docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

**Backend:**
```bash
cd backend
go build -o api ./cmd/api
DATABASE_URL=... GROQ_API_KEY=... ./api
```

**Frontend:**
```bash
cd frontend
npm run build
# Serve dist/ with any static file server
```

## Common Tasks

### Add a New API Endpoint

1. Define handler method in `backend/internal/handlers/`
2. Register route in `backend/internal/server/server.go` `registerRoutes()`
3. Add middleware if needed (`middleware.RequireAuth`, `middleware.RateLimitByIP`)
4. Update OpenAPI spec in `swagger.go` (optional but recommended)

### Add a New Frontend Page

1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.jsx`
3. Import in navigation components if needed

### Run Database Migrations

No migration tool currently. To modify schema:

1. Update `backend/schema.sql`
2. Apply manually via `psql` or pgAdmin:
   ```bash
   psql $DATABASE_URL < backend/schema.sql
   ```
3. For live systems, write additive migrations (use `IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`)

### Debug WebSocket Issues

1. Check browser DevTools Network tab for WebSocket connection
2. Backend logs show client connections/disconnections
3. Test with `wscat`: `wscat -c "ws://localhost:8900/api/ws/convo-id?token=JWT"`
4. Verify JWT token is valid and includes correct `user_id`

### Reset Demo Data

Use the `reset_demo_data` utility (located in `backend/cmd/reset_demo_data/`) to restore fresh demo data:

```bash
cd backend
go run ./cmd/reset_demo_data
```

## URLs

- Frontend: `http://localhost:7200`
- Backend API: `http://localhost:8900`
- API Documentation: `http://localhost:8900/swagger`
- OpenAPI JSON: `http://localhost:8900/swagger/openapi.json`

## Reference Docs

See `references/` directory for detailed guides:
- `showcase_master_guide.md` - Complete demo walkthrough
- `showcase_admin_quickstart.md` - Admin role features
- `showcase_agent_quickstart.md` - Agent role features
- `showcase_customer_quickstart.md` - Customer experience
- `verification_runbook.md` - Feature verification checklist
- `prd_traceability_matrix.md` - Requirements mapping
