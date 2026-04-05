-- Enable pgvector for optional semantic search experiments on Knowledge Hub articles.
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (Handles both Admin, Support Agents, and End Customers)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(50) NOT NULL CHECK (role IN ('customer', 'agent', 'admin')),
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL DEFAULT '', -- Add this line!
    custom_attributes JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table (The core of the shared inbox and messenger)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(id),
    assignee_id UUID REFERENCES users(id), -- Can be NULL if unassigned
    source VARCHAR(20) NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'email')),
    subject VARCHAR(255),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'snoozed')),
    ai_confidence_score DOUBLE PRECISION DEFAULT 0,
    ai_confidence_label VARCHAR(20) DEFAULT 'unknown' CHECK (ai_confidence_label IN ('unknown', 'none', 'low', 'medium', 'high')),
    ai_last_outcome VARCHAR(20) DEFAULT 'unknown' CHECK (ai_last_outcome IN ('unknown', 'answered', 'escalated', 'unanswered')),
    ai_source_title VARCHAR(255),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    customer_last_read_at TIMESTAMP WITH TIME ZONE,
    agent_last_read_at TIMESTAMP WITH TIME ZONE,
    merged_into_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages table (Individual messages within a conversation)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id), -- Who sent it (customer, agent, or AI)
    content TEXT NOT NULL,
    attachment_url TEXT,
    attachment_name VARCHAR(255),
    attachment_type VARCHAR(50),
    is_ai_generated BOOLEAN DEFAULT FALSE,
    is_internal BOOLEAN DEFAULT FALSE, -- Added for internal notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Hub Articles (Used for AI Copilot and AI Agent retrieval)
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    collection_name VARCHAR(120) NOT NULL DEFAULT 'General',
    section_name VARCHAR(120) NOT NULL DEFAULT 'General',
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    view_count INTEGER DEFAULT 0, -- Added for analytics
    -- Reserved for optional vector data if semantic search is reintroduced later.
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tickets table for complex issue tracking
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES users(id) NOT NULL,
    assignee_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Comments (Internal thread for agents)
CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ticket notifications (simulated customer-facing updates for the prototype)
CREATE TABLE IF NOT EXISTS ticket_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES users(id) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflows table (Stores the automation rules)
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_condition TEXT NOT NULL DEFAULT '',
    conditions JSONB,
    condition_logic VARCHAR(10) DEFAULT 'and',
    action_type VARCHAR(50) NOT NULL,
    action_payload TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflow Logs (Tracks which rules fired on which conversations)
CREATE TABLE IF NOT EXISTS workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Singleton AI settings for persona configuration.
CREATE TABLE IF NOT EXISTS ai_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name VARCHAR(255) NOT NULL DEFAULT 'AI Agent',
    greeting TEXT NOT NULL DEFAULT 'Hi, I''m your AI support assistant.',
    tone VARCHAR(50) NOT NULL DEFAULT 'friendly',
    brand_name VARCHAR(255) NOT NULL DEFAULT 'AICM Support',
    accent_color VARCHAR(7) NOT NULL DEFAULT '#2563EB',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
