export default function MergeConversationModal({
  open,
  activeChat,
  conversations,
  onMerge,
  onClose,
}) {
  if (!open || !activeChat) {
    return null;
  }

  const mergeCandidates = conversations.filter(
    (conversation) =>
      conversation.id !== activeChat.id &&
      conversation.customer_id === activeChat.customer_id,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45">
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-2xl"
        style={{
          background: "var(--app-card)",
          border: "1px solid var(--app-border)",
          color: "var(--app-text)",
        }}
      >
        <h2 className="mb-2 text-lg font-bold" style={{ color: "var(--app-text)" }}>
          Merge Conversation
        </h2>
        <p className="mb-4 text-sm" style={{ color: "var(--app-text-muted)" }}>
          All messages from <strong>{activeChat.customer_name}</strong>'s
          current conversation will be moved into the selected conversation.
          The current thread will be marked as resolved.
        </p>
        <div className="mb-4 max-h-64 overflow-y-auto space-y-2">
          {mergeCandidates.length === 0 ? (
            <p className="text-sm italic" style={{ color: "var(--app-text-soft)" }}>
              No other conversations found for this customer. You can only
              merge conversations from the same customer.
            </p>
          ) : (
            mergeCandidates.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onMerge(conversation.id)}
                className="w-full rounded-lg border p-3 text-left text-sm"
                style={{
                  borderColor: "var(--app-border)",
                  background: "var(--app-card-muted)",
                  color: "var(--app-text)",
                }}
              >
                <div className="flex justify-between">
                  <span className="font-semibold">
                    {conversation.preview?.slice(0, 60)}...
                  </span>
                  <span className="text-xs capitalize" style={{ color: "var(--app-text-soft)" }}>
                    {conversation.status}
                  </span>
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--app-text-soft)" }}>
                  {new Date(conversation.updated_at).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ color: "var(--app-text-muted)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
