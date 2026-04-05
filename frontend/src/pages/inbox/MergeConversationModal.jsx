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
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-bold text-gray-900">
          Merge Conversation
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          All messages from <strong>{activeChat.customer_name}</strong>'s
          current conversation will be moved into the selected conversation.
          The current thread will be marked as resolved.
        </p>
        <div className="mb-4 max-h-64 overflow-y-auto space-y-2">
          {mergeCandidates.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              No other conversations found for this customer. You can only
              merge conversations from the same customer.
            </p>
          ) : (
            mergeCandidates.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onMerge(conversation.id)}
                className="w-full rounded-lg border border-gray-200 p-3 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">
                    {conversation.preview?.slice(0, 60)}...
                  </span>
                  <span className="text-xs text-gray-400 capitalize">
                    {conversation.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-400">
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
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
