export default function MessageComposer({
  typingNotice,
  isInternal,
  setIsInternal,
  attachment,
  setAttachment,
  messagePrompt,
  onPromptChange,
  isUploading,
  onSendMessage,
  fileInputRef,
  onFileChange,
}) {
  const containerClasses = isInternal
    ? "app-composer-shell app-composer-shell-internal flex flex-col flex-1 overflow-hidden rounded-2xl border transition-all focus-within:border-transparent focus-within:ring-2 focus-within:ring-amber-500"
    : "app-composer-shell flex flex-col flex-1 overflow-hidden rounded-2xl border transition-all focus-within:border-transparent focus-within:ring-2 focus-within:ring-blue-500";

  return (
    <div className="app-page-header p-4">
      {typingNotice && (
        <div
          className="mb-2 text-xs font-medium"
          style={{ color: "var(--app-text-muted)" }}
        >
          {typingNotice}
        </div>
      )}
      <div className={containerClasses}>
        <div className="flex flex-col flex-1">
          {attachment && (
            <div className="app-composer-attachment m-2 mb-0 flex items-center justify-between self-start rounded-xl px-3 py-1.5 text-xs shadow-sm">
              <span className="truncate max-w-[12rem]">📎 {attachment.name}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="ml-2 font-bold transition-colors hover:text-red-500"
                style={{ color: "var(--app-text-soft)" }}
              >
                x
              </button>
            </div>
          )}
          <textarea
            rows="2"
            className="app-composer-textarea w-full resize-none bg-transparent p-3 text-sm outline-none"
            placeholder={isInternal ? "Type an internal note..." : "Type your reply here..."}
            value={messagePrompt}
            onChange={onPromptChange}
            disabled={isUploading}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSendMessage();
              }
            }}
          />
        </div>
        <div className="m-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={onFileChange}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="app-composer-icon-button flex h-9 w-9 items-center justify-center rounded-full"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
              </svg>
            </button>
            <div className="app-composer-toggle flex items-center rounded-lg border p-1">
              <button
                type="button"
                onClick={() => setIsInternal(false)}
                className={`app-composer-toggle-option px-3 py-1 text-xs font-medium rounded-md transition-colors ${!isInternal ? "is-active" : ""}`}
              >
                Reply
              </button>
              <button
                type="button"
                onClick={() => setIsInternal(true)}
                className={`app-composer-toggle-option app-composer-toggle-note px-3 py-1 text-xs font-medium rounded-md transition-colors ${isInternal ? "is-active" : ""}`}
              >
                Note
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSendMessage()}
            disabled={isUploading || (!messagePrompt.trim() && !attachment)}
            className="app-button-base app-button-md rounded-md px-4 py-2 font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-accent)" }}
          >
            {isUploading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
