import { useCallback, useEffect } from "react";

export default function useInboxConversationsLoader({
  apiUrl,
  token,
  filters,
  navigate,
  setConversations,
  setActiveChat,
  setAccessError,
}) {
  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.assignee_id) params.set("assignee_id", filters.assignee_id);
      if (filters.days) params.set("days", filters.days);
      if (filters.tag.trim())
        params.set("tag", filters.tag.trim().toLowerCase());
      if (filters.source) params.set("source", filters.source);

      const query = params.toString();
      const res = await fetch(
        `${apiUrl}/api/protected/conversations${query ? `?${query}` : ""}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        setAccessError("");
        const data = await res.json();
        setConversations(data);
        if (data.length > 0) {
          setActiveChat(
            (prev) => data.find((chat) => chat.id === prev?.id) || data[0],
          );
        } else {
          setActiveChat(null);
        }
      } else if (res.status === 403) {
        setConversations([]);
        setActiveChat(null);
        setAccessError(
          "Your account is not a support agent/admin, so the shared inbox is not available.",
        );
      } else if (res.status === 401) {
        localStorage.removeItem("token");
        navigate("/workspace/login");
      }
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  }, [
    apiUrl,
    filters,
    navigate,
    setAccessError,
    setActiveChat,
    setConversations,
    token,
  ]);

  useEffect(() => {
    if (token) {
      loadConversations();
    }
  }, [loadConversations, token]);

  useEffect(() => {
    if (!token) return undefined;

    const refreshTimer = setInterval(() => {
      loadConversations();
    }, 30000);

    return () => clearInterval(refreshTimer);
  }, [loadConversations, token]);

  return {
    loadConversations,
  };
}
