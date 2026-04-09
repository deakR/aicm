import React from "react";

export default function InboxFiltersPanel({
  filterSummary,
  showFilters,
  onToggleFilters,
  activeFilterCount,
  filters,
  setFilters,
  agents,
  availableTags,
  onClearFilters,
  onToggleSelectAll,
  allSelected,
  hasConversations,
}) {
  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="app-page-header p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--app-text-soft)" }}
          >
            Filters
          </p>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--app-text-muted)" }}
          >
            {filterSummary}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleFilters}
          className="app-secondary-button"
        >
          {showFilters
            ? "Hide"
            : activeFilterCount
              ? `Edit (${activeFilterCount})`
              : "Show"}
        </button>
      </div>

      {showFilters && (
        <div className="mt-4 grid gap-3">
          <div>
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--app-text-soft)" }}
            >
              Status
            </label>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="app-input w-full rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="">All conversations</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="snoozed">Snoozed</option>
            </select>
          </div>

          <div>
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--app-text-soft)" }}
            >
              Assignee
            </label>
            <select
              value={filters.assignee_id}
              onChange={(event) => updateFilter("assignee_id", event.target.value)}
              className="app-input w-full rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="">Everyone</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--app-text-soft)" }}
            >
              Updated within
            </label>
            <select
              value={filters.days}
              onChange={(event) => updateFilter("days", event.target.value)}
              className="app-input w-full rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="">Any time</option>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>

          <div>
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--app-text-soft)" }}
            >
              Source
            </label>
            <select
              value={filters.source}
              onChange={(event) => updateFilter("source", event.target.value)}
              className="app-input w-full rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="">Any source</option>
              <option value="web">Web widget</option>
              <option value="email">Email simulation</option>
            </select>
          </div>

          <div>
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--app-text-soft)" }}
            >
              Tag
            </label>
            <input
              type="text"
              value={filters.tag}
              onChange={(event) => updateFilter("tag", event.target.value)}
              placeholder="billing"
              className="app-input w-full rounded-xl px-3 py-2 text-sm outline-none"
            />
          </div>

          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableTags.slice(0, 6).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => updateFilter("tag", tag)}
                  className="app-secondary-button"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onClearFilters}
            className="app-secondary-button square"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={onToggleSelectAll}
            className="app-link-action"
          >
            {allSelected && hasConversations ? "Deselect all" : "Select all"}
          </button>
        </div>
      )}
    </div>
  );
}
