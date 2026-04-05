import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useInboxConversationsLoader from "./useInboxConversationsLoader";

describe("useInboxConversationsLoader", () => {
  const baseFilters = {
    status: "open",
    assignee_id: "",
    days: "",
    tag: "",
    source: "",
  };

  const createBaseArgs = () => ({
    apiUrl: "http://localhost:8900",
    token: "token-1",
    filters: baseFilters,
    navigate: vi.fn(),
    setConversations: vi.fn(),
    setActiveChat: vi.fn(),
    setAccessError: vi.fn(),
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads conversations and clears access errors on success", async () => {
    const args = createBaseArgs();
    const data = [{ id: "conversation-1" }];
    fetch.mockResolvedValue({
      ok: true,
      json: async () => data,
    });

    renderHook(() => useInboxConversationsLoader(args));

    await waitFor(() => {
      expect(args.setConversations).toHaveBeenCalledWith(data);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain("status=open");
    expect(args.setAccessError).toHaveBeenCalledWith("");
    expect(args.setActiveChat).toHaveBeenCalledTimes(1);
  });

  it("handles forbidden responses by clearing state and setting access error", async () => {
    const args = createBaseArgs();
    fetch.mockResolvedValue({ ok: false, status: 403 });

    renderHook(() => useInboxConversationsLoader(args));

    await waitFor(() => {
      expect(args.setAccessError).toHaveBeenCalledWith(
        "Your account is not a support agent/admin, so the shared inbox is not available.",
      );
    });

    expect(args.setConversations).toHaveBeenCalledWith([]);
    expect(args.setActiveChat).toHaveBeenCalledWith(null);
  });

  it("handles unauthorized responses by removing token and navigating to login", async () => {
    const args = createBaseArgs();
    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");
    fetch.mockResolvedValue({ ok: false, status: 401 });

    renderHook(() => useInboxConversationsLoader(args));

    await waitFor(() => {
      expect(args.navigate).toHaveBeenCalledWith("/login");
    });

    expect(removeItemSpy).toHaveBeenCalledWith("token");
  });

  it("polls conversations every 30 seconds while token is present", async () => {
    vi.useFakeTimers();
    const args = createBaseArgs();
    fetch.mockResolvedValue({ ok: true, json: async () => [] });

    renderHook(() => useInboxConversationsLoader(args));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
