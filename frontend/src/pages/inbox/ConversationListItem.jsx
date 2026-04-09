import {
  getSourceBadgeClasses,
  getSourceLabel,
} from "../../utils/conversationDisplay";

export default function ConversationListItem({
  chat,
  isActive,
  isSelected,
  onToggleSelected,
  onSelect,
}) {
  return (
    <div className={`inbox-thread-card ${isActive ? "active" : ""}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelected}
        onClick={(event) => event.stopPropagation()}
        className="absolute left-3 top-4 h-3.5 w-3.5 cursor-pointer"
        style={{ accentColor: "var(--brand-accent)" }}
      />
      <button
        type="button"
        onClick={onSelect}
        className="w-full px-4 py-3 pl-8 text-left"
      >
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3
            className="inbox-thread-title text-sm font-semibold"
            style={{ color: "var(--app-text)" }}
          >
            {chat.customer_name}
          </h3>
          <span
            className="inbox-thread-meta text-xs"
            style={{ color: "var(--app-text-soft)" }}
          >
            {new Date(chat.updated_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p
          className="inbox-thread-preview truncate text-sm"
          style={{ color: "var(--app-text-muted)" }}
        >
          {chat.preview}
        </p>
        <div
          className="inbox-thread-meta mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em]"
          style={{ color: "var(--app-text-soft)" }}
        >
          <span>{chat.status}</span>
          <span>|</span>
          <span>{chat.assignee_id ? "Assigned" : "Unassigned"}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${getSourceBadgeClasses(
              chat.source,
            )}`}
          >
            {getSourceLabel(chat.source, "support")}
          </span>
        </div>
        {chat.subject && (
          <p
            className="inbox-thread-meta mt-2 truncate text-xs font-medium"
            style={{ color: "var(--app-text-soft)" }}
          >
            Subject: {chat.subject}
          </p>
        )}
        {chat.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chat.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inbox-thread-tag rounded-full px-2.5 py-1 text-[11px] font-medium lowercase"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
