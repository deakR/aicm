import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  buildBrandPalette,
} from "../branding";
import useBranding from "../context/useBranding";
import { useThemePreference } from "../theme";
import { stripHtml } from "../utils/contentHelpers";
import { getSenderLabel } from "../utils/conversationDisplay";
import { mergeThreadMessages } from "../utils/messageThread";
import {
  clearLastCustomerConversation,
  clearStoredToken,
  consumeWidgetResumeRequested,
  getCurrentSession,
  getLastCustomerConversation,
  markWidgetResumeRequested,
  rememberLastCustomerConversation,
  setPostLoginPath,
} from "../auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8900";

export default function Widget({ embedded = false }) {
  const [isOpen, setIsOpen] = useState(embedded);
  const [activeTab, setActiveTab] = useState("chat");
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [wsState, setWsState] = useState("disconnected");
  const [articles, setArticles] = useState([]);
  const [articleSearch, setArticleSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isArticlesLoading, setIsArticlesLoading] = useState(false);
  const { branding } = useBranding();
  const [typingNotice, setTypingNotice] = useState("");
  const [readState, setReadState] = useState({
    customer_last_read_at: "",
    agent_last_read_at: "",
  });
  const [attachment, setAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const threadViewportRef = useRef(null);
  const lastRenderedMessageIdRef = useRef("");
  const isThreadPinnedToBottomRef = useRef(true);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeConversationIdRef = useRef("");
  const fetchRequestSeqRef = useRef(0);
  const { resolvedTheme } = useThemePreference();
  const palette = buildBrandPalette(branding.accent_color);
  const isDark = resolvedTheme === "dark";
  const viewerSession = getCurrentSession();
  const chromeSurface = isDark
    ? "border-slate-800 bg-slate-950 text-slate-100"
    : "border-gray-200 bg-white text-slate-900";
  const widgetMutedSurfaceStyle = {
    background: "var(--app-card-muted)",
  };
  const widgetCardStyle = {
    background: "var(--app-card)",
    borderColor: "var(--app-border)",
    color: "var(--app-text)",
  };
  const widgetInputStyle = {
    background: "var(--app-surface)",
    borderColor: "var(--app-border)",
    color: "var(--app-text)",
  };

  const initializeCustomerSession = useCallback(
    async ({ createIfMissing = false } = {}) => {
      if (!viewerSession.isAuthenticated || viewerSession.role !== "customer") {
        setSession(null);
        return null;
      }

      const preferredConversationId = getLastCustomerConversation(
        viewerSession.userId,
      );
      const params = new URLSearchParams();
      if (preferredConversationId) {
        params.set("conversation_id", preferredConversationId);
      }
      if (!createIfMissing) {
        params.set("create_if_missing", "false");
      }

      const query = params.toString();
      const response = await fetch(
        `${API_URL}/api/protected/customer/chat-session${query ? `?${query}` : ""}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${viewerSession.token}`,
          },
        },
      );

      if (response.status === 401) {
        clearStoredToken();
        setSession(null);
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const conversationId = data?.conversation_id || "";

      if (conversationId) {
        rememberLastCustomerConversation(viewerSession.userId, conversationId);
      } else {
        clearLastCustomerConversation(viewerSession.userId);
      }

      const nextSession = {
        token: viewerSession.token,
        conversationId,
        userId: viewerSession.userId,
      };
      setSession(nextSession);
      return nextSession;
    },
    [viewerSession.isAuthenticated, viewerSession.role, viewerSession.token, viewerSession.userId],
  );

  const sendRealtimeEvent = (payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  };

  useLayoutEffect(() => {
    const conversationId = session?.conversationId || "";
    activeConversationIdRef.current = conversationId;
    fetchRequestSeqRef.current += 1;
    lastRenderedMessageIdRef.current = "";
    isThreadPinnedToBottomRef.current = true;
    setMessages([]);
    setTypingNotice("");
    setReadState({ customer_last_read_at: "", agent_last_read_at: "" });
    setWsState(conversationId ? "connecting" : "disconnected");
  }, [session?.conversationId]);

  useEffect(() => {
    if (embedded) {
      setIsOpen(true);
    }
  }, [embedded]);

  useEffect(() => {
    if (embedded || !viewerSession.isAuthenticated || viewerSession.role !== "customer") {
      return;
    }

    if (consumeWidgetResumeRequested()) {
      setIsOpen(true);
      setActiveTab("chat");
    }
  }, [embedded, viewerSession.isAuthenticated, viewerSession.role]);

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
      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    }

    lastRenderedMessageIdRef.current = latestMessageId;
  }, [messages]);

  useEffect(() => {
    if (!session?.conversationId) return;

    let socket = null;
    let reconnectTimer = null;
    let shouldReconnect = true;
    const conversationId = session.conversationId;

    const fetchMessages = async () => {
      const requestSeq = ++fetchRequestSeqRef.current;
      const res = await fetch(
        `${API_URL}/api/protected/conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${session.token}` },
        },
      );
      if (!res.ok) {
        return;
      }

      const fetchedMessages = await res.json();
      if (
        activeConversationIdRef.current !== conversationId ||
        requestSeq !== fetchRequestSeqRef.current
      ) {
        return;
      }

      setMessages((prev) =>
        mergeThreadMessages(
          prev,
          fetchedMessages.filter((message) => !message.is_internal),
        ),
      );
      sendRealtimeEvent({ type: "read_receipt" });
    };

    const connect = () => {
      setWsState("connecting");
      const wsProtocol = API_URL.startsWith("https") ? "wss" : "ws";
      const wsUrl = `${API_URL.replace(/^http/, wsProtocol)}/api/ws/${conversationId}?token=${encodeURIComponent(session.token)}`;
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
        const incoming = JSON.parse(event.data);

        if (incoming?.type === "typing") {
          const payload = incoming.payload || {};
          if (payload.role !== "customer") {
            setTypingNotice(
              payload.is_typing
                ? `${payload.name || "Support"} is typing...`
                : "",
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

        if (incoming?.type === "conversation_update") {
          if (
            incoming.payload?.customer_last_read_at ||
            incoming.payload?.agent_last_read_at
          ) {
            setReadState({
              customer_last_read_at:
                incoming.payload.customer_last_read_at || "",
              agent_last_read_at: incoming.payload.agent_last_read_at || "",
            });
          }
          return;
        }

        if (
          activeConversationIdRef.current !== conversationId ||
          incoming?.conversation_id !== conversationId ||
          incoming?.is_internal
        ) {
          return;
        }

        const newMsg = incoming;
        setTypingNotice("");
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev;
          return mergeThreadMessages(prev, [newMsg]);
        });

        if (newMsg?.sender_id !== session.userId) {
          sendRealtimeEvent({ type: "read_receipt" });
        }
      };

      socket.onclose = () => {
        if (
          !shouldReconnect ||
          activeConversationIdRef.current !== conversationId
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

    return () => {
      shouldReconnect = false;
      clearInterval(refreshTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (activeConversationIdRef.current === conversationId) {
        activeConversationIdRef.current = "";
      }
      socketRef.current = null;
      if (socket) socket.close();
    };
  }, [session]);

  useEffect(() => {
    if (!isOpen || activeTab !== "chat") {
      return;
    }

    if (viewerSession.isAuthenticated && viewerSession.role !== "customer") {
      setSession(null);
      setMessages([]);
      setWsState("disconnected");
      return;
    }

    let isCancelled = false;

    const initializeChatSession = async () => {
      try {
        if (!viewerSession.isAuthenticated || viewerSession.role !== "customer") {
          if (!isCancelled) {
            setSession(null);
          }
          return;
        }

        const nextSession = await initializeCustomerSession({
          createIfMissing: false,
        });
        if (isCancelled || !nextSession) {
          return;
        }
      } catch (error) {
        console.error("Failed to initialize customer chat session", error);
      }
    };

    initializeChatSession();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, initializeCustomerSession, isOpen, viewerSession.isAuthenticated, viewerSession.role]);

  useEffect(() => {
    if (!isOpen || articles.length > 0) return;

    const fetchArticles = async () => {
      setIsArticlesLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/articles`);
        if (res.ok) {
          setArticles(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch widget articles", err);
      } finally {
        setIsArticlesLoading(false);
      }
    };

    fetchArticles();
  }, [isOpen, articles.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || !session || isUploading) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendRealtimeEvent({ type: "typing", is_typing: false });
    setIsUploading(true);

    let uploadedFile = null;
    if (attachment) {
      const formData = new FormData();
      formData.append("file", attachment);
      try {
        const uploadRes = await fetch(`${API_URL}/api/protected/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}` },
          body: formData,
        });
        if (uploadRes.ok) {
          uploadedFile = await uploadRes.json();
        } else {
          console.error("Failed to upload attachment");
          setIsUploading(false);
          return;
        }
      } catch (err) {
        console.error("Upload error", err);
        setIsUploading(false);
        return;
      }
    }

    const payload = { content: input.trim() };
    if (uploadedFile) {
      payload.attachment_url = uploadedFile.url;
      payload.attachment_name = uploadedFile.name;
      payload.attachment_type = uploadedFile.type;
    }

    let activeSession = session;
    if (!activeSession.conversationId) {
      const createdSession = await initializeCustomerSession({
        createIfMissing: true,
      });
      if (!createdSession?.conversationId) {
        setIsUploading(false);
        return;
      }
      activeSession = createdSession;
    }

    const res = await fetch(
      `${API_URL}/api/protected/conversations/${activeSession.conversationId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeSession.token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    setIsUploading(false);
    if (res.ok) {
      const newMsg = await res.json();
      setMessages((prev) => {
        if (prev.find((m) => m.id === newMsg.id)) return prev;
        return mergeThreadMessages(prev, [newMsg]);
      });
      setInput("");
      setAttachment(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Max size is 5MB.");
        return;
      }
      setAttachment(file);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!session?.conversationId) {
      return;
    }

    sendRealtimeEvent({ type: "typing", is_typing: value.trim().length > 0 });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendRealtimeEvent({ type: "typing", is_typing: false });
    }, 1200);
  };

  const lastCustomerMessage = [...messages]
    .filter(
      (message) =>
        !message.is_internal &&
        (message.sender_id === session?.userId ||
          message.sender_role === "customer"),
    )
    .at(-1);

  const filteredArticles = articles.filter((article) => {
    const term = articleSearch.trim().toLowerCase();
    if (!term) return true;
    return [
      article.title,
      article.collection,
      article.section,
      stripHtml(article.content),
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  const openArticle = async (articleId) => {
    try {
      const res = await fetch(`${API_URL}/api/articles/${articleId}`);
      if (res.ok) {
        const article = await res.json();
        setSelectedArticle(article);
        setArticles((prev) =>
          prev.map((entry) => (entry.id === article.id ? article : entry)),
        );
      }
    } catch (err) {
      console.error("Failed to load widget article", err);
    }
  };

  const emptyChatGreeting =
    branding.ai_greeting?.trim?.() ||
    branding.greeting?.trim() ||
    "Hi there! How can I help you today?";

  let headerSubtitle = "Chat with AI or browse help articles";
  if (activeTab === "help") {
    headerSubtitle = "Search our help center";
  } else if (activeTab === "chat" && session && wsState === "connected") {
    headerSubtitle = "Connected - We're here to help";
  } else if (
    activeTab === "chat" &&
    (wsState === "reconnecting" || wsState === "connecting")
  ) {
    headerSubtitle = "Connecting...";
  } else if (activeTab === "chat" && !session) {
    headerSubtitle = "Sign in to start a support conversation";
  }

  const prepareCustomerAuthReturn = () => {
    if (typeof window === "undefined") {
      return;
    }

    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const targetPath = currentPath || "/";
    if (targetPath !== "/") {
      setPostLoginPath(targetPath);
    }
    markWidgetResumeRequested();
  };

  return (
    <div
      className={
        embedded
          ? "h-full w-full font-sans"
          : "fixed bottom-6 right-6 z-50 font-sans"
      }
    >
      {isOpen && (
        <div
          className={`flex min-h-0 flex-col overflow-hidden border transition-all duration-300 ${chromeSurface} ${
            embedded
              ? "h-full w-full rounded-none border-0 shadow-none"
              : "mb-4 h-[34rem] w-[22rem] origin-bottom-right rounded-2xl shadow-2xl"
          }`}
        >
          <div
            className="p-4 text-white"
            style={{
              backgroundImage: `linear-gradient(135deg, ${palette.accentDark}, ${palette.accent})`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold">{branding.brand_name}</h3>
                <p className="text-[11px] text-white/80">
                  {headerSubtitle}
                </p>
              </div>
              {!embedded && (
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close support chat"
                  className="text-lg leading-none text-white/80 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white/15 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                aria-label="Open chat tab"
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeTab === "chat" ? "bg-white" : "text-white/85"}`}
                style={
                  activeTab === "chat"
                    ? { color: palette.accentDark }
                    : undefined
                }
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("help")}
                aria-label="Open help center tab"
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeTab === "help" ? "bg-white" : "text-white/85"}`}
                style={
                  activeTab === "help"
                    ? { color: palette.accentDark }
                    : undefined
                }
              >
                Help Center
              </button>
            </div>
          </div>

          {activeTab === "help" ? (
            <div className="flex min-h-0 flex-1 flex-col" style={widgetMutedSurfaceStyle}>
              <div
                className="border-b p-3"
                style={{
                  ...widgetCardStyle,
                  borderColor: "var(--app-border)",
                }}
              >
                <input
                  type="text"
                  placeholder="Search help articles..."
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                  style={{
                    ...widgetInputStyle,
                    borderColor: selectedArticle
                      ? palette.accentBorder
                      : widgetInputStyle.borderColor,
                  }}
                />
              </div>
              {selectedArticle ? (
                <div
                  className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3"
                  style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedArticle(null)}
                    className="text-xs font-semibold"
                    style={{ color: palette.accentDark }}
                  >
                    Back to articles
                  </button>
                  <div
                    className="rounded-2xl border p-4 shadow-sm"
                    style={widgetCardStyle}
                  >
                    <h4 className="text-lg font-semibold" style={{ color: "var(--app-text)" }}>
                      {selectedArticle.title}
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={{
                          background: "color-mix(in srgb, var(--brand-accent-soft) 72%, var(--app-card))",
                          color: palette.accentDark,
                        }}
                      >
                        {selectedArticle.collection || "General"}
                      </span>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={{
                          background: "var(--app-card-muted)",
                          color: "var(--app-text-muted)",
                        }}
                      >
                        {selectedArticle.section || "General"}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--app-text-soft)" }}>
                      {selectedArticle.view_count ?? 0} views
                    </p>
                    <div
                      className="mt-3 prose prose-sm max-w-none text-sm leading-6"
                      style={{ color: "var(--app-text-muted)" }}
                      dangerouslySetInnerHTML={{
                        __html: selectedArticle.content,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("chat")}
                    className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-white"
                    style={{ backgroundColor: palette.accent }}
                  >
                    Ask about this article
                  </button>
                </div>
              ) : (
                <div
                  className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3"
                  style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
                >
                  {isArticlesLoading ? (
                    <p className="mt-8 text-center text-sm" style={{ color: "var(--app-text-muted)" }}>
                      Loading articles...
                    </p>
                  ) : filteredArticles.length === 0 ? (
                    <p className="mt-8 text-center text-sm" style={{ color: "var(--app-text-muted)" }}>
                      No help articles match this search yet.
                    </p>
                  ) : (
                    filteredArticles.map((article) => (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => openArticle(article.id)}
                        className="w-full rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md"
                        style={{
                          ...widgetCardStyle,
                          borderColor: palette.accentBorder,
                        }}
                      >
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                            style={{
                              background: "color-mix(in srgb, var(--brand-accent-soft) 72%, var(--app-card))",
                              color: palette.accentDark,
                            }}
                          >
                            {article.collection || "General"}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                            style={{
                              background: "var(--app-card-muted)",
                              color: "var(--app-text-muted)",
                            }}
                          >
                            {article.section || "General"}
                          </span>
                        </div>
                        <div className="text-sm font-semibold" style={{ color: "var(--app-text)" }}>
                          {article.title}
                        </div>
                        <div className="mt-2 line-clamp-3 text-xs leading-5" style={{ color: "var(--app-text-muted)" }}>
                          {stripHtml(article.content)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : !session ? (
            <div className="flex flex-1 flex-col justify-center p-6" style={widgetMutedSurfaceStyle}>
              <div className="app-detail-card rounded-3xl p-5 text-center">
                <p className="text-sm font-semibold" style={{ color: "var(--app-text)" }}>
                  {viewerSession.isAuthenticated && viewerSession.role !== "customer"
                    ? "Customer chat is only available for signed-in customer accounts."
                    : `Welcome to ${branding.brand_name}.`}
                </p>
                <p className="mt-3 text-sm leading-6" style={{ color: "var(--app-text-muted)" }}>
                  {viewerSession.isAuthenticated && viewerSession.role !== "customer"
                    ? "You are currently signed in with a workspace account. Use the support inbox for internal replies, or sign in as a customer to test the public chat."
                    : "Customers must sign in or register before starting chat. Once signed in, this widget opens the authenticated support conversation automatically."}
                </p>
                <div className="mt-5 flex flex-col gap-3">
                  {!viewerSession.isAuthenticated ? (
                    <>
                        <a
                          href="/login"
                          onClick={prepareCustomerAuthReturn}
                          className="app-primary-button w-full text-center"
                        >
                          Customer Sign In
                        </a>
                        <a
                          href="/register"
                          onClick={prepareCustomerAuthReturn}
                          className="app-secondary-button w-full text-center"
                        >
                          Create Customer Account
                        </a>
                    </>
                  ) : viewerSession.role !== "customer" ? (
                    <>
                        <a
                          href="/login"
                          onClick={prepareCustomerAuthReturn}
                          className="app-secondary-button w-full text-center"
                        >
                          Switch to Customer Login
                        </a>
                      <a
                        href="/inbox"
                        className="app-link-action w-full text-center"
                      >
                        Open Support Inbox
                      </a>
                    </>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--app-text-soft)" }}>
                      Preparing your chat session...
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
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
                className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
                style={{
                  ...widgetMutedSurfaceStyle,
                  WebkitOverflowScrolling: "touch",
                  touchAction: "pan-y",
                  overflowAnchor: "none",
                }}
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-start">
                    <span className="app-message-sender-ai mb-1 inline-flex items-center gap-2 text-[11px] font-medium">
                      <span className="app-message-dot-ai inline-block h-2 w-2 rounded-full"></span>
                      {branding.assistant_name || "AI assistant"}
                    </span>
                    <div className="app-message-bubble-ai max-w-[85%] rounded-2xl rounded-tl-none px-3 py-2 text-sm shadow-sm">
                      {emptyChatGreeting}
                    </div>
                  </div>
                )}
                {messages
                  .filter((m) => !m.is_internal)
                  .map((msg) => {
                    const isCustomer =
                      msg.sender_id === session?.userId ||
                      msg.sender_role === "customer";
                    const isAI = msg.is_ai_generated;
                    const senderLabel = getSenderLabel(msg, session?.userId);
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isCustomer ? "items-end" : "items-start"}`}
                      >
                        {!isCustomer && (
                          <span
                            className={`mb-1 inline-flex items-center gap-2 text-[11px] font-medium ${isAI ? "app-message-sender-ai" : "app-message-sender-support"}`}
                          >
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${isAI ? "app-message-dot-ai" : "app-message-dot-support"}`}
                            ></span>
                            {senderLabel}
                          </span>
                        )}
                        <div
                          className={`max-w-[85%] break-words rounded-2xl p-2 px-3 text-sm shadow-sm ${
                            isCustomer
                              ? "rounded-tr-none text-white"
                              : isAI
                                ? "rounded-tl-none app-message-bubble-ai"
                                : "rounded-tl-none app-message-bubble-support"
                          }`}
                          style={{
                            ...(isCustomer ? { backgroundColor: palette.accent } : {}),
                            overflowWrap: "break-word",
                            wordBreak: "break-word",
                          }}
                        >
                          {msg.content}
                          {msg.attachment_url && (
                            <div className="mt-2 text-left">
                              {msg.attachment_type?.startsWith("image/") ? (
                                <a
                                  href={`${API_URL}${msg.attachment_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img
                                    src={`${API_URL}${msg.attachment_url}`}
                                    alt={msg.attachment_name}
                                    className="max-w-[12rem] rounded-lg shadow-sm"
                                  />
                                </a>
                              ) : (
                                <a
                                  href={`${API_URL}${msg.attachment_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
                                  style={{
                                    background: "var(--app-card-muted)",
                                    color: "var(--app-text)",
                                  }}
                                >
                                  📎 {msg.attachment_name}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                        <span
                          className="mt-1 text-[10px]"
                          style={{ color: "var(--app-text-soft)" }}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isCustomer &&
                          lastCustomerMessage?.id === msg.id &&
                          readState.agent_last_read_at &&
                          new Date(readState.agent_last_read_at) >=
                            new Date(msg.created_at) && (
                            <span className="app-read-receipt mt-1 text-[10px] font-medium">
                              Seen by support
                            </span>
                          )}
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
              <div
                className="flex flex-col border-t p-3"
                style={{
                  ...widgetCardStyle,
                  borderColor: "var(--app-border)",
                }}
              >
                {attachment && (
                  <div
                    className="mb-2 flex items-center justify-between rounded-xl px-3 py-1.5 text-xs"
                    style={{
                      background: "var(--app-card-muted)",
                      color: "var(--app-text-muted)",
                    }}
                  >
                    <span className="truncate max-w-[12rem]">
                      📎 {attachment.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="font-bold transition hover:text-rose-500"
                      style={{ color: "var(--app-text-soft)" }}
                    >
                      x
                    </button>
                  </div>
                )}
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach file"
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full transition"
                    style={{ color: "var(--app-text-soft)" }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "var(--app-card-muted)";
                      event.currentTarget.style.color = "var(--app-text)";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "transparent";
                      event.currentTarget.style.color = "var(--app-text-soft)";
                    }}
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      ></path>
                    </svg>
                  </button>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 rounded-full border px-4 py-2 text-sm outline-none"
                    value={input}
                    onChange={handleInputChange}
                    disabled={isUploading}
                    style={widgetInputStyle}
                  />
                  <button
                    type="submit"
                    disabled={isUploading || (!input.trim() && !attachment)}
                    className="flex h-9 w-9 items-center justify-center rounded-full p-2 text-white disabled:opacity-50"
                    style={{ backgroundColor: palette.accent }}
                  >
                    {isUploading ? ".." : "→"}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {!embedded && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close support chat" : "Open support chat"}
          className="flex h-14 w-14 items-center justify-center rounded-full border shadow-lg transition-transform hover:scale-105"
          style={
            isOpen
              ? {
                  backgroundColor: "var(--app-card)",
                  borderColor: "var(--app-border)",
                }
              : {
                  backgroundColor: palette.accent,
                  borderColor: palette.accent,
                }
          }
        >
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
