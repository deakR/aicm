import { getSourceLabel } from "../../utils/conversationDisplay";

export const defaultInboxFilters = {
  status: "",
  assignee_id: "",
  days: "",
  tag: "",
  source: "",
};

export const defaultEmailDraft = {
  name: "",
  email: "",
  subject: "",
  content: "",
};

export function matchesConversationFilters(conversation, filters) {
  if (!conversation) return false;
  if (filters.status && conversation.status !== filters.status) return false;
  if (
    filters.assignee_id &&
    (conversation.assignee_id || "") !== filters.assignee_id
  ) {
    return false;
  }
  if (filters.source && conversation.source !== filters.source) return false;
  if (
    filters.tag.trim() &&
    !(conversation.tags || [])
      .map((tag) => String(tag).toLowerCase())
      .includes(filters.tag.trim().toLowerCase())
  ) {
    return false;
  }
  if (filters.days) {
    const updatedAt = new Date(conversation.updated_at);
    if (Number.isNaN(updatedAt.getTime())) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(filters.days));
    if (updatedAt < cutoff) return false;
  }
  return true;
}

export function buildInboxFilterSummary(filters, agents) {
  const parts = [];
  if (filters.status) parts.push(`Status: ${filters.status}`);
  if (filters.assignee_id) {
    const assignee = agents.find((agent) => agent.id === filters.assignee_id);
    parts.push(`Assignee: ${assignee?.name || "Selected"}`);
  }
  if (filters.days) {
    const labels = { 1: "24h", 7: "7d", 30: "30d" };
    parts.push(`Updated: ${labels[filters.days] || filters.days}`);
  }
  if (filters.tag.trim()) parts.push(`Tag: ${filters.tag.trim()}`);
  if (filters.source) {
    parts.push(`Source: ${getSourceLabel(filters.source, "support")}`);
  }
  return parts.length
    ? parts.join(" | ")
    : "All conversations, all assignees, any time, any source";
}

export function getInboxPanelLayout(showConversationRail, showDetailsRail) {
  if (showConversationRail && showDetailsRail) {
    return {
      storageKey: "aicm:inbox-panels:list:details",
      initialSizes: [18, 58, 24],
      minSizes: [220, 540, 260],
    };
  }

  if (showConversationRail) {
    return {
      storageKey: "aicm:inbox-panels:list:nodetails",
      initialSizes: [19, 81],
      minSizes: [220, 620],
    };
  }

  if (showDetailsRail) {
    return {
      storageKey: "aicm:inbox-panels:nol:details",
      initialSizes: [76, 24],
      minSizes: [680, 260],
    };
  }

  return {
    storageKey: "aicm:inbox-panels:nol:nodetails",
    initialSizes: [100],
    minSizes: [760],
  };
}
