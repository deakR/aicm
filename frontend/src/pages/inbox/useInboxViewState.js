import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildInboxFilterSummary,
  defaultInboxFilters,
  getInboxPanelLayout,
} from "./inboxHelpers";

export default function useInboxViewState({ agents, conversations }) {
  const [filters, setFilters] = useState(() => ({ ...defaultInboxFilters }));
  const [showFilters, setShowFilters] = useState(false);
  const [showConversationRail, setShowConversationRail] = useState(() => {
    const persisted = localStorage.getItem("aicm:inbox-show-list");
    return persisted === null ? true : persisted === "true";
  });
  const [showDetailsRail, setShowDetailsRail] = useState(() => {
    const persisted = localStorage.getItem("aicm:inbox-show-details");
    return persisted === null ? false : persisted === "true";
  });

  const availableTags = useMemo(() => {
    const tags = new Set();
    conversations.forEach((conversation) => {
      (conversation.tags || []).forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [conversations]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => String(value).trim()).length,
    [filters],
  );

  const filterSummary = useMemo(
    () => buildInboxFilterSummary(filters, agents),
    [agents, filters],
  );

  useEffect(() => {
    localStorage.setItem("aicm:inbox-show-details", String(showDetailsRail));
  }, [showDetailsRail]);

  useEffect(() => {
    localStorage.setItem("aicm:inbox-show-list", String(showConversationRail));
  }, [showConversationRail]);

  const panelLayout = useMemo(
    () => getInboxPanelLayout(showConversationRail, showDetailsRail),
    [showConversationRail, showDetailsRail],
  );
  const shouldShowFilters = showFilters || activeFilterCount > 0;

  const clearFilters = useCallback(() => {
    setFilters({ ...defaultInboxFilters });
  }, []);

  return {
    filters,
    setFilters,
    showFilters: shouldShowFilters,
    setShowFilters,
    showConversationRail,
    setShowConversationRail,
    showDetailsRail,
    setShowDetailsRail,
    availableTags,
    activeFilterCount,
    filterSummary,
    panelLayout,
    clearFilters,
  };
}
