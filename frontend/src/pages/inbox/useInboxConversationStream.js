import { useEffect } from "react";
import { matchesConversationFilters } from "./inboxHelpers";

export default function useInboxConversationStream({
  apiUrl,
  token,
  filters,
  activeChatId,
  setConversations,
  setActiveChat,
}) {
  useEffect(() => {
    if (!token) return undefined;

    let socket = null;
    let reconnectTimer = null;
    let shouldReconnect = true;

    const connect = () => {
      const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
      const wsUrl = `${apiUrl.replace(
        /^http/,
        wsProtocol,
      )}/api/ws/__support_inbox__?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        let incoming = null;
        try {
          incoming = JSON.parse(event.data);
        } catch {
          return;
        }

        if (incoming?.type === "conversation_update" && incoming?.payload?.id) {
          const updatedConversation = incoming.payload;
          setConversations((prev) => {
            const existing = prev.find(
              (chat) => chat.id === updatedConversation.id,
            );
            let next = existing
              ? prev.map((chat) =>
                  chat.id === updatedConversation.id
                    ? { ...chat, ...updatedConversation }
                    : chat,
                )
              : [updatedConversation, ...prev];

            next = next.filter((chat) =>
              chat.id === updatedConversation.id
                ? matchesConversationFilters(chat, filters)
                : true,
            );

            if (
              !existing &&
              !matchesConversationFilters(updatedConversation, filters)
            ) {
              next = prev;
            }

            return [...next].sort(
              (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
            );
          });

          if (updatedConversation.id === activeChatId) {
            setActiveChat((prev) =>
              prev ? { ...prev, ...updatedConversation } : prev,
            );
          }
        }
      };

      socket.onclose = () => {
        if (!shouldReconnect) return;
        reconnectTimer = setTimeout(connect, 1500);
      };

      socket.onerror = () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [activeChatId, apiUrl, filters, setActiveChat, setConversations, token]);
}
