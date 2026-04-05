export default function MessageBubble({
  message,
  activeCustomerId,
  apiUrl,
  lastOutboundMessageId,
  customerLastReadAt,
}) {
  const isAI = message.is_ai_generated;
  const isCustomer = message.sender_id === activeCustomerId;
  const isAgent = !isCustomer && !isAI;

  const wasSeenByCustomer =
    !message.is_internal &&
    !isCustomer &&
    lastOutboundMessageId === message.id &&
    customerLastReadAt &&
    new Date(customerLastReadAt) >= new Date(message.created_at);

  return (
    <div
      className={`flex flex-col ${isCustomer || isAI ? "items-start" : "items-end"}`}
    >
      <span
        className={`mb-1 ml-1 mr-1 inline-flex items-center gap-2 text-xs ${isAI ? "app-message-sender-ai" : isAgent ? "app-message-sender-support" : "text-gray-500"}`}
      >
        {(isAI || isAgent) && (
          <span
            className={`inline-block h-2 w-2 rounded-full ${isAI ? "app-message-dot-ai" : isAgent ? "app-message-dot-support" : "bg-gray-400"}`}
          ></span>
        )}
        {message.sender_name}{" "}
        {message.is_internal && (
          <span className="ml-1 font-bold text-amber-600">(Internal Note)</span>
        )}
      </span>
      <div
        className={`max-w-2xl break-words rounded-2xl p-3 text-sm shadow-sm ${
          message.is_internal
            ? "app-message-bubble-internal"
            : isCustomer
              ? "rounded-tl-none app-message-bubble-customer"
              : isAI
                ? "rounded-tl-none app-message-bubble-ai"
                : isAgent
                  ? "rounded-tr-none app-message-bubble-agent"
                  : "rounded-tl-none app-message-bubble-customer"
        }`}
      >
        {message.content}
        {message.attachment_url && (
          <div className="mt-3 text-left">
            {message.attachment_type?.startsWith("image/") ? (
              <a
                href={`${apiUrl}${message.attachment_url}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={`${apiUrl}${message.attachment_url}`}
                  alt={message.attachment_name}
                  className="max-w-sm rounded-lg shadow-sm"
                />
              </a>
            ) : (
              <a
                href={`${apiUrl}${message.attachment_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs font-semibold text-current hover:bg-black/10"
              >
                📎 {message.attachment_name}
              </a>
            )}
          </div>
        )}
      </div>
      <span className="mt-1 ml-1 mr-1 text-[11px] text-gray-400">
        {new Date(message.created_at).toLocaleString()}
      </span>
      {wasSeenByCustomer && (
        <span className="app-read-receipt mt-1 ml-1 mr-1 text-[11px] font-medium">
          Seen by customer
        </span>
      )}
    </div>
  );
}
