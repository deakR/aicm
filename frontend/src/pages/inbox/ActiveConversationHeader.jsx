import { useState } from "react";
import {
  getSourceBadgeClasses,
  getSourceLabel,
} from "../../utils/conversationDisplay";

export default function ActiveConversationHeader({
  activeChat,
  agents,
  wsState,
  showConversationRail,
  showDetailsRail,
  onToggleConversationRail,
  onToggleDetailsRail,
  onOpenMerge,
  onUpdateConversation,
  onAddTag,
  onRemoveTag,
}) {
  const [newTag, setNewTag] = useState("");

  if (!activeChat) {
    return null;
  }

  return (
    <div
      className="app-page-header z-10 border-b p-4"
      style={{ borderColor: "var(--app-border)" }}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              className="truncate text-lg font-bold"
              style={{ color: "var(--app-text)" }}
            >
              {activeChat.customer_name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getSourceBadgeClasses(activeChat.source)}`}
              >
                {getSourceLabel(activeChat.source, "support")}
              </span>
              {activeChat.subject && (
                <span className="app-chip px-2.5 py-1 text-[11px] font-medium">
                  Subject: {activeChat.subject}
                </span>
              )}
              <span
                className={`app-status-pill rounded-full px-2 py-1 text-[11px] font-medium uppercase ${
                  activeChat.ai_confidence_label === "high"
                    ? "app-status-pill-open"
                    : activeChat.ai_confidence_label === "medium"
                      ? "app-status-pill-pending"
                      : activeChat.ai_confidence_label === "low"
                        ? "app-status-pill-danger"
                        : "app-status-pill-default"
                }`}
              >
                AI {activeChat.ai_confidence_label || "unknown"}
              </span>
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
            {wsState === "connected"
              ? "Realtime connected"
              : wsState === "reconnecting" || wsState === "connecting"
                ? "Realtime connecting"
                : "Realtime offline"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleConversationRail}
            className="app-secondary-button"
          >
            {showConversationRail ? "Hide list" : "Show list"}
          </button>
          <select
            value={activeChat.status}
            onChange={(event) =>
              onUpdateConversation({ status: event.target.value })
            }
            className="app-input cursor-pointer rounded-full px-2 py-1 text-xs font-medium"
          >
            <option value="open">OPEN</option>
            <option value="pending">PENDING</option>
            <option value="resolved">RESOLVED</option>
            <option value="snoozed">SNOOZED</option>
          </select>
          <select
            value={activeChat.assignee_id || ""}
            onChange={(event) =>
              onUpdateConversation({ assignee_id: event.target.value || "" })
            }
            className="app-input cursor-pointer rounded-full px-2 py-1 text-xs font-medium"
          >
            <option value="">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onOpenMerge}
            className="app-secondary-button"
            title="Merge this conversation into another"
          >
            Merge
          </button>
          <button
            type="button"
            onClick={onToggleDetailsRail}
            className="app-secondary-button"
          >
            {showDetailsRail ? "Hide details" : "Show details"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--app-border)" }}>
          {(activeChat.tags || []).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onRemoveTag(tag)}
              className="app-chip rounded-full px-3 py-1 text-xs font-medium lowercase transition"
              title="Remove tag"
            >
              {tag} x
            </button>
          ))}
          <div className="flex flex-1 min-w-[220px] items-center gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(event) => setNewTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAddTag(newTag, setNewTag);
                }
              }}
              placeholder="Add tag"
              className="app-input min-w-0 flex-1 rounded-full px-3 py-1.5 text-xs outline-none"
              style={{ borderColor: "var(--app-border)" }}
            />
            <button
              type="button"
              onClick={() => onAddTag(newTag, setNewTag)}
              className="app-primary-button rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              Add tag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
