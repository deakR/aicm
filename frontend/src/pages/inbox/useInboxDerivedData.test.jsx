import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useInboxDerivedData from "./useInboxDerivedData";

describe("useInboxDerivedData", () => {
  it("returns undefined values when no active chat is selected", () => {
    const { result } = renderHook(() =>
      useInboxDerivedData({
        customers: [{ id: "customer-1", name: "Taylor" }],
        activeChat: null,
        messages: [],
      }),
    );

    expect(result.current.activeCustomer).toBeUndefined();
    expect(result.current.lastOutboundMessage).toBeUndefined();
  });

  it("derives active customer and last outbound non-internal message", () => {
    const { result } = renderHook(() =>
      useInboxDerivedData({
        customers: [{ id: "customer-1", name: "Taylor" }],
        activeChat: { id: "conversation-1", customer_id: "customer-1" },
        messages: [
          {
            id: "m-1",
            sender_id: "customer-1",
            is_internal: false,
            content: "Hello",
          },
          {
            id: "m-2",
            sender_id: "agent-1",
            is_internal: true,
            content: "Internal note",
          },
          {
            id: "m-3",
            sender_id: "agent-1",
            is_internal: false,
            content: "Public reply",
          },
        ],
      }),
    );

    expect(result.current.activeCustomer).toEqual({
      id: "customer-1",
      name: "Taylor",
    });
    expect(result.current.lastOutboundMessage?.id).toBe("m-3");
  });
});
