import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useInboxConversationActions from "./useInboxConversationActions";

describe("useInboxConversationActions", () => {
  const createBaseArgs = () => ({
    apiUrl: "http://localhost:8900",
    token: "test-token",
    activeChat: {
      id: "conversation-1",
      tags: ["billing"],
      status: "open",
    },
    setConversations: vi.fn(),
    setActiveChat: vi.fn(),
    loadConversations: vi.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("toggles per-conversation selection and select-all behavior", () => {
    const args = createBaseArgs();
    const { result } = renderHook(() => useInboxConversationActions(args));
    const event = { stopPropagation: vi.fn() };

    act(() => {
      result.current.toggleSelectConversation("conversation-1", event);
    });

    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(result.current.selectedConversations.has("conversation-1")).toBe(true);

    act(() => {
      result.current.toggleSelectAll([
        { id: "conversation-1" },
        { id: "conversation-2" },
      ]);
    });

    expect(result.current.selectedConversations.size).toBe(2);

    act(() => {
      result.current.toggleSelectAll([
        { id: "conversation-1" },
        { id: "conversation-2" },
      ]);
    });

    expect(result.current.selectedConversations.size).toBe(0);
  });

  it("sends selected ids for bulk actions and refreshes conversations", async () => {
    const args = createBaseArgs();
    fetch.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useInboxConversationActions(args));

    act(() => {
      result.current.toggleSelectConversation("conversation-1", {
        stopPropagation: () => {},
      });
    });

    await act(async () => {
      await result.current.handleBulkAction("resolve");
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain("/api/protected/conversations/bulk");
    const body = JSON.parse(options.body);
    expect(body.action).toBe("resolve");
    expect(body.conversation_ids).toEqual(["conversation-1"]);
    expect(args.loadConversations).toHaveBeenCalledTimes(1);
    expect(result.current.selectedConversations.size).toBe(0);
  });

  it("updates local conversation state when assignment update succeeds", async () => {
    const args = createBaseArgs();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "pending" }),
    });

    const { result } = renderHook(() => useInboxConversationActions(args));

    await act(async () => {
      await result.current.handleUpdateConversation({ status: "pending" });
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain("/api/protected/conversations/conversation-1/assign");
    expect(options.method).toBe("PUT");

    const conversationsUpdater = args.setConversations.mock.calls[0][0];
    const updatedConversations = conversationsUpdater([
      { id: "conversation-1", status: "open" },
      { id: "conversation-2", status: "open" },
    ]);
    expect(updatedConversations[0].status).toBe("pending");

    const activeChatUpdater = args.setActiveChat.mock.calls[0][0];
    const updatedActive = activeChatUpdater({
      id: "conversation-1",
      status: "open",
    });
    expect(updatedActive.status).toBe("pending");
  });

  it("adds normalized tags and clears the tag input", async () => {
    const args = createBaseArgs();
    const setNewTag = vi.fn();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["billing", "urgent", "vip"] }),
    });

    const { result } = renderHook(() => useInboxConversationActions(args));

    await act(async () => {
      await result.current.handleAddTag("urgent, billing, VIP", setNewTag);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.tags).toEqual(["billing", "urgent", "vip"]);
    expect(setNewTag).toHaveBeenCalledWith("");
  });

  it("removes a tag and persists the updated tag list", async () => {
    const args = createBaseArgs();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tags: [] }),
    });

    const { result } = renderHook(() => useInboxConversationActions(args));

    await act(async () => {
      await result.current.handleRemoveTag("billing");
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.tags).toEqual([]);
  });
});
