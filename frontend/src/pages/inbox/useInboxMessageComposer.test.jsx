import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useInboxMessageComposer from "./useInboxMessageComposer";

describe("useInboxMessageComposer", () => {
  const createBaseArgs = () => ({
    apiUrl: "http://localhost:8900",
    token: "test-token",
    activeChat: { id: "conversation-1" },
    messagePrompt: "",
    setMessagePrompt: vi.fn(),
    isInternal: false,
    setIsInternal: vi.fn(),
    attachment: null,
    setAttachment: vi.fn(),
    isUploading: false,
    setIsUploading: vi.fn(),
    setMessages: vi.fn(),
    sendRealtimeEvent: vi.fn(),
    typingTimeoutRef: { current: null },
  });

  it("stores attachment when file size is within the limit", () => {
    const args = createBaseArgs();
    const file = new File(["hello"], "note.txt", { type: "text/plain" });

    const { result } = renderHook(() => useInboxMessageComposer(args));

    act(() => {
      result.current.handleFileChange({ target: { files: [file] } });
    });

    expect(args.setAttachment).toHaveBeenCalledWith(file);
  });

  it("emits typing events with debounce for non-internal messages", () => {
    vi.useFakeTimers();
    const args = createBaseArgs();

    const { result } = renderHook(() => useInboxMessageComposer(args));

    act(() => {
      result.current.handlePromptChange({ target: { value: "Hello" } });
    });

    expect(args.setMessagePrompt).toHaveBeenCalledWith("Hello");
    expect(args.sendRealtimeEvent).toHaveBeenCalledWith({
      type: "typing",
      is_typing: true,
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(args.sendRealtimeEvent).toHaveBeenCalledWith({
      type: "typing",
      is_typing: false,
    });

    vi.useRealTimers();
  });
});
