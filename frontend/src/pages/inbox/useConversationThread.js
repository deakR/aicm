import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { mergeThreadMessages } from "../../utils/messageThread";

export default function useConversationThread({
  apiUrl,
  token,
  activeChat,
  setConversations,
  setActiveChat,
}) {
  const [messages, setMessages] = useState([]);
  const [typingNotice, setTypingNotice] = useState("");
  const [wsState, setWsState] = useState("disconnected");
  const [isThreadLoading, setIsThreadLoading] = useState(false);

  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeConversationIdRef = useRef("");
  const fetchRequestSeqRef = useRef(0);

  const sendRealtimeEvent = useCallback((payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  useLayoutEffect(() => {
    const activeConversationID = activeChat?.id || "";
    activeConversationIdRef.current = activeConversationID;
    fetchRequestSeqRef.current += 1;
    setMessages([]);
    setTypingNotice("");
    setIsThreadLoading(Boolean(activeConversationID));
    setWsState(activeConversationID ? "connecting" : "disconnected");
  }, [activeChat?.id]);

  useEffect(() => {
    const activeConversationID = activeChat?.id;
    const activeCustomerID = activeChat?.customer_id;
    const activeCustomerName = activeChat?.customer_name || "Customer";
    if (!activeConversationID) {
      setIsThreadLoading(false);
      return;
    }

    let socket = null;
    let reconnectTimer = null;
    let shouldReconnect = true;

    const fetchMessages = async () => {
      const requestSeq = ++fetchRequestSeqRef.current;
      try {
        const res = await fetch(
          `${apiUrl}/api/protected/conversations/${activeConversationID}/messages`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const fetchedMessages = await res.json();
          if (
            activeConversationIdRef.current !== activeConversationID ||
            requestSeq !== fetchRequestSeqRef.current
          ) {
            return;
          }
          setMessages((prev) => mergeThreadMessages(prev, fetchedMessages));
          sendRealtimeEvent({ type: "read_receipt" });
        }
      } catch (err) {
        console.error("Failed to fetch messages", err);
      } finally {
        if (
          activeConversationIdRef.current === activeConversationID &&
          requestSeq === fetchRequestSeqRef.current
        ) {
          setIsThreadLoading(false);
        }
      }
    };

    const connect = () => {
      setWsState("connecting");
      const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
      const wsUrl = `${apiUrl.replace(/^http/, wsProtocol)}/api/ws/${activeConversationID}?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (activeConversationIdRef.current !== activeConversationID) {
          socket.close();
          return;
        }
        setWsState("connected");
        fetchMessages();
        sendRealtimeEvent({ type: "read_receipt" });
      };

      socket.onmessage = (event) => {
        let incoming = null;
        try {
          incoming = JSON.parse(event.data);
        } catch {
          return;
        }

        if (incoming?.type === "conversation_update" && incoming?.payload?.id) {
          setConversations((prev) =>
            prev.map((chat) =>
              chat.id === incoming.payload.id
                ? { ...chat, ...incoming.payload }
                : chat,
            ),
          );
          if (
            incoming.payload.id === activeConversationID &&
            activeConversationIdRef.current === activeConversationID
          ) {
            setActiveChat((prev) =>
              prev ? { ...prev, ...incoming.payload } : prev,
            );
          }
          return;
        }

        if (
          incoming?.type === "read_receipt" &&
          incoming?.payload?.conversation_id === activeConversationID
        ) {
          setConversations((prev) =>
            prev.map((chat) =>
              chat.id === activeConversationID
                ? {
                    ...chat,
                    customer_last_read_at:
                      incoming.payload.customer_last_read_at,
                    agent_last_read_at: incoming.payload.agent_last_read_at,
                  }
                : chat,
            ),
          );
          setActiveChat((prev) =>
            prev
              ? {
                  ...prev,
                  customer_last_read_at: incoming.payload.customer_last_read_at,
                  agent_last_read_at: incoming.payload.agent_last_read_at,
                }
              : prev,
          );
          return;
        }

        if (incoming?.type === "typing") {
          const payload = incoming.payload || {};
          if (payload.role === "customer") {
            setTypingNotice(
              payload.is_typing
                ? `${payload.name || activeCustomerName} is typing...`
                : "",
            );
          }
          return;
        }

        const newMessage = incoming;
        setTypingNotice("");
        if (newMessage?.conversation_id === activeConversationID) {
          setMessages((prev) => {
            if (prev.find((message) => message.id === newMessage.id)) {
              return prev;
            }
            return mergeThreadMessages(prev, [newMessage]);
          });

          setConversations((prev) =>
            prev.map((chat) =>
              chat.id === newMessage.conversation_id
                ? {
                    ...chat,
                    preview:
                      newMessage.content?.trim() ||
                      newMessage.attachment_name ||
                      "Attachment sent",
                    updated_at:
                      newMessage.created_at || new Date().toISOString(),
                  }
                : chat,
            ),
          );
          if (newMessage.sender_id === activeCustomerID) {
            sendRealtimeEvent({ type: "read_receipt" });
          }
        }
      };

      socket.onclose = () => {
        if (
          !shouldReconnect ||
          activeConversationIdRef.current !== activeConversationID
        ) {
          setWsState("disconnected");
          return;
        }
        setWsState("reconnecting");
        reconnectTimer = setTimeout(connect, 1500);
      };

      socket.onerror = () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    };

    fetchMessages();
    connect();
    const refreshTimer = setInterval(fetchMessages, 8000);
    const initialTypingTimeoutRef = typingTimeoutRef.current;

    return () => {
      shouldReconnect = false;
      clearInterval(refreshTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (initialTypingTimeoutRef) clearTimeout(initialTypingTimeoutRef);
      if (activeConversationIdRef.current === activeConversationID) {
        activeConversationIdRef.current = "";
      }
      socketRef.current = null;
      if (socket) socket.close();
    };
  }, [
    activeChat?.customer_id,
    activeChat?.customer_name,
    activeChat?.id,
    apiUrl,
    sendRealtimeEvent,
    setActiveChat,
    setConversations,
    token,
  ]);

  useEffect(() => {
    setTypingNotice("");
  }, [activeChat?.id]);

  return {
    messages,
    setMessages,
    typingNotice,
    wsState,
    isThreadLoading,
    sendRealtimeEvent,
    typingTimeoutRef,
  };
}
