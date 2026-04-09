function getMessageTimeValue(message) {
  const createdAt = Date.parse(message?.created_at || "");
  return Number.isNaN(createdAt) ? 0 : createdAt;
}

export function mergeThreadMessages(currentMessages = [], incomingMessages = []) {
  const byId = new Map();

  [...currentMessages, ...incomingMessages]
    .filter(Boolean)
    .forEach((message) => {
      const existing = byId.get(message.id);
      byId.set(message.id, existing ? { ...existing, ...message } : message);
    });

  return Array.from(byId.values()).sort(
    (left, right) => getMessageTimeValue(left) - getMessageTimeValue(right),
  );
}
