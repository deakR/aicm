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
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Simulate inbound email
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Create a realistic email-origin conversation in the shared inbox
              for demos, testing, and agent training.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500 transition hover:border-gray-300 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Customer name
              </span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Emma Williams"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Customer email
              </span>
              <input
                type="email"
                value={draft.email}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="emma@example.com"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Subject
            </span>
            <input
              type="text"
              value={draft.subject}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, subject: event.target.value }))
              }
              placeholder="Still waiting for password reset email"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Email body
            </span>
            <textarea
              rows="6"
              value={draft.content}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, content: event.target.value }))
              }
              placeholder="Hi team, I requested a password reset twice in the last 15 minutes but nothing has arrived yet..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
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
              className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
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
