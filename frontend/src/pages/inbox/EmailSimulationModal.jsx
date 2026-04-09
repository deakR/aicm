export default function EmailSimulationModal({
  open,
  draft,
  setDraft,
  onSubmit,
  onClose,
  isSubmitting,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div
        className="w-full max-w-xl rounded-2xl p-6 shadow-2xl"
        style={{
          background: "var(--app-card)",
          border: "1px solid var(--app-border)",
          color: "var(--app-text)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
              Simulate inbound email
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--app-text-muted)" }}>
              Create a realistic email-origin conversation in the shared inbox
              for demos, testing, and agent training.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-3 py-1 text-xs font-semibold transition"
            style={{
              borderColor: "var(--app-border)",
              color: "var(--app-text-muted)",
              background: "var(--app-card)",
            }}
          >
            Close
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--app-text-soft)" }}>
                Customer name
              </span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Emma Williams"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--app-border)", background: "var(--app-card-muted)", color: "var(--app-text)" }}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--app-text-soft)" }}>
                Customer email
              </span>
              <input
                type="email"
                value={draft.email}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="emma@example.com"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--app-border)", background: "var(--app-card-muted)", color: "var(--app-text)" }}
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--app-text-soft)" }}>
              Subject
            </span>
            <input
              type="text"
              value={draft.subject}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, subject: event.target.value }))
              }
              placeholder="Still waiting for password reset email"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--app-border)", background: "var(--app-card-muted)", color: "var(--app-text)" }}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--app-text-soft)" }}>
              Email body
            </span>
            <textarea
              rows="6"
              value={draft.content}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, content: event.target.value }))
              }
              placeholder="Hi team, I requested a password reset twice in the last 15 minutes but nothing has arrived yet..."
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--app-border)", background: "var(--app-card-muted)", color: "var(--app-text)" }}
              required
            />
          </label>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>
              This creates an <strong>email-source</strong> conversation and can
              trigger the same AI + workflow automations as a live widget
              thread.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ color: "var(--app-text-muted)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="app-success-button rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating email..." : "Create email thread"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
