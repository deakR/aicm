import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearStoredToken, getStoredToken } from "../auth";
import ThemeToggle from "../components/ThemeToggle";
import { buildBrandPalette } from "../branding";
import { useThemePreference } from "../theme";
import useBranding from "../context/useBranding";
import {
  getSenderLabel,
  getStatusClasses,
} from "../utils/conversationDisplay";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8900";

function getConversationDisplayTitle(conversation) {
  const subject = (conversation?.subject || "").trim();
  if (subject && subject.toLowerCase() !== "support conversation") {
    return subject;
  }

  const preview = (conversation?.preview || "").trim();
  if (preview) {
    return preview;
  }

  return "Support conversation";
}

export default function CustomerDashboard() {
  const [overview, setOverview] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [typingNotice, setTypingNotice] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [wsState, setWsState] = useState("connecting");
  const [readState, setReadState] = useState({
    customer_last_read_at: "",
    agent_last_read_at: "",
  });
  const navigate = useNavigate();
  const token = getStoredToken();
  const { branding } = useBranding();
  const { resolvedTheme } = useThemePreference();
  const palette = buildBrandPalette(branding.accent_color);
  const isDark = resolvedTheme === "dark";
  const fileInputRef = useRef(null);
  const threadViewportRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeConversationIdRef = useRef("");
  const threadRequestSeqRef = useRef(0);
  const lastRenderedMessageIdRef = useRef("");
  const isThreadPinnedToBottomRef = useRef(true);

  const sendRealtimeEvent = useCallback((payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const updateConversationPreview = useCallback((message) => {
    setOverview((prev) => {
      if (!prev) return prev;
      const conversations = [...(prev.conversations || [])];
      const index = conversations.findIndex(
        (item) => item.id === message.conversation_id,
      );
      if (index === -1) return prev;

      const next = {
        ...conversations[index],
        preview:
          message.content?.trim() ||
          message.attachment_name ||
          "Attachment sent",
        updated_at: message.created_at,
        last_sender_name: message.sender_name,
        last_sender_role: message.sender_role,
      };

      conversations.splice(index, 1);
      conversations.unshift(next);
      return { ...prev, conversations };
    });
  }, []);

  const loadOverview = useCallback(async (preferredConversationId = null) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/protected/customer/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOverview(data);
        setActiveConversation((prev) => {
          if (preferredConversationId) {
            const preferred = data.conversations.find(
              (item) => item.id === preferredConversationId,
            );
            if (preferred) {
              return preferred;
            }
            if (prev?.id === preferredConversationId) {
              return prev;
            }
            return data.conversations[0] || null;
          }

          return (
            data.conversations.find((item) => item.id === prev?.id) ||
            data.conversations[0] ||
            null
          );
        });
        return data;
      }

      if (res.status === 401) {
        clearStoredToken();
        navigate("/login", { replace: true });
      } else {
        setError("Failed to load your support dashboard.");
      }
    } catch (err) {
      console.error("Failed to fetch customer overview", err);
      setError("Failed to load your support dashboard.");
    } finally {
      setIsLoading(false);
    }

    return null;
  }, [navigate, token]);

  useEffect(() => {
    if (token) {
      loadOverview();
    }
  }, [loadOverview, token]);

  useEffect(() => {
    const viewport = threadViewportRef.current;
    if (!viewport) {
      return;
    }

    const latestMessageId = messages.at(-1)?.id || "";
    if (!latestMessageId) {
      return;
    }

    if (latestMessageId === lastRenderedMessageIdRef.current) {
      return;
    }

    if (
      !lastRenderedMessageIdRef.current ||
      isThreadPinnedToBottomRef.current
    ) {
      const behavior = lastRenderedMessageIdRef.current ? "smooth" : "auto";
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    }

    lastRenderedMessageIdRef.current = latestMessageId;
  }, [messages]);

  useEffect(() => {
    const activeConversationID = activeConversation?.id || "";
    if (!activeConversationID) {
      activeConversationIdRef.current = "";
      setMessages([]);
      setTypingNotice("");
      setReadState({ customer_last_read_at: "", agent_last_read_at: "" });
      lastRenderedMessageIdRef.current = "";
      isThreadPinnedToBottomRef.current = true;
      return undefined;
    }

    activeConversationIdRef.current = activeConversationID;
    threadRequestSeqRef.current += 1;
    lastRenderedMessageIdRef.current = "";
    isThreadPinnedToBottomRef.current = true;
    setMessages([]);
    setTypingNotice("");
    setReadState({ customer_last_read_at: "", agent_last_read_at: "" });

    let socket = null;
    let reconnectTimer = null;
    const conversationId = activeConversationID;
    const activeCustomerId = overview?.profile?.id;

    const fetchMessages = async () => {
      const requestSeq = ++threadRequestSeqRef.current;
      setIsThreadLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/api/protected/conversations/${conversationId}/messages`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const fetchedMessages = await res.json();
          if (
            activeConversationIdRef.current !== conversationId ||
            requestSeq !== threadRequestSeqRef.current
          ) {
            return;
          }
          setMessages(fetchedMessages);
          sendRealtimeEvent({ type: "read_receipt" });
        }
      } catch (err) {
        console.error("Failed to load conversation messages", err);
      } finally {
        if (
          activeConversationIdRef.current === conversationId &&
          requestSeq === threadRequestSeqRef.current
        ) {
          setIsThreadLoading(false);
        }
      }
    };

    const connect = () => {
      const protocol = API_URL.startsWith("https") ? "wss" : "ws";
      const wsUrl = `${API_URL.replace(
        /^http/,
        protocol,
      )}/api/ws/${conversationId}?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (activeConversationIdRef.current !== conversationId) {
          socket.close();
          return;
        }
        setWsState("connected");
        fetchMessages();
        sendRealtimeEvent({ type: "read_receipt" });
      };

      socket.onmessage = (event) => {
        if (activeConversationIdRef.current !== conversationId) {
          return;
        }

        let incoming;
        try {
          incoming = JSON.parse(event.data);
        } catch {
          return;
        }

        if (incoming?.type === "typing") {
          const payload = incoming.payload || {};
          if (payload.role !== "customer") {
            setTypingNotice(
              payload.is_typing ? `${payload.name || "Support"} is typing...` : "",
            );
          }
          return;
        }

        if (incoming?.type === "read_receipt") {
          setReadState({
            customer_last_read_at:
              incoming.payload?.customer_last_read_at || "",
            agent_last_read_at: incoming.payload?.agent_last_read_at || "",
          });
          return;
        }

        if (
          incoming?.type === "conversation_update" &&
          incoming?.payload?.id === conversationId
        ) {
          const updatedConversation = incoming.payload;
          setActiveConversation((prev) =>
            prev?.id === updatedConversation.id ? updatedConversation : prev,
          );
          setOverview((prev) => {
            if (!prev) return prev;
            const conversations = (prev.conversations || []).map((item) =>
              item.id === updatedConversation.id
                ? {
                    ...item,
                    status: updatedConversation.status,
                    updated_at: updatedConversation.updated_at,
                  }
                : item,
            );
            return { ...prev, conversations };
          });
          return;
        }

        setTypingNotice("");
        if (incoming?.conversation_id && incoming.conversation_id !== conversationId) {
          return;
        }
        setMessages((prev) => {
          if (prev.find((item) => item.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
        updateConversationPreview(incoming);
        if (incoming.sender_id !== activeCustomerId) {
          sendRealtimeEvent({ type: "read_receipt" });
        }
      };

      socket.onclose = () => {
        if (activeConversationIdRef.current !== conversationId) {
          return;
        }
        setWsState("disconnected");
        reconnectTimer = setTimeout(() => {
          if (activeConversationIdRef.current !== conversationId) {
            return;
          }
          setWsState("connecting");
          connect();
        }, 3000);
      };

      socket.onerror = () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    };

    connect();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (activeConversationIdRef.current === conversationId) {
        activeConversationIdRef.current = "";
      }
      socketRef.current = null;
      if (socket) socket.close();
    };
  }, [
    activeConversation?.id,
    overview?.profile?.id,
    sendRealtimeEvent,
    token,
    updateConversationPreview,
  ]);

  const handleInputChange = (event) => {
    const value = event.target.value;
    setReply(value);
    sendRealtimeEvent({ type: "typing", is_typing: value.trim().length > 0 });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendRealtimeEvent({ type: "typing", is_typing: false });
    }, 1200);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Attachments must be 5MB or smaller.");
      event.target.value = "";
      return;
    }
    setAttachment(file);
    setError("");
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if ((!reply.trim() && !attachment) || !activeConversation || isUploading) {
      return;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendRealtimeEvent({ type: "typing", is_typing: false });
    setIsSending(true);
    setIsUploading(true);

    let uploadedFile = null;
    if (attachment) {
      const formData = new FormData();
      formData.append("file", attachment);
      try {
        const uploadRes = await fetch(`${API_URL}/api/protected/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("upload failed");
        uploadedFile = await uploadRes.json();
      } catch (err) {
        console.error("Failed to upload attachment", err);
        setError("Attachment upload failed. Please try again.");
        setIsSending(false);
        setIsUploading(false);
        return;
      }
    }

    const payload = { content: reply.trim() };
    if (uploadedFile) {
      payload.attachment_url = uploadedFile.url;
      payload.attachment_name = uploadedFile.name;
      payload.attachment_type = uploadedFile.type;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/protected/conversations/${activeConversation.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        const newMessage = await res.json();
        if (newMessage?.conversation_id === activeConversationIdRef.current) {
          setMessages((prev) => {
            if (prev.find((item) => item.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
        updateConversationPreview(newMessage);
        setReply("");
        setAttachment(null);
        setError("");
      } else {
        setError("Failed to send your message. Please try again.");
      }
    } catch (err) {
      console.error("Failed to send customer message", err);
      setError("Failed to send your message. Please try again.");
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const lastCustomerMessage = [...messages]
    .filter(
      (message) =>
        message.sender_id === overview?.profile?.id ||
        message.sender_role === "customer",
    )
    .at(-1);

  const handleLogout = () => {
    clearStoredToken();
    navigate("/login", { replace: true });
  };

  const handleStartSupportConversation = useCallback(async () => {
    setIsStartingConversation(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/protected/customer/chat-session?force_new=true`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        clearStoredToken();
        navigate("/login", { replace: true });
        return;
      }

      if (!res.ok) {
        setError("Failed to start a support conversation.");
        return;
      }

      const data = await res.json();
      const newConversationId = data?.conversation_id;
      if (!newConversationId) {
        setError("Failed to start a support conversation.");
        return;
      }

      setActiveConversation({
        id: newConversationId,
        status: "open",
        subject: "Support conversation",
        preview: "No messages yet",
        updated_at: new Date().toISOString(),
      });

      await loadOverview(newConversationId);
    } catch (err) {
      console.error("Failed to start customer support conversation", err);
      setError("Failed to start a support conversation.");
    } finally {
      setIsStartingConversation(false);
    }
  }, [loadOverview, navigate, token]);

  const hasConversations = (overview?.conversations?.length || 0) > 0;

  return (
    <div className="app-shell flex h-[100dvh] flex-col overflow-hidden">
      <div
        className="relative shrink-0 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--brand-accent) 20%, transparent)",
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${palette.accent} 14%, var(--app-surface)), color-mix(in srgb, ${palette.accentDark} 18%, var(--app-bg)))`,
          color: "#ffffff",
        }}
      >
        <div className="absolute right-6 top-5">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
              {branding.brand_name}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Support</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/help"
              className="rounded-full border px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              Help Center
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full px-4 py-2 text-sm font-semibold transition"
              style={{
                background: isDark ? "var(--app-card)" : "rgba(255,255,255,0.94)",
                color: isDark ? "#ffffff" : "var(--app-text)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark
                  ? "var(--app-card-muted)"
                  : "rgba(255,255,255,1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark
                  ? "var(--app-card)"
                  : "rgba(255,255,255,0.94)";
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-6 py-4">
        {error && (
          <div className="mb-3 shrink-0 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="app-panel-card flex-1 rounded-3xl p-12 text-center">
            Loading your support space...
          </div>
        ) : overview ? (
          hasConversations ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[320px_1fr]">
              <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
                <section className="app-panel-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]">
                  <div
                    className="shrink-0 border-b px-5 py-4"
                    style={{ borderColor: "var(--app-border)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-base font-bold" style={{ color: "var(--app-text)" }}>
                        Conversations
                      </h2>
                      <button
                        type="button"
                        onClick={handleStartSupportConversation}
                        disabled={isStartingConversation}
                        className="app-primary-button rounded-xl px-3 py-1.5 text-xs"
                      >
                        {isStartingConversation ? "Opening..." : "+ New"}
                      </button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {overview.conversations.map((conversation) => {
                      const title = getConversationDisplayTitle(conversation);
                      const isActive = activeConversation?.id === conversation.id;

                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => setActiveConversation(conversation)}
                          className={`w-full border-b px-5 py-4 text-left transition ${
                            isActive ? "conversation-item-active" : ""
                          }`}
                          style={{ borderColor: "var(--app-border)" }}
                        >
                          <p
                            className="truncate text-sm font-semibold"
                            style={{ color: "var(--app-text)" }}
                          >
                            {title}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em]">
                            <span
                              className={`app-status-pill rounded-full px-2 py-0.5 font-semibold ${getStatusClasses(
                                conversation.status,
                              )}`}
                            >
                              {conversation.status}
                            </span>
                            <span style={{ color: "var(--app-text-soft)" }}>
                              {new Date(conversation.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="app-panel-card shrink-0 rounded-[1.75rem] px-5 py-4">
                  <h2
                    className="text-sm font-bold uppercase tracking-[0.14em]"
                    style={{ color: "var(--app-text-soft)" }}
                  >
                    Account
                  </h2>
                  <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--app-text-muted)" }}>
                    <p>
                      <span className="font-semibold" style={{ color: "var(--app-text)" }}>
                        {overview.profile.name}
                      </span>
                    </p>
                    <p className="truncate">{overview.profile.email}</p>
                    <p className="text-[11px]" style={{ color: "var(--app-text-soft)" }}>
                      Member since {new Date(overview.profile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </section>
              </div>

              <section className="app-panel-card flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[1.75rem]">
                <div
                  className="shrink-0 border-b px-6 py-4"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        className="truncate text-base font-bold"
                        style={{ color: "var(--app-text)" }}
                      >
                        {activeConversation
                          ? getConversationDisplayTitle(activeConversation)
                          : "Select a conversation"}
                      </h2>
                      {activeConversation && (
                        <p className="mt-0.5 text-xs" style={{ color: "var(--app-text-muted)" }}>
                          Updated {new Date(activeConversation.updated_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <span
                      className={`app-status-pill shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                        wsState === "connected"
                          ? "app-status-pill-open"
                          : wsState === "connecting"
                            ? "app-status-pill-pending"
                            : "app-status-pill-default"
                      }`}
                    >
                      {wsState === "connected"
                        ? "Live"
                        : wsState === "connecting"
                          ? "Connecting"
                          : "Offline"}
                    </span>
                  </div>
                </div>

                <div
                  ref={threadViewportRef}
                  onScroll={() => {
                    const viewport = threadViewportRef.current;
                    if (!viewport) {
                      return;
                    }
                    const distanceFromBottom =
                      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
                    isThreadPinnedToBottomRef.current = distanceFromBottom < 100;
                  }}
                  className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
                  style={{ background: "var(--app-card-muted)", overflowAnchor: "none" }}
                >
                  {isThreadLoading ? (
                    <div className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                      Loading...
                    </div>
                  ) : messages.length === 0 && activeConversation ? (
                    <div
                      className="rounded-2xl border border-dashed p-6 text-center text-sm"
                      style={{ borderColor: "var(--app-border)", color: "var(--app-text-muted)" }}
                    >
                      No messages yet. Send your first message below.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => {
                        const isCustomer =
                          message.sender_id === overview.profile.id ||
                          message.sender_role === "customer";
                        const isAI = message.is_ai_generated;

                        return (
                          <div
                            key={message.id}
                            className={`flex flex-col ${isCustomer ? "items-end" : "items-start"}`}
                          >
                            <span
                              className={`mb-1 text-xs font-medium ${
                                isCustomer
                                  ? ""
                                  : isAI
                                    ? "app-message-sender-ai"
                                    : "app-message-sender-support"
                              }`}
                              style={isCustomer ? { color: "var(--app-text-soft)" } : undefined}
                            >
                              {getSenderLabel(message, overview.profile.id)}
                            </span>
                            <div
                              className={`max-w-[78%] break-words rounded-2xl px-4 py-3 text-sm ${
                                isCustomer
                                  ? "rounded-tr-none"
                                  : isAI
                                    ? "rounded-tl-none app-message-bubble-ai"
                                    : "rounded-tl-none app-message-bubble-support"
                              }`}
                              style={
                                isCustomer
                                  ? {
                                      backgroundColor: palette.accent,
                                      color: "#ffffff",
                                      overflowWrap: "break-word",
                                      wordBreak: "break-word",
                                    }
                                  : { overflowWrap: "break-word", wordBreak: "break-word" }
                              }
                            >
                              {message.content && (
                                <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                              )}
                              {message.attachment_url && (
                                <div className="mt-3 text-left">
                                  {message.attachment_type?.startsWith("image/") ? (
                                    <a
                                      href={`${API_URL}${message.attachment_url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <img
                                        src={`${API_URL}${message.attachment_url}`}
                                        alt={message.attachment_name}
                                        className="max-w-xs rounded-xl"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={`${API_URL}${message.attachment_url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex rounded-lg px-3 py-2 text-xs font-semibold"
                                      style={{
                                        background: "var(--app-card-muted)",
                                        color: "var(--app-text)",
                                      }}
                                    >
                                      {message.attachment_name || "Download file"}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                            <div
                              className="mt-1 flex items-center gap-2 text-[11px]"
                              style={{ color: "var(--app-text-soft)" }}
                            >
                              <span>{new Date(message.created_at).toLocaleString()}</span>
                              {message.id === lastCustomerMessage?.id &&
                                (message.sender_id === overview.profile.id ||
                                  message.sender_role === "customer") &&
                                readState.agent_last_read_at && (
                                  <span className="app-read-receipt font-medium">Seen by support</span>
                                )}
                            </div>
                          </div>
                        );
                      })}
                      {typingNotice && (
                        <div className="text-xs font-medium" style={{ color: "var(--app-text-muted)" }}>
                          {typingNotice}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <form
                  onSubmit={handleSend}
                  className="shrink-0 border-t px-6 py-4"
                  style={{ borderColor: "var(--app-border)", background: "var(--app-card)" }}
                >
                  {attachment && (
                    <div
                      className="mb-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                      style={{ background: "var(--app-card-muted)", color: "var(--app-text-muted)" }}
                    >
                      <span className="truncate">Attached: {attachment.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachment(null)}
                        className="ml-3 font-semibold hover:text-rose-500"
                        style={{ color: "var(--app-text-soft)" }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="flex min-w-0 items-center gap-3">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!activeConversation || isUploading}
                      className="app-secondary-button shrink-0"
                    >
                      Attach
                    </button>
                    <input
                      type="text"
                      value={reply}
                      onChange={handleInputChange}
                      placeholder={activeConversation ? "Type your message..." : "Select a conversation first"}
                      className="app-field-control min-w-0 flex-1 rounded-full"
                      disabled={!activeConversation || isUploading}
                    />
                    <button
                      type="submit"
                      disabled={!activeConversation || (!reply.trim() && !attachment) || isSending}
                      className="app-primary-button shrink-0"
                    >
                      {isSending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          ) : (
            <section className="app-panel-card flex-1 rounded-[1.75rem] p-8">
              <p className="app-section-kicker">No conversations yet</p>
              <h2 className="mt-4 text-2xl font-bold" style={{ color: "var(--app-text)" }}>
                Start your first support conversation.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7" style={{ color: "var(--app-text-muted)" }}>
                Ask a question here to create a support thread linked to your account.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleStartSupportConversation}
                  disabled={isStartingConversation}
                  className="app-primary-button"
                >
                  {isStartingConversation ? "Opening..." : "Contact support"}
                </button>
                <Link to="/help" className="app-secondary-button">
                  Browse help articles
                </Link>
              </div>
            </section>
          )
        ) : null}
      </div>
    </div>
  );
}
