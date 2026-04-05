import { useCallback, useState } from "react";

export default function useInboxConversationActions({
  apiUrl,
  token,
  activeChat,
  setConversations,
  setActiveChat,
  loadConversations,
}) {
  const [selectedConversations, setSelectedConversations] = useState(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [bulkAssignAgentId, setBulkAssignAgentId] = useState("");

  const clearSelection = useCallback(() => {
    setSelectedConversations(new Set());
  }, []);

  const handleUpdateConversation = useCallback(
    async (payload) => {
      if (!activeChat) return;

      try {
        const res = await fetch(
          `${apiUrl}/api/protected/conversations/${activeChat.id}/assign`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
        );

        if (res.ok) {
          const updated = await res.json();
          setConversations((prev) =>
            prev.map((chat) =>
              chat.id === activeChat.id ? { ...chat, ...updated } : chat,
            ),
          );
          setActiveChat((prev) => ({ ...prev, ...updated }));
        }
      } catch (err) {
        console.error("Failed to update conversation", err);
      }
    },
    [activeChat, apiUrl, setActiveChat, setConversations, token],
  );

  const handleAddTag = useCallback(
    (newTag, setNewTag) => {
      if (!activeChat || !newTag.trim()) return;

      const nextTags = Array.from(
        new Set([
          ...(activeChat.tags || []),
          ...newTag
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean),
        ]),
      ).sort();

      handleUpdateConversation({ tags: nextTags });
      setNewTag("");
    },
    [activeChat, handleUpdateConversation],
  );

  const handleRemoveTag = useCallback(
    (tagToRemove) => {
      if (!activeChat) return;
      handleUpdateConversation({
        tags: (activeChat.tags || []).filter((tag) => tag !== tagToRemove),
      });
    },
    [activeChat, handleUpdateConversation],
  );

  const toggleSelectConversation = useCallback((id, event) => {
    event.stopPropagation();
    setSelectedConversations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((conversations) => {
    setSelectedConversations((prev) => {
      if (prev.size === conversations.length) {
        return new Set();
      }
      return new Set(conversations.map((conversation) => conversation.id));
    });
  }, []);

  const handleBulkAction = useCallback(
    async (action, extraData = {}) => {
      if (selectedConversations.size === 0) return;
      setIsBulkActionLoading(true);
      try {
        const res = await fetch(`${apiUrl}/api/protected/conversations/bulk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action,
            conversation_ids: Array.from(selectedConversations),
            ...extraData,
          }),
        });
        if (res.ok) {
          clearSelection();
          setBulkAssignAgentId("");
          await loadConversations();
        }
      } catch (err) {
        console.error("Bulk action failed", err);
      } finally {
        setIsBulkActionLoading(false);
      }
    },
    [apiUrl, clearSelection, loadConversations, selectedConversations, token],
  );

  return {
    selectedConversations,
    isBulkActionLoading,
    bulkAssignAgentId,
    setBulkAssignAgentId,
    clearSelection,
    toggleSelectConversation,
    toggleSelectAll,
    handleBulkAction,
    handleUpdateConversation,
    handleAddTag,
    handleRemoveTag,
  };
}
