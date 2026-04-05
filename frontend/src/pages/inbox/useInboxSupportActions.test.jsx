import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useInboxSupportActions from "./useInboxSupportActions";

describe("useInboxSupportActions", () => {
  const createBaseArgs = () => ({
    apiUrl: "http://localhost:8900",
    token: "token-1",
    activeChat: {
      id: "conversation-1",
      customer_id: "customer-1",
      customer_name: "Taylor",
    },
    copilot: {
      summary: "Customer asked about billing",
    },
    emailDraft: {
      name: "Taylor",
      email: "taylor@example.com",
      subject: "Need help",
      content: "Please assist",
    },
    setIsCreatingTicket: vi.fn(),
    setIsSubmittingEmail: vi.fn(),
    setShowEmailModal: vi.fn(),
    setEmailDraft: vi.fn(),
    setActiveChat: vi.fn(),
    setShowDetailsRail: vi.fn(),
    setShowMergeModal: vi.fn(),
    loadConversations: vi.fn().mockResolvedValue(undefined),
    defaultEmailDraft: {
      name: "",
      email: "",
      subject: "",
      content: "",
    },
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("creates a ticket and toggles loading state", async () => {
    const args = createBaseArgs();
    fetch.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useInboxSupportActions(args));

    await act(async () => {
      await result.current.handleCreateTicket();
    });

    expect(args.setIsCreatingTicket).toHaveBeenNthCalledWith(1, true);
    expect(args.setIsCreatingTicket).toHaveBeenLastCalledWith(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain("/api/protected/tickets");
    expect(window.alert).toHaveBeenCalledWith(
      "Ticket created successfully. Check the ticket board for follow-up.",
    );
  });

  it("simulates email conversation and hydrates the new active chat", async () => {
    const args = createBaseArgs();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ conversation: { id: "conversation-2" } }),
    });

    const { result } = renderHook(() => useInboxSupportActions(args));

    await act(async () => {
      await result.current.handleSimulateEmail({ preventDefault: vi.fn() });
    });

    expect(args.setIsSubmittingEmail).toHaveBeenNthCalledWith(1, true);
    expect(args.setIsSubmittingEmail).toHaveBeenLastCalledWith(false);
    expect(args.setShowEmailModal).toHaveBeenCalledWith(false);
    expect(args.setEmailDraft).toHaveBeenCalledWith({ ...args.defaultEmailDraft });
    expect(args.loadConversations).toHaveBeenCalledTimes(1);
    expect(args.setActiveChat).toHaveBeenCalledWith({ id: "conversation-2" });
    expect(args.setShowDetailsRail).toHaveBeenCalledWith(true);
  });

  it("merges conversations and refreshes the list", async () => {
    const args = createBaseArgs();
    fetch.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useInboxSupportActions(args));

    await act(async () => {
      await result.current.handleMergeConversation("conversation-2");
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain(
      "/api/protected/conversations/conversation-1/merge",
    );
    expect(args.setShowMergeModal).toHaveBeenCalledWith(false);
    expect(args.loadConversations).toHaveBeenCalledTimes(1);
  });
});
