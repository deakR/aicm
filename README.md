# AICM

AI-first customer support prototype built with a Go backend and a React frontend. The current setup uses Groq for chat, copilot generation, and grounded support replies.

## What a New User Can Try

When someone opens the project for the first time, they can explore two sides of the product:

### Public customer experience

- Open the landing page at `http://localhost:7200`.
- Launch the web messenger from the bottom-right corner.
- Fill the pre-chat form with name and email.
- Ask support questions and receive AI answers grounded in the Knowledge Hub.
- See typing and read-state feedback during live chat.
- Open the widget Help Center tab and browse public articles inside the messenger.
- Visit the standalone Help Center at `http://localhost:7200/help`.
- Search articles, browse by collection and section, and open article details.

### Internal support workspace

- Sign in at `http://localhost:7200/login`.
- Use the shared inbox to see live customer conversations.
- Assign conversations to agents and add internal notes.
- Tag conversations and filter the inbox by tag.
- Open AI copilot suggestions and conversation summaries.
- Create and update tickets linked to customer conversations.
- Manage help articles in the Knowledge Hub with collections, sections, and a rich-text editor.
- Create automation rules and inspect recent workflow runs.
- Review support metrics on the dashboard.
- Manage admins, agents, and test customers from the admin-only Users page.
- Adjust the AI assistant persona and public widget branding from the admin-only AI Settings page.
- Explore the interactive API docs at `http://localhost:8900/swagger`.

## Main Demo Journey

This is the fastest way to understand the product end to end:

1. Start on the public landing page and open the messenger.
2. Begin a chat as a customer and ask a product or support question.
3. Watch the AI assistant respond with knowledge-based guidance.
4. Sign in as an admin or agent and open the inbox.
5. Find the live conversation, add an internal note, and send a human reply.
6. Convert the issue into a ticket and update its status.
7. Review the dashboard and workflows to see how the platform supports operations.

## Feature Snapshot

- AI Agent for customer replies with article-backed answers
- AI Copilot for reply suggestions and summaries
- Shared inbox with assignment and internal notes
- Conversation tags and inbox filtering
- Web messenger with pre-chat onboarding, typing, and read-state feedback
- Public Help Center and Knowledge Hub article management with collections, sections, and rich media embeds
- Ticketing workflow for multi-step support cases
- Automation rules with run logs
- Analytics dashboard for support and AI metrics
- Admin user-management page for creating accounts
- Admin-only AI settings for assistant name, greeting, tone, and widget branding
- Swagger-based API explorer for backend testing

## Local URLs

- Frontend: `http://localhost:7200`
- Backend API: `http://localhost:8900`
- Swagger UI: `http://localhost:8900/swagger`
- OpenAPI JSON: `http://localhost:8900/swagger/openapi.json`

## Local Setup

### Prerequisites

- Go
- Node.js + npm
- Docker Desktop or a local PostgreSQL instance

### Environment

Create a `.env` file in the repo root using `.env.example` as a base.

Important variables:

- `DATABASE_URL`
- `PORT`
- `JWT_SECRET`
- `GROQ_API_KEY`
- `GROQ_MODEL`

### Start the stack

1. Start PostgreSQL with Docker Compose:

```bash
docker compose up -d
```

2. Start the backend:

```bash
cd backend
go run ./cmd/api
```

3. Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

## First Admin Setup

If you do not already have an admin account, create one with:

```http
POST /api/auth/bootstrap-admin
Content-Type: application/json

{
  "name": "Platform Admin",
  "email": "admin@example.com",
  "password": "supersecret123"
}
```

Then sign in through `http://localhost:7200/login`.

## Accounts And Auth Guide

This project has three roles: `admin`, `agent`, and `customer`.

### How each role signs in

- `admin`
  - signs in at `http://localhost:7200/login`
  - lands in the internal workspace
  - default redirect is `/dashboard`
- `agent`
  - signs in at `http://localhost:7200/login`
  - lands in the internal workspace
  - default redirect is `/inbox`
- `customer`
  - can sign in at `http://localhost:7200/login` if they have a password-backed account
  - default redirect is `/customer`
  - can also start from the public site at `http://localhost:7200`
  - the widget creates or reuses the customer session and conversation when they chat by email

### How account creation works today

- First admin on a fresh install:
  - use `POST /api/auth/bootstrap-admin`
