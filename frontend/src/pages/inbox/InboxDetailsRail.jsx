import {
  getSourceBadgeClasses,
  getSourceLabel,
} from "../../utils/conversationDisplay";

export default function InboxDetailsRail({
  activeChat,
  activeCustomer,
  conversations,
  agents,
  copilot,
  isUploading,
  isCreatingTicket,
  onSetMessagePrompt,
  onSendSuggestedReply,
  onCreateTicket,
}) {
  if (!activeChat) {
    return (
      <div
        className="flex flex-1 items-center justify-center p-6 text-center text-sm"
        style={{ color: "var(--app-text-muted)" }}
      >
        Pick a conversation to see the customer profile and AI copilot details.
      </div>
    );
  }

  return (
    <>
      <div className="app-page-header p-5">
        <div
          className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
          style={{
            background: "color-mix(in srgb, var(--brand-accent-soft) 60%, var(--app-card))",
            color: "var(--brand-accent-dark)",
          }}
        >
          {activeChat.customer_name.charAt(0)}
        </div>
        <h3 className="text-center font-bold" style={{ color: "var(--app-text)" }}>
          {activeChat.customer_name}
        </h3>
        <p
          className="mb-4 text-center text-sm"
          style={{ color: "var(--app-text-muted)" }}
        >
          Customer via {getSourceLabel(activeChat.source, "support")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="app-detail-card mb-6 p-4">
          <h3 className="app-section-kicker">Customer profile</h3>
          <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--app-text-muted)" }}>
            <p>
              <span className="font-semibold" style={{ color: "var(--app-text)" }}>Source:</span>{" "}
              {getSourceLabel(activeChat.source, "support")}
            </p>
            {activeChat.subject && (
              <p>
                <span className="font-semibold" style={{ color: "var(--app-text)" }}>Subject:</span>{" "}
                {activeChat.subject}
              </p>
            )}
            <p>
              <span className="font-semibold" style={{ color: "var(--app-text)" }}>Name:</span>{" "}
              {activeCustomer?.name || activeChat.customer_name}
            </p>
            <p>
              <span className="font-semibold" style={{ color: "var(--app-text)" }}>Email:</span>{" "}
              {activeCustomer?.email || "Unknown"}
            </p>
            <p>
              <span className="font-semibold" style={{ color: "var(--app-text)" }}>
                Conversations loaded:
              </span>{" "}
              {
                conversations.filter(
                  (chat) => chat.customer_id === activeChat.customer_id,
                ).length
              }
            </p>
            <p>
              <span className="font-semibold" style={{ color: "var(--app-text)" }}>Assignee:</span>{" "}
              {agents.find((agent) => agent.id === activeChat.assignee_id)
                ?.name || "Unassigned"}
            </p>
            <p>
              <span className="font-semibold" style={{ color: "var(--app-text)" }}>Tags:</span>{" "}
              {(activeChat.tags || []).length
                ? activeChat.tags.join(", ")
                : "None yet"}
            </p>
            {activeCustomer?.custom_attributes &&
              Object.keys(activeCustomer.custom_attributes).length > 0 && (
                <div className="mt-3 border-t app-surface-divider pt-3">
                  <p className="app-section-kicker mb-1">Custom Attributes</p>
                  {Object.entries(activeCustomer.custom_attributes).map(
                    ([key, value]) => (
                      <p
                        key={key}
                        className="text-sm"
                        style={{ color: "var(--app-text-muted)" }}
                      >
                        <span
                          className="font-semibold capitalize"
                          style={{ color: "var(--app-text)" }}
                        >
                          {key.replace(/_/g, " ")}:
                        </span>{" "}
                        {String(value)}
                      </p>
                    ),
                  )}
                </div>
              )}
          </div>
        </div>

        <div className="app-detail-card mb-6 p-4">
          <h3 className="app-section-kicker">AI assessment</h3>
          <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--app-text-muted)" }}>
            <p>
              <span className="font-semibold" style={{ color: "var(--app-text)" }}>Confidence:</span>{" "}
              <span className="capitalize">
                {activeChat.ai_confidence_label || "unknown"}
              </span>{" "}
              ({((activeChat.ai_confidence_score || 0) * 100).toFixed(0)}%)
            </p>
            <p>
              <span className="font-semibold" style={{ color: "var(--app-text)" }}>Outcome:</span>{" "}
              <span className="capitalize">
                {activeChat.ai_last_outcome || "unknown"}
              </span>
            </p>
            <p>
              <span className="font-semibold" style={{ color: "var(--app-text)" }}>Source:</span>{" "}
              {activeChat.ai_source_title || "No grounded article selected"}
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className="app-chip app-chip-accent">AI</span>
          <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>Copilot</h3>
        </div>

        {copilot.isLoading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--brand-accent-dark)" }}>
              <span className="inline-flex gap-0.5">
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full"
                  style={{ background: "var(--brand-accent)" }}
                  style={{ animationDelay: "0ms" }}
                ></span>
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full"
                  style={{ background: "var(--brand-accent)", animationDelay: "150ms" }}
                ></span>
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full"
                  style={{ background: "var(--brand-accent)", animationDelay: "300ms" }}
                ></span>
              </span>
              <span className="font-medium">Copilot is thinking...</span>
            </div>
            <div className="flex animate-pulse space-x-4">
              <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 w-3/4 rounded" style={{ background: "var(--app-card-muted)" }}></div>
                  <div className="space-y-2">
                    <div className="h-4 rounded" style={{ background: "var(--app-card-muted)" }}></div>
                    <div className="h-4 w-5/6 rounded" style={{ background: "var(--app-card-muted)" }}></div>
                  </div>
                </div>
              </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h4 className="app-section-kicker mb-2">Thread Summary</h4>
                <div className="app-accent-card p-3 text-sm leading-relaxed" style={{ color: "var(--app-text-muted)" }}>
                  {copilot.summary}
                </div>
              </div>

            {copilot.suggested_reply && (
              <div>
                <h4 className="app-section-kicker mb-2">Suggested Reply</h4>
                <div className="app-accent-card mb-3 p-3 text-sm italic" style={{ color: "var(--app-text)" }}>
                  "{copilot.suggested_reply}"
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSetMessagePrompt(copilot.suggested_reply)}
                    className="app-secondary-button square flex-1 justify-center py-2 text-sm"
                  >
                    Insert into composer
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendSuggestedReply(copilot.suggested_reply)}
                    disabled={isUploading}
                    className="app-primary-button flex-1 py-2 text-sm"
                  >
                    Send this reply
                  </button>
                </div>
              </div>
            )}

            <div>
              <h4 className="app-section-kicker mb-2">Relevant Articles</h4>
              {copilot.articles?.length ? (
                <div className="space-y-3">
                  {copilot.articles.map((article) => (
                    <div key={article.id} className="app-detail-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--app-text)" }}>
                            {article.title}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em]" style={{ color: "var(--brand-accent-dark)" }}>
                            Match {(article.match_score * 100).toFixed(0)}%
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onSetMessagePrompt((prev) =>
                              prev
                                ? `${prev}\n\nReference article: ${article.title}\n${article.excerpt}`
                                : `Reference article: ${article.title}\n${article.excerpt}`,
                            )
                          }
                          className="app-secondary-button square px-2 py-1 text-xs"
                        >
                          Use article
                        </button>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--app-text-muted)" }}>
                        {article.excerpt}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="app-empty-state p-3 text-sm">
                  No article suggestions yet for this conversation.
                </div>
              )}
            </div>

            <div>
              <h4 className="app-section-kicker mb-2">Previous History</h4>
              {copilot.prior_conversations?.length ? (
                <div className="space-y-3">
                  {copilot.prior_conversations.map((conversation) => (
                    <div key={conversation.id} className="app-detail-card p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold capitalize" style={{ color: "var(--app-text)" }}>
                          {conversation.status}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getSourceBadgeClasses(
                            conversation.source,
                          )}`}
                        >
                          {getSourceLabel(conversation.source, "support")}
                        </span>
                        <span className="app-chip px-2 py-0.5 text-[10px] capitalize">
                          AI {conversation.ai_last_outcome || "unknown"}
                        </span>
                      </div>
                      {conversation.subject && (
                        <p className="mt-2 text-xs font-semibold" style={{ color: "var(--app-text)" }}>
                          Subject: {conversation.subject}
                        </p>
                      )}
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--app-text-muted)" }}>
                        {conversation.preview}
                      </p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--app-text-soft)" }}>
                        Updated {new Date(conversation.updated_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="app-empty-state p-3 text-sm">
                  No earlier conversations loaded for this customer.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t app-surface-divider p-4">
        <button
          type="button"
          onClick={onCreateTicket}
          disabled={isCreatingTicket || copilot.isLoading}
          className={`flex w-full items-center justify-center gap-2 py-2.5 ${
            isCreatingTicket || copilot.isLoading
              ? "app-secondary-button square cursor-not-allowed opacity-60"
              : "app-secondary-button square"
          }`}
        >
            <svg
            className="h-4 w-4"
            style={{ color: "var(--app-text-muted)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            ></path>
          </svg>
          {isCreatingTicket ? "Creating..." : "Convert to Ticket"}
        </button>
      </div>
    </>
  );
}
