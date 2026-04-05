import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useInboxPeople from "./useInboxPeople";

describe("useInboxPeople", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns empty people lists when token is missing", () => {
    const { result } = renderHook(() =>
      useInboxPeople({
        apiUrl: "http://localhost:8900",
        token: "",
      }),
    );

    expect(result.current.agents).toEqual([]);
    expect(result.current.customers).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads agents and customers when token exists", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "agent-1", name: "Avery" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "customer-1", name: "Taylor" }],
      });

    const { result } = renderHook(() =>
      useInboxPeople({
        apiUrl: "http://localhost:8900",
        token: "token-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.agents).toEqual([{ id: "agent-1", name: "Avery" }]);
    });
    await waitFor(() => {
      expect(result.current.customers).toEqual([
        { id: "customer-1", name: "Taylor" },
      ]);
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toContain("role=agent");
    expect(fetch.mock.calls[1][0]).toContain("role=customer");
  });
});
