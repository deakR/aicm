import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useInboxConversationStream from "./useInboxConversationStream";

class MockWebSocket {
  static OPEN = 1;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    this.send = vi.fn();
    this.close = vi.fn(() => {
      this.readyState = 3;
    });
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    MockWebSocket.instances.push(this);
  }
}

describe("useInboxConversationStream", () => {
  let originalWebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.WebSocket = originalWebSocket;
  });

  const baseFilters = {
    status: "open",
    assignee_id: "",
    days: "",
    tag: "",
    source: "",
  };

  it("connects to the shared inbox websocket channel", () => {
    const { unmount } = renderHook(() =>
      useInboxConversationStream({
        apiUrl: "http://localhost:8900",
        token: "token-1",
        filters: baseFilters,
        activeChatId: "conversation-1",
        setConversations: vi.fn(),
        setActiveChat: vi.fn(),
      }),
    );

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain(
      "/api/ws/__support_inbox__?token=token-1",
    );

    unmount();
  });

  it("applies conversation updates and refreshes active chat", () => {
    const setConversations = vi.fn();
    const setActiveChat = vi.fn();

    const { unmount } = renderHook(() =>
      useInboxConversationStream({
        apiUrl: "http://localhost:8900",
        token: "token-1",
        filters: baseFilters,
        activeChatId: "conversation-1",
        setConversations,
        setActiveChat,
      }),
    );

    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.onmessage({
        data: JSON.stringify({
          type: "conversation_update",
          payload: {
            id: "conversation-1",
            status: "open",
            preview: "Updated preview",
            updated_at: "2026-04-01T00:00:00Z",
          },
        }),
      });
    });

    expect(setConversations).toHaveBeenCalledTimes(1);
    const updater = setConversations.mock.calls[0][0];
    const prev = [
      {
        id: "conversation-1",
        status: "open",
        preview: "Old",
        updated_at: "2026-03-30T00:00:00Z",
      },
      {
        id: "conversation-2",
        status: "open",
        preview: "Other",
        updated_at: "2026-03-29T00:00:00Z",
      },
    ];
    const next = updater(prev);

    expect(next[0].preview).toBe("Updated preview");
    expect(setActiveChat).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("does not insert newly updated conversations that fail current filters", () => {
    const setConversations = vi.fn();

    const { unmount } = renderHook(() =>
      useInboxConversationStream({
        apiUrl: "http://localhost:8900",
        token: "token-1",
        filters: baseFilters,
        activeChatId: "conversation-1",
        setConversations,
        setActiveChat: vi.fn(),
      }),
    );

    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.onmessage({
        data: JSON.stringify({
          type: "conversation_update",
          payload: {
            id: "conversation-9",
            status: "resolved",
            updated_at: "2026-04-01T00:00:00Z",
          },
        }),
      });
    });

    const updater = setConversations.mock.calls[0][0];
    const prev = [{ id: "conversation-1", status: "open" }];
    const next = updater(prev);

    expect(next).toEqual(prev);

    unmount();
  });

  it("reconnects after websocket close", () => {
    vi.useFakeTimers();

    const { unmount } = renderHook(() =>
      useInboxConversationStream({
        apiUrl: "http://localhost:8900",
        token: "token-1",
        filters: baseFilters,
        activeChatId: "conversation-1",
        setConversations: vi.fn(),
        setActiveChat: vi.fn(),
      }),
    );

    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.onclose();
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(MockWebSocket.instances).toHaveLength(2);

    unmount();
  });
});