- Additional admins or agents:
  - sign in as an existing admin
  - call `POST /api/protected/users`
  - or use the admin Users page at `http://localhost:7200/users`
- Customers:
  - are usually created automatically from the widget when they start a chat
  - can also be created by an admin through `POST /api/protected/users`

### Example admin and agent creation flow

1. Log in as an existing admin:

```bash
curl -X POST http://localhost:8900/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@aicm.local\",\"password\":\"Admin12345!\"}"
```

2. Use the returned JWT with `POST /api/protected/users`.

Create an agent:

```bash
curl -X POST http://localhost:8900/api/protected/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -d "{\"name\":\"Support Agent\",\"email\":\"agent2@example.com\",\"password\":\"supersecret123\",\"role\":\"agent\"}"
```

Create another admin:

```bash
curl -X POST http://localhost:8900/api/protected/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -d "{\"name\":\"Second Admin\",\"email\":\"admin2@example.com\",\"password\":\"supersecret123\",\"role\":\"admin\"}"
```

### Current demo accounts

- `admin@aicm.local` / `Admin12345!`
- `agent@aicm.local` / `Agent12345!`
- `billing@aicm.local` / `Billing12345!`

### Customer login note

Customers can now use the lightweight customer dashboard at `http://localhost:7200/customer` if they have a password-backed account. Widget-created customers with blank passwords should still continue through the public messenger using the same email address.

## AI Provider Note

- This project now uses only Groq for AI features.
- You may still see `/openai/v1` in the Groq base URL if you inspect backend config.
- That is not an OpenAI integration or a separate OpenAI endpoint in the app.
- It is Groq's OpenAI-compatible API surface, which lets the backend use a familiar chat-completions format.

## Practice CI/CD (GitHub Actions + Azure VM)

This repo now supports a beginner-friendly CI/CD path:

1. CI runs on PRs and pushes (`frontend-quality`, `frontend-e2e`, `backend-quality`, `docker-build-validation`).
2. On push to `main`, GitHub Actions builds and pushes backend/frontend images to Docker Hub.
3. The same workflow deploys to one Azure VM over SSH using `deploy.sh`.

### Required GitHub repository secrets

- `DOCKER_USERNAME` - Docker Hub username
- `DOCKERHUB_TOKEN` - Docker Hub access token (not your password)
- `AZURE_VM_HOST` - Public IP or DNS of your VM
- `AZURE_VM_USER` - SSH user on VM
- `AZURE_VM_SSH_KEY` - Private SSH key content used by GitHub Actions
- `AZURE_VM_APP_PATH` - Absolute path on VM where this repo is cloned (example: `/home/azureuser/aicm`)
- `AUTO_DEPLOY_ENABLED` - Set to `true` for automatic deploy; set to `false` as an emergency kill switch
- `RUN_DEMO_SEED` - Optional; set `true` only when you intentionally want demo data reseeded after deploy

### One-time VM preparation

1. SSH into VM and install Docker + Docker Compose plugin.
2. Ensure Git is installed on the VM (`git --version`).
3. Choose an app path and set it in `AZURE_VM_APP_PATH` (example: `/home/azureuser/aicm`).
4. Create `.env` in that path using `.env.example` and set production-like values.
5. Ensure the VM user can run Docker commands.
6. Optional manual smoke deploy:

```bash
cd /path/to/aicm
chmod +x deploy.sh
DOCKER_USERNAME=your-dockerhub-user RUN_DEMO_SEED=false ./deploy.sh
```

### Deployment behavior

- Deploy runs automatically only for pushes to `main`.
- On first deploy, the workflow auto-clones the repository to `AZURE_VM_APP_PATH`.
- On later deploys, the workflow auto-fetches and fast-forwards that checkout.
- If `AUTO_DEPLOY_ENABLED=false`, deployment is skipped while CI still runs.
- `deploy.sh` is non-destructive by default and skips demo reseeding unless `RUN_DEMO_SEED=true`.
- Images are pushed with both `latest` and commit SHA tags.

### Manual fallback

If you need to bypass GitHub Actions temporarily, use:

- `build_and_push.sh` (Linux/macOS)
- `build_and_push.ps1` (Windows PowerShell)

These scripts remain available for troubleshooting but are not the primary deployment path.

## Notes

- Customer-style users can use the public site and messenger, or the customer dashboard if a password-backed account exists.
- Agent and admin users are intended for the internal workspace.
- The project is optimized for a demo-ready prototype rather than production scale.
