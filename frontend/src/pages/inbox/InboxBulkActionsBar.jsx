import React from "react";

export default function InboxBulkActionsBar({
  selectedCount,
  isBulkActionLoading,
  onResolve,
  onReopen,
  onSnooze,
  agents,
  bulkAssignAgentId,
  onBulkAssignAgentIdChange,
  onApplyAssign,
  onClear,
}) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="border-b app-surface-divider px-4 py-2" style={{ background: "color-mix(in srgb, var(--brand-accent-soft) 52%, var(--app-card))" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold" style={{ color: "var(--brand-accent-dark)" }}>
          {selectedCount} selected
        </span>
        <button
          type="button"
          disabled={isBulkActionLoading}
          onClick={onResolve}
          className="app-success-button app-button-base app-button-sm rounded px-2 py-1 text-xs disabled:opacity-50"
        >
          Resolve
        </button>
        <button
          type="button"
          disabled={isBulkActionLoading}
          onClick={onReopen}
          className="app-primary-button app-button-base app-button-sm rounded px-2 py-1 text-xs disabled:opacity-50"
        >
          Re-open
        </button>
        <button
          type="button"
          disabled={isBulkActionLoading}
          onClick={onSnooze}
          className="app-warning-button app-button-base app-button-sm rounded px-2 py-1 text-xs disabled:opacity-50"
        >
          Snooze
        </button>
        {agents.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              value={bulkAssignAgentId}
              onChange={(event) => onBulkAssignAgentIdChange(event.target.value)}
              className="app-input rounded-lg px-2 py-1 text-xs"
            >
              <option value="">Assign to...</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            {bulkAssignAgentId && (
              <button
                type="button"
                disabled={isBulkActionLoading}
                onClick={onApplyAssign}
                className="app-primary-button app-button-base app-button-sm rounded px-2 py-1 text-xs disabled:opacity-50"
              >
                Apply
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onClear}
          className="app-link-action ml-auto"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
