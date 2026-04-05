import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import useInboxViewState from "./useInboxViewState";

describe("useInboxViewState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("derives filter summary and supports clearFilters", async () => {
    const agents = [{ id: "agent-1", name: "Avery" }];
    const conversations = [
      { id: "c-1", tags: ["billing", "urgent"] },
      { id: "c-2", tags: ["technical"] },
    ];

    const { result } = renderHook(() =>
      useInboxViewState({
        agents,
        conversations,
      }),
    );

    expect(result.current.availableTags).toEqual([
      "billing",
      "technical",
      "urgent",
    ]);
    expect(result.current.filterSummary).toBe(
      "All conversations, all assignees, any time, any source",
    );

    act(() => {
      result.current.setFilters({
        status: "open",
        assignee_id: "agent-1",
        days: "7",
        tag: "billing",
        source: "web",
      });
    });

    await waitFor(() => {
      expect(result.current.activeFilterCount).toBe(5);
    });
    expect(result.current.showFilters).toBe(true);
    expect(result.current.filterSummary).toContain("Status: open");
    expect(result.current.filterSummary).toContain("Assignee: Avery");

    act(() => {
      result.current.clearFilters();
    });

    await waitFor(() => {
      expect(result.current.activeFilterCount).toBe(0);
    });
    expect(result.current.filterSummary).toBe(
      "All conversations, all assignees, any time, any source",
    );
  });

  it("persists rail visibility and updates panel layout", async () => {
    const { result } = renderHook(() =>
      useInboxViewState({
        agents: [],
        conversations: [],
      }),
    );

    expect(result.current.panelLayout.storageKey).toBe(
      "aicm:inbox-panels:list:nodetails",
    );

    act(() => {
      result.current.setShowConversationRail(false);
      result.current.setShowDetailsRail(true);
    });

    await waitFor(() => {
      expect(result.current.panelLayout.storageKey).toBe(
        "aicm:inbox-panels:nol:details",
      );
    });

    expect(localStorage.getItem("aicm:inbox-show-list")).toBe("false");
    expect(localStorage.getItem("aicm:inbox-show-details")).toBe("true");
  });
});
