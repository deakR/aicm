import React from "react";

import ConversationListItem from "./ConversationListItem";
import InboxBulkActionsBar from "./InboxBulkActionsBar";
import InboxFiltersPanel from "./InboxFiltersPanel";

export default function InboxConversationRail({
  onShowEmailModal,
  onHideConversationRail,
  selectedCount,
  isBulkActionLoading,
  onBulkResolve,
  onBulkReopen,
  onBulkSnooze,
  agents,
  bulkAssignAgentId,
  onBulkAssignAgentIdChange,
  onBulkAssign,
  onClearSelection,
  accessError,
  filterSummary,
  showFilters,
  onToggleFilters,
  activeFilterCount,
  filters,
  setFilters,
  availableTags,
  onClearFilters,
  onToggleSelectAll,
  allSelected,
  hasConversations,
  conversations,
  activeChatId,
  selectedConversations,
  onToggleSelectConversation,
  onSelectConversation,
}) {
  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col border-r app-surface-divider"
      style={{ background: "color-mix(in srgb, var(--app-card-muted) 92%, transparent)" }}
    >
      <div className="app-page-header p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-800">
              Shared Inbox
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Realtime conversations with AI Copilot support.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={onShowEmailModal}
              className="app-secondary-button"
            >
              Simulate email
            </button>
            <button
              type="button"
              onClick={onHideConversationRail}
              className="app-secondary-button"
            >
              Hide list
            </button>
          </div>
        </div>
      </div>

      <InboxBulkActionsBar
        selectedCount={selectedCount}
        isBulkActionLoading={isBulkActionLoading}
        onResolve={onBulkResolve}
        onReopen={onBulkReopen}
        onSnooze={onBulkSnooze}
        agents={agents}
        bulkAssignAgentId={bulkAssignAgentId}
        onBulkAssignAgentIdChange={onBulkAssignAgentIdChange}
        onApplyAssign={onBulkAssign}
        onClear={onClearSelection}
      />

      {accessError && (
        <div className="m-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {accessError}
        </div>
      )}

      <InboxFiltersPanel
        filterSummary={filterSummary}
        showFilters={showFilters}
        onToggleFilters={onToggleFilters}
        activeFilterCount={activeFilterCount}
        filters={filters}
        setFilters={setFilters}
        agents={agents}
        availableTags={availableTags}
        onClearFilters={onClearFilters}
        onToggleSelectAll={onToggleSelectAll}
        allSelected={allSelected}
        hasConversations={hasConversations}
      />

      <div
        className="flex-1 overflow-y-auto"
        style={{ background: "color-mix(in srgb, var(--app-card-muted) 92%, transparent)" }}
      >
        {conversations.length === 0 ? (
          <div className="app-empty-state m-4 p-4 text-center text-sm">
            No conversations match the current filters.
          </div>
        ) : (
          conversations.map((chat) => (
            <ConversationListItem
              key={chat.id}
              chat={chat}
              isActive={activeChatId === chat.id}
              isSelected={selectedConversations.has(chat.id)}
              onToggleSelected={(event) =>
                onToggleSelectConversation(chat.id, event)
              }
              onSelect={() => onSelectConversation(chat)}
            />
          ))
        )}
      </div>
    </div>
  );
}
