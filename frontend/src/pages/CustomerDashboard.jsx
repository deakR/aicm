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
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/protected/customer/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOverview(data);
        setActiveConversation((prev) =>
          data.conversations.find((item) => item.id === prev?.id) ||
          data.conversations[0] ||
          null,
        );
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      setTypingNotice("");
      setReadState({ customer_last_read_at: "", agent_last_read_at: "" });
      return undefined;
    }

    let socket = null;
    let reconnectTimer = null;
    const conversationId = activeConversation.id;
    const activeCustomerId = overview?.profile?.id;

    const fetchMessages = async () => {
      setIsThreadLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/api/protected/conversations/${conversationId}/messages`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          setMessages(await res.json());
          sendRealtimeEvent({ type: "read_receipt" });
        }
      } catch (err) {
        console.error("Failed to load conversation messages", err);
      } finally {
        setIsThreadLoading(false);
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
        setWsState("connected");
        fetchMessages();
        sendRealtimeEvent({ type: "read_receipt" });
      };

      socket.onmessage = (event) => {
        const incoming = JSON.parse(event.data);

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
        setWsState("disconnected");
        reconnectTimer = setTimeout(() => {
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
      socketRef.current = null;
      if (socket) socket.close();
    };
  }, [
    activeConversation,
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
        setMessages((prev) => {
          if (prev.find((item) => item.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
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
      const res = await fetch(`${API_URL}/api/protected/customer/chat-session`, {
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
      const updatedOverview = await loadOverview();
      const nextConversation =
        updatedOverview?.conversations?.find(
          (item) => item.id === data.conversation_id,
        ) || null;
      setActiveConversation(nextConversation);
    } catch (err) {
      console.error("Failed to start customer support conversation", err);
      setError("Failed to start a support conversation.");
    } finally {
      setIsStartingConversation(false);
    }
  }, [loadOverview, navigate, token]);

  const hasConversations = (overview?.conversations?.length || 0) > 0;

  return (
    <div className="app-shell min-h-screen">
      <div
        className="relative border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--brand-accent) 20%, transparent)",
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${palette.accent} 14%, var(--app-surface)), color-mix(in srgb, ${palette.accentDark} 18%, var(--app-bg)))`,
          color: "#ffffff",
        }}
      >
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-4 px-6 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
              {branding.brand_name}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Support</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/help"
              className="rounded-full border px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              Help Center
            </Link>
            <Link
              to="/"
              className="rounded-full border px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              Public site
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full px-4 py-2 text-sm font-semibold transition"
              style={{
                background: isDark ? "var(--app-card)" : "rgba(255,255,255,0.94)",
                color: isDark ? "#ffffff" : "var(--app-text)",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = isDark
                  ? "var(--app-card-muted)"
                  : "rgba(255,255,255,1)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = isDark
                  ? "var(--app-card)"
                  : "rgba(255,255,255,0.94)";
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="app-panel-card rounded-3xl p-12 text-center">
            Loading your support space...
          </div>
        ) : overview ? (
          <div className="space-y-6">
            {hasConversations ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
                <section className="app-panel-card flex min-h-[620px] flex-col rounded-[2rem] overflow-hidden">
                  <div
                    className="border-b px-5 py-4"
                    style={{ borderColor: "var(--app-border)" }}
                  >
                    <h2 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                      Your conversations
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: "var(--app-text-muted)" }}>
                      Continue any thread tied to your account.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
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
                          style={{
                            borderColor: "var(--app-border)",
                          }}
                        >
                          <p
                            className="truncate text-sm font-semibold"
                            style={{ color: "var(--app-text)" }}
                          >
                            {title}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em]">
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

                <section className="app-panel-card flex min-h-[620px] flex-col rounded-[2rem] overflow-hidden">
                  <div
                    className="border-b px-5 py-4"
                    style={{ borderColor: "var(--app-border)" }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                          {activeConversation
                            ? getConversationDisplayTitle(activeConversation)
                            : "Selected conversation"}
                        </h2>
                        <p className="mt-1 text-sm" style={{ color: "var(--app-text-muted)" }}>
                          {activeConversation
                            ? `Updated ${new Date(activeConversation.updated_at).toLocaleString()}`
                            : "Choose a conversation to review the thread."}
                        </p>
                      </div>
                      <span
                        className={`app-status-pill rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
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
                    className="flex-1 overflow-y-auto px-5 py-5"
                    style={{ background: "var(--app-card-muted)" }}
                  >
                    {isThreadLoading ? (
                      <div className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                        Loading conversation...
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
                              className={`flex flex-col ${
                                isCustomer ? "items-end" : "items-start"
                              }`}
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
                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                                  isCustomer
                                    ? "rounded-tr-none"
                                    : isAI
                                      ? "rounded-tl-none app-message-bubble-ai"
                                      : "rounded-tl-none app-message-bubble-support"
                                }`}
                                style={
                                  isCustomer
                                    ? { backgroundColor: palette.accent, color: "#ffffff" }
                                    : undefined
                                }
                              >
                                {message.content && (
                                  <p className="whitespace-pre-wrap">
                                    {message.content}
                                  </p>
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
                                        className="inline-flex rounded-lg px-3 py-2 text-xs font-semibold transition"
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
                                <span>
                                  {new Date(message.created_at).toLocaleString()}
                                </span>
                                {message.id === lastCustomerMessage?.id &&
                                  (message.sender_id === overview.profile.id ||
                                    message.sender_role === "customer") &&
                                  readState.agent_last_read_at && (
                                    <span className="app-read-receipt font-medium">
                                      Seen by support
                                    </span>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                        {typingNotice && (
                          <div
                            className="text-xs font-medium"
                            style={{ color: "var(--app-text-muted)" }}
                          >
                            {typingNotice}
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={handleSend}
                    className="border-t px-5 py-4"
                    style={{
                      borderColor: "var(--app-border)",
                      background: "var(--app-card)",
                    }}
                  >
                    {attachment && (
                      <div
                        className="mb-3 flex items-center justify-between rounded-2xl px-3 py-2 text-xs"
                        style={{
                          background: "var(--app-card-muted)",
                          color: "var(--app-text-muted)",
                        }}
                      >
                        <span className="truncate">Attached: {attachment.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachment(null)}
                          className="font-semibold hover:text-rose-600"
                          style={{ color: "var(--app-text-soft)" }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!activeConversation || isUploading}
                        className="app-secondary-button"
                      >
                        Attach
                      </button>
                      <input
                        type="text"
                        value={reply}
                        onChange={handleInputChange}
                        placeholder="Type your reply to support..."
                        className="app-field-control flex-1 rounded-full"
                        disabled={!activeConversation || isUploading}
                      />
                      <button
                        type="submit"
                        disabled={
                          !activeConversation ||
                          (!reply.trim() && !attachment) ||
                          isSending
                        }
                        className="app-primary-button"
                      >
                        {isSending ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            ) : (
              <section className="app-panel-card rounded-[2rem] p-6">
                <p className="app-section-kicker">No conversations yet</p>
                <h2 className="mt-4 text-2xl font-bold" style={{ color: "var(--app-text)" }}>
                  Start your first support conversation.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "var(--app-text-muted)" }}>
                  Ask a question here to create a persistent support thread linked to your account.
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
            )}

            <div className="grid gap-6 xl:grid-cols-3">
              <section className="app-panel-card rounded-[2rem] p-6">
                <h2 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                  Account
                </h2>
                <div className="mt-4 space-y-3 text-sm" style={{ color: "var(--app-text-muted)" }}>
                  <p>
                    <span className="font-semibold" style={{ color: "var(--app-text)" }}>Name:</span>{" "}
                    {overview.profile.name}
                  </p>
                  <p>
                    <span className="font-semibold" style={{ color: "var(--app-text)" }}>Email:</span>{" "}
                    {overview.profile.email}
                  </p>
                  <p>
                    <span className="font-semibold" style={{ color: "var(--app-text)" }}>Member since:</span>{" "}
                    {new Date(overview.profile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </section>

              {overview.tickets?.length ? (
                <section className="app-panel-card rounded-[2rem] p-6">
                  <h2 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                    Your tickets
                  </h2>
                  <div className="mt-4 space-y-3">
                    {overview.tickets.slice(0, 6).map((ticket) => (
                      <div
                        key={ticket.id}
                        className="rounded-2xl border p-4"
                        style={{
                          borderColor: "var(--app-border)",
                          background: "var(--app-card-muted)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold" style={{ color: "var(--app-text)" }}>
                              {ticket.title}
                            </p>
                            <p className="mt-1 text-sm" style={{ color: "var(--app-text-muted)" }}>
                              {ticket.description}
                            </p>
                          </div>
                          <span
                            className={`app-status-pill rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${getStatusClasses(
                              ticket.status,
                            )}`}
                          >
                            {ticket.status}
                          </span>
                        </div>
                        <div
                          className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em]"
                          style={{ color: "var(--app-text-soft)" }}
                        >
                          <span>{ticket.priority}</span>
                          <span>|</span>
                          <span>{ticket.assignee_name || "Support team"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {overview.recent_notifications?.length ? (
                <section className="app-panel-card rounded-[2rem] p-6">
                  <h2 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                    Recent updates
                  </h2>
                  <div className="mt-4 space-y-3">
                    {overview.recent_notifications.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border p-4"
                        style={{
                          borderColor: "var(--app-border)",
                          background: "var(--app-card-muted)",
                        }}
                      >
                        <p className="text-sm leading-6" style={{ color: "var(--app-text-muted)" }}>
                          {item.message}
                        </p>
                        <p
                          className="mt-2 text-[11px] uppercase tracking-[0.16em]"
                          style={{ color: "var(--app-text-soft)" }}
                        >
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
