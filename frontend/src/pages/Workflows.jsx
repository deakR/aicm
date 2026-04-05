import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ResizablePanels from "../components/ResizablePanels";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8900";

const CONDITION_TYPES = [
  { value: "message_contains", label: "Message contains keyword" },
  { value: "new_conversation", label: "New conversation started" },
  { value: "time_elapsed", label: "Time elapsed (no reply)" },
  { value: "customer_attribute", label: "Customer attribute" },
];

const OPERATOR_TYPES = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
];

function WorkflowFlowCard({ wf, agents, onToggle }) {
  const conditions =
    wf.conditions && wf.conditions.length > 0 ? wf.conditions : null;
  const logic = wf.condition_logic || "and";

  const getConditionLabel = (cond) => {
    if (!cond) return "";
    if (cond.type === "message_contains") return `"${cond.value}"`;
    if (cond.type === "new_conversation") return "New conversation";
    if (cond.type === "time_elapsed") return `No reply in ${cond.value}h`;
    if (cond.type === "customer_attribute")
      return `${cond.field} ${cond.operator} "${cond.value}"`;
    return cond.type;
  };

  const getTriggerLabel = () => {
    if (conditions) {
      if (conditions.length === 1) {
        return getConditionLabel(conditions[0]);
      }
      return `${conditions.length} conditions (${logic.toUpperCase()})`;
    }
    if (wf.trigger_type === "message_contains")
      return `"${wf.trigger_condition}"`;
    if (wf.trigger_type === "new_conversation")
      return "New conversation started";
    if (wf.trigger_type === "time_elapsed")
      return `No reply in ${wf.trigger_condition}h`;
    return wf.trigger_type;
  };

  const getActionLabel = () => {
    if (wf.action_type === "auto_reply")
      return (
        wf.action_payload?.slice(0, 50) +
        (wf.action_payload?.length > 50 ? "…" : "")
      );
    if (wf.action_type === "assign_agent") {
      const agent = agents.find((a) => a.id === wf.action_payload);
      return `Assign → ${agent?.name || "Agent"}`;
    }
    if (wf.action_type === "add_tag") return `Tag: ${wf.action_payload}`;
    if (wf.action_type === "change_status")
      return `Set status: ${wf.action_payload}`;
    if (wf.action_type === "escalate_to_human") return "Escalate to human";
    return wf.action_type;
  };

  const getTriggerTypeLabel = () => {
    if (
      wf.trigger_type === "message_contains" ||
      (conditions && conditions[0]?.type === "message_contains")
    )
      return "MESSAGE";
    if (wf.trigger_type === "new_conversation") return "ON START";
    if (wf.trigger_type === "time_elapsed") return "TIMED";
    if (wf.trigger_type === "customer_attribute") return "ATTRIBUTE";
    return "TRIGGER";
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border p-5 transition ${wf.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 text-sm">{wf.name}</h3>
          <span
            className={`app-status-pill text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${wf.is_active ? "app-status-pill-open" : "app-status-pill-default"}`}
          >
            {wf.is_active ? "Active" : "Off"}
          </span>
          {conditions && conditions.length > 1 && (
            <span
              className={`app-status-pill text-[10px] font-bold px-2 py-0.5 rounded-full ${logic === "or" ? "app-status-pill-pending" : "app-status-pill-info"}`}
            >
              {logic.toUpperCase()} {conditions.length}
            </span>
          )}
        </div>
        <button
          onClick={() => onToggle(wf.id, wf.is_active)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${wf.is_active ? "text-red-600 border-red-200 hover:bg-red-50" : "app-success-button border-0"}`}
        >
          {wf.is_active ? "Disable" : "Enable"}
        </button>
      </div>

      {/* Visual flow */}
      <div className="flex items-stretch gap-0">
        {/* Trigger node */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 h-full">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-500 mb-1">
              {getTriggerTypeLabel()}
            </p>
            <p className="text-xs text-blue-900 font-medium leading-snug break-words">
              {getTriggerLabel()}
            </p>
            {conditions && conditions.length > 1 && (
              <div className="mt-2 space-y-1">
                {conditions.map((c, i) => (
                  <p key={i} className="text-[10px] text-blue-700">
                    <span className="font-bold">
                      {i === 0 ? "IF" : logic.toUpperCase()}
                    </span>{" "}
                    {getConditionLabel(c)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center px-2 flex-none">
          <svg width="32" height="20" viewBox="0 0 32 20">
            <line
              x1="0"
              y1="10"
              x2="24"
              y2="10"
              stroke="#9ca3af"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            <polyline
              points="20,5 28,10 20,15"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Action node */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-3 h-full">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-500 mb-1">
              {wf.action_type === "auto_reply"
                ? "AUTO-REPLY"
                : wf.action_type === "assign_agent"
                  ? "ASSIGN"
                  : wf.action_type === "add_tag"
                    ? "TAG"
                    : wf.action_type === "change_status"
                      ? "STATUS"
                      : wf.action_type === "escalate_to_human"
                        ? "ESCALATE"
                        : "ACTION"}
            </p>
            <p className="text-xs text-purple-900 font-medium leading-snug break-words">
              {getActionLabel()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [logs, setLogs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'flow'

  const [name, setName] = useState("");
  const [conditions, setConditions] = useState([
    { type: "message_contains", field: "", operator: "contains", value: "" },
  ]);
  const [conditionLogic, setConditionLogic] = useState("and");
  const [actionType, setActionType] = useState("auto_reply");
  const [actionPayload, setActionPayload] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/protected/workflows/logs?limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error("Failed to fetch workflow logs", err);
    }
  }, [token]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [wfRes, agentRes] = await Promise.all([
          fetch(`${API_URL}/api/protected/workflows`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/protected/users?role=agent`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (wfRes.status === 401) {
          localStorage.removeItem("token");
          navigate("/workspace/login");
          return;
        }
        if (wfRes.ok) setWorkflows(await wfRes.json());
        if (agentRes.ok) setAgents(await agentRes.json());
      } catch (err) {
        console.error("Failed to fetch data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
    void fetchLogs();
  }, [fetchLogs, navigate, token]);

  // ── Condition management ───────────────────────────────────────────────────

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      { type: "message_contains", field: "", operator: "contains", value: "" },
    ]);
  };

  const removeCondition = (index) => {
    if (conditions.length === 1) return;
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCondition = (index, key, value) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    );
  };

  // ── Action helpers ─────────────────────────────────────────────────────────

  const handleActionTypeChange = (val) => {
    setActionType(val);
    setActionPayload("");
    if (val === "change_status") setActionPayload("open");
    if (val === "escalate_to_human") setActionPayload("escalate");
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleCreateWorkflow = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const primaryCondition = conditions[0];
    const isTimeElapsed = primaryCondition.type === "time_elapsed";
    const isNewConversation = primaryCondition.type === "new_conversation";
    const isCustomerAttr = primaryCondition.type === "customer_attribute";

    // Legacy single-condition fields (for backward compat)
    const triggerType =
      conditions.length === 1 ? primaryCondition.type : "message_contains";
    let triggerCondition = "*";
    if (!isNewConversation && !isTimeElapsed) {
      triggerCondition = primaryCondition.value || "*";
    } else if (isTimeElapsed) {
      triggerCondition = primaryCondition.value || "2";
    }

    const payload = {
      name,
      trigger_type: triggerType,
      trigger_condition: triggerCondition,
      conditions:
        conditions.length > 1 || isCustomerAttr ? conditions : undefined,
      condition_logic: conditions.length > 1 ? conditionLogic : "and",
      action_type: actionType,
      action_payload:
        actionType === "escalate_to_human" ? "escalate" : actionPayload,
      is_active: true,
    };

    try {
      const res = await fetch(`${API_URL}/api/protected/workflows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const newWorkflow = await res.json();
        setWorkflows((prev) => [newWorkflow, ...prev]);
        setIsCreating(false);
        setName("");
        setConditions([
          {
            type: "message_contains",
            field: "",
            operator: "contains",
            value: "",
          },
        ]);
        setConditionLogic("and");
        setActionPayload("");
        setActionType("auto_reply");
        void fetchLogs();
      }
    } catch (err) {
      console.error("Failed to create workflow", err);
    }
  };

  const handleToggleWorkflow = async (id, current) => {
    try {
      const res = await fetch(`${API_URL}/api/protected/workflows/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !current }),
      });
      if (res.ok)
        setWorkflows((prev) =>
          prev.map((wf) =>
            wf.id === id ? { ...wf, is_active: !current } : wf,
          ),
        );
    } catch (err) {
      console.error("Failed to toggle workflow", err);
    }
  };

  // ── Display helpers ────────────────────────────────────────────────────────

  const formatSingleCondition = (cond) => {
    if (!cond) return "";
    if (cond.type === "message_contains")
      return `Message contains "${cond.value}"`;
    if (cond.type === "new_conversation") return "New conversation";
    if (cond.type === "time_elapsed") return `No reply in ${cond.value}h`;
    if (cond.type === "customer_attribute")
      return `${cond.field} ${cond.operator} "${cond.value}"`;
    return cond.type;
  };

  const formatTrigger = (wf) => {
    if (wf.conditions && wf.conditions.length > 1) {
      const logic = wf.condition_logic === "or" ? " OR " : " AND ";
      return wf.conditions.map((c) => formatSingleCondition(c)).join(logic);
    }
    // Legacy single-condition display
    if (wf.trigger_type === "message_contains")
      return `Message contains "${wf.trigger_condition}"`;
    if (wf.trigger_type === "new_conversation")
      return "New conversation started";
    if (wf.trigger_type === "time_elapsed")
      return `No reply in ${wf.trigger_condition}h`;
    if (wf.trigger_type === "customer_attribute")
      return "Customer attribute check";
    return wf.trigger_type;
  };

  const formatAction = (type, payload) => {
    if (type === "auto_reply") return `Auto-reply: "${payload}"`;
    if (type === "assign_agent") {
      const agent = agents.find((a) => a.id === payload);
      return `Assign to: ${agent?.name || payload}`;
    }
    if (type === "add_tag") return `Add tag: ${payload}`;
    if (type === "change_status") return `Change status → ${payload}`;
    if (type === "escalate_to_human")
      return "Escalate to human (add needs-human tag)";
    return type;
  };

  const actionNeedsTextInput = ["auto_reply", "add_tag"].includes(actionType);
  const actionNeedsAgentSelect = actionType === "assign_agent";
  const actionNeedsStatusSelect = actionType === "change_status";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAFA] h-full overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Automation Workflows
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Build rules to automate your support tasks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${viewMode === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              ☰ List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("flow")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${viewMode === "flow" ? "bg-white shadow-sm text-purple-700" : "text-gray-500 hover:text-gray-700"}`}
            >
              ⬡ Flow
            </button>
          </div>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="app-primary-button px-4 py-2 text-sm font-medium rounded-md"
          >
            {isCreating ? "Cancel" : "+ New Rule"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {/* ── Create form ──────────────────────────────────────────────────── */}
        {isCreating && (
          <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Create Automation Rule
            </h2>
            <form onSubmit={handleCreateWorkflow} className="space-y-4">
              {/* Rule name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Greet new visitors"
                  className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ── TRIGGER / CONDITIONS ─────────────────────────────────── */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">
                      1. When this happens
                    </h3>
                    {conditions.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Logic:</span>
                        <select
                          className="text-xs p-1 border rounded bg-white"
                          value={conditionLogic}
                          onChange={(e) => setConditionLogic(e.target.value)}
                        >
                          <option value="and">ALL conditions (AND)</option>
                          <option value="or">ANY condition (OR)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {conditions.map((cond, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      {conditions.length > 1 && (
                        <div className="mt-2 w-8 text-xs text-center font-bold text-gray-400 shrink-0">
                          {idx === 0
                            ? "IF"
                            : conditionLogic === "and"
                              ? "AND"
                              : "OR"}
                        </div>
                      )}

                      <div className="flex-1 space-y-2 bg-white border border-gray-200 rounded-lg p-3">
                        {/* Condition type selector */}
                        <select
                          className="w-full p-2 border rounded-md outline-none bg-white text-sm"
                          value={cond.type}
                          onChange={(e) =>
                            updateCondition(idx, "type", e.target.value)
                          }
                        >
                          {CONDITION_TYPES.map((ct) => (
                            <option key={ct.value} value={ct.value}>
                              {ct.label}
                            </option>
                          ))}
                        </select>

                        {/* message_contains */}
                        {cond.type === "message_contains" && (
                          <input
                            type="text"
                            placeholder="Keyword (e.g., pricing, refund)"
                            className="w-full p-2 border rounded-md outline-none text-sm"
                            value={cond.value}
                            onChange={(e) =>
                              updateCondition(idx, "value", e.target.value)
                            }
                          />
                        )}

                        {/* time_elapsed */}
                        {cond.type === "time_elapsed" && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="168"
                              placeholder="2"
                              className="w-24 p-2 border rounded-md outline-none text-sm"
                              value={cond.value || ""}
                              onChange={(e) =>
                                updateCondition(idx, "value", e.target.value)
                              }
                            />
                            <span className="text-sm text-gray-500">
                              hours without agent reply
                            </span>
                          </div>
                        )}

                        {/* customer_attribute */}
                        {cond.type === "customer_attribute" && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Attribute name (e.g., plan)"
                              className="w-full p-2 border rounded-md outline-none text-sm"
                              value={cond.field || ""}
                              onChange={(e) =>
                                updateCondition(idx, "field", e.target.value)
                              }
                            />
                            <div className="flex gap-2">
                              <select
                                className="p-2 border rounded-md outline-none bg-white text-sm"
                                value={cond.operator || "equals"}
                                onChange={(e) =>
                                  updateCondition(
                                    idx,
                                    "operator",
                                    e.target.value,
                                  )
                                }
                              >
                                {OPERATOR_TYPES.map((op) => (
                                  <option key={op.value} value={op.value}>
                                    {op.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Value (e.g., enterprise)"
                                className="flex-1 p-2 border rounded-md outline-none text-sm"
                                value={cond.value}
                                onChange={(e) =>
                                  updateCondition(idx, "value", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        )}

                        {/* new_conversation */}
                        {cond.type === "new_conversation" && (
                          <p className="text-xs text-gray-500 italic">
                            Fires when a customer opens a new chat session.
                          </p>
                        )}
                      </div>

                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCondition(idx)}
                          className="mt-2 p-1 text-red-400 hover:text-red-600 text-sm shrink-0"
                          title="Remove condition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addCondition}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                  >
                    + Add another condition
                  </button>
                </div>

                {/* ── ACTION ──────────────────────────────────────────────── */}
                <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg space-y-3">
                  <h3 className="font-semibold text-purple-900">2. Do this</h3>
                  <select
                    className="w-full p-2 border rounded-md outline-none bg-white"
                    value={actionType}
                    onChange={(e) => handleActionTypeChange(e.target.value)}
                  >
                    <option value="auto_reply">Send Auto-Reply</option>
                    <option value="assign_agent">Assign to Agent</option>
                    <option value="add_tag">Add Tag</option>
                    <option value="change_status">
                      Change Conversation Status
                    </option>
                    <option value="escalate_to_human">Escalate to Human</option>
                  </select>

                  {actionNeedsTextInput && (
                    <input
                      type="text"
                      required
                      placeholder={
                        actionType === "auto_reply"
                          ? "Enter reply message..."
                          : "Tag name (e.g., billing)"
                      }
                      className="w-full p-2 border rounded-md outline-none"
                      value={actionPayload}
                      onChange={(e) => setActionPayload(e.target.value)}
                    />
                  )}

                  {actionNeedsAgentSelect && (
                    <select
                      className="w-full p-2 border rounded-md outline-none bg-white"
                      value={actionPayload}
                      onChange={(e) => setActionPayload(e.target.value)}
                      required
                    >
                      <option value="">Select agent...</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {actionNeedsStatusSelect && (
                    <select
                      className="w-full p-2 border rounded-md outline-none bg-white"
                      value={actionPayload}
                      onChange={(e) => setActionPayload(e.target.value)}
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="snoozed">Snoozed</option>
                    </select>
                  )}

                  {actionType === "escalate_to_human" && (
                    <p className="text-xs text-purple-700 italic">
                      Marks conversation as open and adds the{" "}
                      <strong>needs-human</strong> tag.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="app-success-button px-6 py-2 font-medium rounded-lg"
                >
                  Save &amp; Activate Rule
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Workflow list + logs ──────────────────────────────────────────── */}
        {isLoading ? (
          <div className="text-center text-gray-500 mt-10">
            Loading workflows...
          </div>
        ) : (
          <ResizablePanels
            storageKey="aicm:workflow-panels"
            initialSizes={[70, 30]}
            minSizes={[520, 280]}
            className="min-h-0 gap-0"
            stackBelow={1180}
          >
            {/* Left: workflow cards */}
            <div className="space-y-4">
              {workflows.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">
                  No automation rules configured yet.
                </div>
              ) : viewMode === "flow" ? (
                <div className="grid gap-5 grid-cols-1 xl:grid-cols-2">
                  {workflows.map((wf) => (
                    <WorkflowFlowCard
                      key={wf.id}
                      wf={wf}
                      agents={agents}
                      onToggle={handleToggleWorkflow}
                    />
                  ))}
                </div>
              ) : (
                workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between gap-6"
                  >
                    <div className="min-w-0">
                      {/* Name + status badge */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-bold text-gray-900">{wf.name}</h3>
                        <span
                          className={`app-status-pill text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                            wf.is_active
                              ? "app-status-pill-open"
                              : "app-status-pill-default"
                          }`}
                        >
                          {wf.is_active ? "Active" : "Disabled"}
                        </span>
                        {/* Multi-condition badge */}
                        {wf.conditions && wf.conditions.length > 1 && (
                          <span
                            className={`app-status-pill text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                              wf.condition_logic === "or"
                                ? "app-status-pill-pending"
                                : "app-status-pill-info"
                            }`}
                          >
                            {wf.condition_logic?.toUpperCase()}{" "}
                            {wf.conditions.length}
                          </span>
                        )}
                      </div>

                      {/* IF → THEN row */}
                      <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-semibold text-gray-500 shrink-0">
                            IF
                          </span>
                          <span className="bg-gray-100 px-2 py-1 rounded truncate max-w-xs">
                            {formatTrigger(wf)}
                          </span>
                        </div>
                        <span className="text-gray-300 shrink-0">→</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-semibold text-purple-600 shrink-0">
                            THEN
                          </span>
                          <span className="bg-purple-50 text-purple-800 border border-purple-100 px-2 py-1 rounded truncate max-w-xs">
                            {formatAction(wf.action_type, wf.action_payload)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleWorkflow(wf.id, wf.is_active)}
                      className={`flex-none px-4 py-2 text-sm font-semibold rounded-lg transition-all border ${
                        wf.is_active
                          ? "bg-white text-red-600 border-red-200 hover:bg-red-50"
                          : "app-success-button border-0 shadow-sm"
                      }`}
                    >
                      {wf.is_active ? "Disable Rule" : "Enable Rule"}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Right: recent logs */}
            <div className="h-fit rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Recent Runs
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Last 10 workflow triggers
                  </p>
                </div>
              </div>
              {logs.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No workflow executions yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl bg-gray-50 px-4 py-3"
                    >
                      <div className="text-sm font-semibold text-gray-900">
                        {log.workflow_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 break-all">
                        Conversation {log.conversation_id}
                      </div>
                      <div className="text-xs uppercase tracking-[0.16em] text-purple-500 mt-2">
                        {new Date(log.executed_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ResizablePanels>
        )}
      </div>
    </div>
  );
}
