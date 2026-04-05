import { useEffect, useMemo, useState } from "react";

const EMPTY_COPILOT = {
  summary: "",
  suggested_reply: "",
  articles: [],
  prior_conversations: [],
  isLoading: false,
};

export default function useInboxCopilot({ apiUrl, token, activeChat }) {
  const [copilotState, setCopilotState] = useState({
    conversationId: null,
    data: EMPTY_COPILOT,
    error: "",
  });
  const activeConversationId = activeChat?.id || null;

  useEffect(() => {
    if (!activeConversationId) {
      return undefined;
    }

    let cancelled = false;

    const fetchCopilot = async () => {
      try {
        const res = await fetch(
          `${apiUrl}/api/protected/conversations/${activeConversationId}/copilot`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (cancelled) {
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setCopilotState({
            conversationId: activeConversationId,
            data,
            error: "",
          });
        } else if (res.status === 403) {
          setCopilotState({
            conversationId: activeConversationId,
            data: EMPTY_COPILOT,
            error: "forbidden",
          });
        } else {
          setCopilotState({
            conversationId: activeConversationId,
            data: EMPTY_COPILOT,
            error: "failed",
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch copilot", err);
          setCopilotState({
            conversationId: activeConversationId,
            data: EMPTY_COPILOT,
            error: "failed",
          });
        }
      }
    };

    const debounce = setTimeout(fetchCopilot, 120);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [activeConversationId, apiUrl, token]);

  const copilot = useMemo(() => {
    if (!activeConversationId) {
      return EMPTY_COPILOT;
    }
    if (copilotState.conversationId !== activeConversationId) {
      return { ...EMPTY_COPILOT, isLoading: true };
    }
    if (copilotState.error === "forbidden") {
      return {
        summary: "AI Copilot is available for support agents only.",
        suggested_reply: "",
        articles: [],
        prior_conversations: [],
        isLoading: false,
      };
    }
    if (copilotState.error) {
      return {
        summary: "Failed to load insights.",
        suggested_reply: "",
        articles: [],
        prior_conversations: [],
        isLoading: false,
      };
    }
    return { ...copilotState.data, isLoading: false };
  }, [activeConversationId, copilotState]);

  return {
    copilot,
  };
}
