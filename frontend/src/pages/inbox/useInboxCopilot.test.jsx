import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useInboxCopilot from "./useInboxCopilot";

describe("useInboxCopilot", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns default copilot state when no active chat is selected", () => {
    const { result } = renderHook(() =>
      useInboxCopilot({
        apiUrl: "http://localhost:8900",
        token: "token-1",
        activeChat: null,
      }),
    );

    expect(result.current.copilot).toEqual({
      summary: "",
      suggested_reply: "",
      articles: [],
      prior_conversations: [],
      isLoading: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads copilot insights after debounce", async () => {
    vi.useFakeTimers();
    try {
      const activeChat = { id: "conversation-1" };
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          summary: "Use billing workflow.",
          suggested_reply: "Thanks for reaching out.",
          articles: [{ id: "a1" }],
          prior_conversations: [],
        }),
      });

      const { result } = renderHook(() =>
        useInboxCopilot({
          apiUrl: "http://localhost:8900",
          token: "token-1",
          activeChat,
        }),
      );

      expect(result.current.copilot.isLoading).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(120);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.copilot.summary).toBe("Use billing workflow.");
      expect(result.current.copilot.isLoading).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps forbidden responses to support-role guidance", async () => {
    vi.useFakeTimers();
    try {
      const activeChat = { id: "conversation-1" };
      fetch.mockResolvedValue({ ok: false, status: 403 });

      const { result } = renderHook(() =>
        useInboxCopilot({
          apiUrl: "http://localhost:8900",
          token: "token-1",
          activeChat,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(120);
        await Promise.resolve();
      });

      expect(result.current.copilot.summary).toBe(
        "AI Copilot is available for support agents only.",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
