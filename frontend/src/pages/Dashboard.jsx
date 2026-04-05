import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import ResizablePanels from "../components/ResizablePanels";

function DailyChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const chartH = 120;
  const barW = Math.max(8, Math.floor(560 / (data.length + 1)));
  const gap = Math.max(2, barW * 0.2);
  const totalW = data.length * (barW + gap) + gap;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalW} ${chartH + 30}`}
        className="w-full"
        style={{
          minWidth: `${Math.max(totalW, 320)}px`,
          maxHeight: "200px",
          color: "var(--app-border)",
        }}
        aria-label="Daily conversation volume chart"
      >
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = chartH - pct * chartH;
          return (
            <line
              key={pct}
              x1={0}
              y1={y}
              x2={totalW}
              y2={y}
              stroke="currentColor"
              strokeWidth={1}
            />
          );
        })}
        {data.map((d, i) => {
          const x = gap + i * (barW + gap);
          const totalH = (d.total / maxVal) * chartH;
          const aiH = (d.ai_answered / maxVal) * chartH;
          const escH = (d.escalated / maxVal) * chartH;
          const otherH = Math.max(0, totalH - aiH - escH);
          const showLabel =
            i === 0 ||
            i === Math.floor(data.length / 2) ||
            i === data.length - 1;
          return (
            <g key={d.date}>
              {/* Other (base) */}
              <rect
                x={x}
                y={chartH - totalH}
                width={barW}
                height={otherH}
                fill="#e5e7eb"
                rx={2}
              />
              {/* Escalated */}
              <rect
                x={x}
                y={chartH - totalH + otherH}
                width={barW}
                height={escH}
                fill="#fbbf24"
                rx={0}
              />
              {/* AI Answered */}
              <rect
                x={x}
                y={chartH - aiH}
                width={barW}
                height={aiH}
                fill="#a855f7"
                rx={0}
              />
              {/* Date label */}
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={chartH + 18}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--app-text-soft)"
                >
                  {d.date.slice(5)} {/* MM-DD */}
                </text>
              )}
              {/* Tooltip via title */}
              <title>
                {d.date}: {d.total} total ({d.ai_answered} AI, {d.escalated}{" "}
                escalated)
              </title>
              {/* Transparent hover rect */}
              <rect
                x={x}
                y={0}
                width={barW}
                height={chartH}
                fill="transparent"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(""); // Empty means 'All Time'
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const formatDuration = (seconds) => {
    if (!seconds || seconds < 60) return `${Math.round(seconds || 0)} sec`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${(seconds / 3600).toFixed(1)} hrs`;
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const url = `${import.meta.env.VITE_API_URL || "http://localhost:8900"}/api/protected/analytics${days ? `?days=${days}` : ""}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setStats(await res.json());
        } else if (res.status === 401) {
          localStorage.removeItem("token");
          navigate("/workspace/login");
        } else {
          setStats({ error: true });
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
        setStats({ error: true });
      }
    };
    fetchStats();
  }, [token, navigate, days]);

  return (
    <div className="app-main-surface flex h-full flex-1 flex-col overflow-hidden">
      <div className="app-page-header z-10 flex items-center justify-between p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Platform Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Overview of your support volume and AI performance.
          </p>
        </div>
        <div className="app-toolbar">
          <button
            onClick={() => setDays("1")}
            className={`app-segment-button ${days === "1" ? "active" : ""}`}
          >
            Today
          </button>
          <button
            onClick={() => setDays("7")}
            className={`app-segment-button ${days === "7" ? "active" : ""}`}
          >
            7 Days
          </button>
          <button
            onClick={() => setDays("30")}
            className={`app-segment-button ${days === "30" ? "active" : ""}`}
          >
            30 Days
          </button>
          <button
            onClick={() => setDays("")}
            className={`app-segment-button ${days === "" ? "active" : ""}`}
          >
            All Time
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {!stats ? (
          <div className="text-center text-gray-500 mt-10">
            Loading analytics...
          </div>
        ) : stats.error ? (
          <div className="text-center text-red-500 mt-10">
            Failed to load analytics dashboard.
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <div className="app-stat-card p-6">
                <p className="text-sm font-medium text-gray-500 mb-1">
                  Total Conversations
                </p>
                <h3 className="text-3xl font-bold text-gray-900">
                  {stats.total_conversations}
                </h3>
              </div>

              <div className="app-stat-card p-6">
                <p className="text-sm font-medium text-gray-500 mb-1">
                  Open Tickets
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-gray-900">
                    {stats.open_tickets}
                  </h3>
                  <span className="text-sm text-gray-400">
                    / {stats.total_tickets} total
                  </span>
                </div>
              </div>

              <div className="app-stat-card p-6">
                <p className="text-sm font-medium text-gray-500 mb-1">
                  Messages Sent
                </p>
                <h3 className="text-3xl font-bold text-gray-900">
                  {stats.human_messages + stats.ai_messages}
                </h3>
                <div className="mt-2 text-xs text-gray-500 flex gap-4">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>{" "}
                    Human: {stats.human_messages}
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>{" "}
                    AI: {stats.ai_messages}
                  </span>
                </div>
              </div>

              <div className="app-stat-card p-6">
                <p className="text-sm font-medium text-gray-500 mb-1">
                  AI Resolution Rate
                </p>
                <h3 className="text-3xl font-bold text-purple-600">
                  {(stats.ai_resolution_rate ?? 0).toFixed(1)}%
                </h3>
                <p className="text-xs text-gray-500 mt-2">
                  Resolved by the AI assistant
                </p>
              </div>

              <div className="app-stat-card p-6">
                <p className="text-sm font-medium text-gray-500 mb-1">
                  Human Escalation Rate
                </p>
                <h3 className="text-3xl font-bold text-amber-600">
                  {(stats.human_escalation_rate ?? 0).toFixed(1)}%
                </h3>
                <p className="text-xs text-gray-500 mt-2">
                  AI-assessed conversations that needed a human handoff
                </p>
              </div>

              <div className="app-stat-card p-6">
                <p className="text-sm font-medium text-gray-500 mb-1">
                  First Human Response
                </p>
                <h3 className="text-3xl font-bold text-gray-900">
                  {formatDuration(stats.average_first_response_seconds)}
                </h3>
                <p className="text-xs text-gray-500 mt-2">
                  Average time to the first non-AI reply
                </p>
              </div>
            </div>

            <ResizablePanels
              storageKey="aicm:dashboard-panels"
              initialSizes={[56, 44]}
              minSizes={[420, 320]}
              className="min-h-0 gap-0"
              stackBelow={1180}
            >
              <div className="app-panel-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Top Conversation Topics
                  </h2>
                  <span className="text-xs uppercase tracking-[0.18em] text-gray-400">
                    Topic clusters (NLP-based)
                  </span>
                </div>
                {stats.top_topics?.length ? (
                  <div className="space-y-3">
                    {stats.top_topics.map((topic, i) => {
                      const colors = [
                        {
                          bg: "color-mix(in srgb, #3b82f6 12%, var(--app-card))",
                          text: "var(--brand-accent-dark)",
                          badge: "color-mix(in srgb, #3b82f6 20%, var(--app-card))",
                        },
                        {
                          bg: "color-mix(in srgb, #a855f7 12%, var(--app-card))",
                          text: "#7c3aed",
                          badge: "color-mix(in srgb, #a855f7 20%, var(--app-card))",
                        },
                        {
                          bg: "color-mix(in srgb, #22c55e 18%, var(--app-card))",
                          text: "color-mix(in srgb, #047857 70%, var(--app-text))",
                          badge: "color-mix(in srgb, #22c55e 28%, var(--app-card))",
                        },
                        {
                          bg: "color-mix(in srgb, #f59e0b 12%, var(--app-card))",
                          text: "#b45309",
                          badge: "color-mix(in srgb, #f59e0b 20%, var(--app-card))",
                        },
                        {
                          bg: "color-mix(in srgb, #ef4444 12%, var(--app-card))",
                          text: "#b91c1c",
                          badge: "color-mix(in srgb, #ef4444 20%, var(--app-card))",
                        },
                        {
                          bg: "var(--app-card-muted)",
                          text: "var(--app-text-muted)",
                          badge: "var(--app-card-muted)",
                        },
                      ];
                      const c = colors[i % colors.length];
                      const maxCount = stats.top_topics[0].count;
                      const pct =
                        maxCount > 0
                          ? Math.round((topic.count / maxCount) * 100)
                          : 0;
                      return (
                        <div
                          key={topic.topic}
                          className="flex items-center justify-between rounded-xl px-4 py-3"
                          style={{ background: c.bg, color: c.text }}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-semibold">
                              {topic.topic}
                            </p>
                            <div
                              className="mt-1.5 h-1.5 w-full rounded-full"
                              style={{ background: "var(--app-card-muted)" }}
                            >
                              <div
                                className="h-1.5 rounded-full bg-current opacity-30 transition-all"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                          <span
                            className="ml-4 rounded-full px-3 py-1 text-xs font-bold"
                            style={{ background: c.badge, color: c.text }}
                          >
                            {topic.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <div className="app-panel-card p-6">
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    Simulated CSAT
                  </p>
                  <h3 className="app-read-receipt text-3xl font-bold">
                    {(stats.csat_score ?? 0).toFixed(1)} / 5
                  </h3>
                  <p className="text-xs text-gray-500 mt-2">
                    Derived from conversation resolution outcomes.
                  </p>
                </div>

                <div className="app-panel-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      AI Outcomes
                    </h2>
                    <span className="text-xs uppercase tracking-[0.18em] text-gray-400">
                      Latest assessment
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{
                        background:
                          "color-mix(in srgb, #a855f7 12%, var(--app-card))",
                      }}
                    >
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: "#7c3aed" }}
                      >
                        Answered
                      </p>
                      <p
                        className="mt-2 text-2xl font-bold"
                        style={{ color: "#6d28d9" }}
                      >
                        {stats.ai_answered_conversations ?? 0}
                      </p>
                    </div>
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{
                        background:
                          "color-mix(in srgb, #f59e0b 12%, var(--app-card))",
                      }}
                    >
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: "#b45309" }}
                      >
                        Escalated
                      </p>
                      <p
                        className="mt-2 text-2xl font-bold"
                        style={{ color: "#92400e" }}
                      >
                        {stats.ai_escalated_conversations ?? 0}
                      </p>
                    </div>
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{
                        background:
                          "color-mix(in srgb, #64748b 12%, var(--app-card))",
                      }}
                    >
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: "var(--app-text-muted)" }}
                      >
                        Unanswered
                      </p>
                      <p
                        className="mt-2 text-2xl font-bold"
                        style={{ color: "var(--app-text)" }}
                      >
                        {stats.ai_unanswered_conversations ?? 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="app-panel-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Team Performance
                    </h2>
                    <span className="text-xs uppercase tracking-[0.18em] text-gray-400">
                      Assigned conversations
                    </span>
                  </div>
                  {stats.team_performance?.length ? (
                    <div className="space-y-3">
                      {stats.team_performance.map((entry) => (
                        <div
                          key={entry.agent}
                          className="flex items-center justify-between rounded-xl px-4 py-3"
                          style={{ background: "var(--app-card-muted)" }}
                        >
                          <span
                            className="font-medium"
                            style={{ color: "var(--app-text)" }}
                          >
                            {entry.agent}
                          </span>
                          <span className="app-status-pill app-status-pill-open rounded-full px-3 py-1 text-xs font-semibold">
                            {entry.conversations} handled
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </ResizablePanels>

            {/* Daily Metrics Chart */}
            {stats.daily_metrics?.length > 0 && (
              <div className="app-panel-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Daily Conversation Volume
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      {(stats.time_scope_label || "All time") === "All time"
                        ? "All-time conversation volume by day"
                        : `${stats.time_scope_label} conversation volume by day`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-500"></span>
                      AI Answered
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400"></span>
                      Escalated
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-200"></span>
                      Other
                    </span>
                  </div>
                </div>
                <DailyChart data={stats.daily_metrics} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
