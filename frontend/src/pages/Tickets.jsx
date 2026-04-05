import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8900';

const emptyTicket = {
  title: '',
  description: '',
  priority: 'medium',
  customer_id: '',
};

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState({ status: '', priority: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingManualTicket, setIsCreatingManualTicket] = useState(false);
  const [newTicket, setNewTicket] = useState(emptyTicket);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [commentsByTicket, setCommentsByTicket] = useState({});
  const [notificationsByTicket, setNotificationsByTicket] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [loadingActivity, setLoadingActivity] = useState({});

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const activeFilters = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch(`${API_URL}/api/protected/users?role=customer`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setCustomers(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch customers', err);
      }
    };

    if (token) {
      fetchCustomers();
    }
  }, [token]);

  useEffect(() => {
    const fetchTickets = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.status) params.set('status', filters.status);
        if (filters.priority) params.set('priority', filters.priority);

        const query = params.toString();
        const res = await fetch(`${API_URL}/api/protected/tickets${query ? `?${query}` : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          setTickets(await res.json());
        } else if (res.status === 401) {
          localStorage.removeItem('token');
          navigate('/workspace/login');
        }
      } catch (err) {
        console.error('Failed to fetch tickets', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchTickets();
    }
  }, [filters, navigate, token]);

  const loadTicketActivity = async (ticketId) => {
    setLoadingActivity((prev) => ({ ...prev, [ticketId]: true }));
    try {
      const [commentsRes, notificationsRes] = await Promise.all([
        fetch(`${API_URL}/api/protected/tickets/${ticketId}/comments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/protected/tickets/${ticketId}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (commentsRes.ok) {
        const comments = await commentsRes.json();
        setCommentsByTicket((prev) => ({ ...prev, [ticketId]: comments }));
      }
      if (notificationsRes.ok) {
        const notifications = await notificationsRes.json();
        setNotificationsByTicket((prev) => ({ ...prev, [ticketId]: notifications }));
      }
    } catch (err) {
      console.error('Failed to fetch ticket activity', err);
    } finally {
      setLoadingActivity((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  const handleUpdateTicket = async (ticketId, payload) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/protected/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updatedTicket = await res.json();
        setTickets((prev) =>
          prev.map((ticket) => (ticket.id === ticketId ? updatedTicket : ticket))
        );
        if (expandedTicketId === ticketId) {
          loadTicketActivity(ticketId);
        }
      }
    } catch (err) {
      console.error('Failed to update ticket', err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTicketActivity = (ticketId) => {
    setExpandedTicketId((prev) => {
      const next = prev === ticketId ? null : ticketId;
      if (next && (!commentsByTicket[ticketId] || !notificationsByTicket[ticketId])) {
        loadTicketActivity(ticketId);
      }
      return next;
    });
  };

  const handleAddComment = async (ticketId) => {
    const content = (commentDrafts[ticketId] || '').trim();
    if (!content) return;

    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/protected/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        setCommentDrafts((prev) => ({ ...prev, [ticketId]: '' }));
        await loadTicketActivity(ticketId);
      }
    } catch (err) {
      console.error('Failed to add ticket comment', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateManualTicket = async (event) => {
    event.preventDefault();
    if (!newTicket.title || !newTicket.description || !newTicket.customer_id) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/protected/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTicket),
      });

      if (res.ok) {
        const created = await res.json();
        setTickets((prev) => [created, ...prev]);
        setIsCreatingManualTicket(false);
        setNewTicket(emptyTicket);
      }
    } catch (err) {
      console.error('Failed to create ticket', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'app-status-pill app-status-pill-danger';
      case 'high':
        return 'app-status-pill app-status-pill-pending';
      case 'medium':
        return 'app-status-pill app-status-pill-info';
      case 'low':
        return 'app-status-pill app-status-pill-default';
      default:
        return 'app-status-pill app-status-pill-default';
    }
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case 'resolved':
        return 'app-status-pill app-status-pill-open';
      case 'in_progress':
        return 'app-status-pill app-status-pill-pending';
      case 'closed':
        return 'app-status-pill app-status-pill-resolved';
      default:
        return 'app-status-pill app-status-pill-info';
    }
  };

  return (
    <div className="app-main-surface flex h-full flex-1 flex-col overflow-hidden">
      <div className="app-page-header px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ticket Board</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track priority, move work forward, and create manual tickets when chats need structured follow-up.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="app-toolbar flex flex-wrap gap-3 rounded-2xl px-4 py-3">
              <div>
                <label className="app-section-kicker mb-1 block text-xs">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, status: event.target.value }))
                  }
                  className="app-input rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="app-section-kicker mb-1 block text-xs">
                  Priority
                </label>
                <select
                  value={filters.priority}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, priority: event.target.value }))
                  }
                  className="app-input rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">All priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setFilters({ status: '', priority: '' })}
                  className="app-secondary-button square px-3 py-2 text-sm"
                >
                  Clear filters
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingManualTicket(true)}
              className="app-primary-button px-4 py-3 text-sm"
            >
              Create Manual Ticket
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <div className="app-stat-card p-5">
            <p className="text-sm text-gray-500">Visible tickets</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{tickets.length}</p>
          </div>
          <div className="app-stat-card p-5">
            <p className="text-sm text-gray-500">Active filters</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{activeFilters}</p>
          </div>
          <div className="app-stat-card p-5">
            <p className="text-sm text-gray-500">Manual queue</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {tickets.filter((ticket) => !ticket.conversation_id).length}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-12 text-center text-gray-500">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="app-empty-state mt-12 p-12 text-center text-gray-500">
            No tickets match the current filters yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="app-panel-card p-5 transition hover:shadow-md"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">{ticket.title}</h2>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusStyles(ticket.status)}`}
                      >
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getPriorityStyles(ticket.priority)}`}
                      >
                        {ticket.priority}
                      </span>
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
                      {ticket.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-5 text-sm text-gray-500">
                      <span>Customer: {ticket.customer_name || 'Unknown customer'}</span>
                      <span>Email: {ticket.customer_email || 'Unknown email'}</span>
                      <span>Assignee: {ticket.assignee_name || 'Unassigned'}</span>
                      <span>
                        Linked chat: {ticket.conversation_id ? 'Yes' : 'Manual only'}
                      </span>
                      <span>
                        Created {new Date(ticket.created_at).toLocaleString()}
                      </span>
                      {ticket.last_customer_notification && (
                        <span>
                          Customer notified {new Date(ticket.last_customer_notification).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:w-[22rem]">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                        Status
                      </label>
                      <select
                        value={ticket.status}
                        onChange={(event) =>
                          handleUpdateTicket(ticket.id, { status: event.target.value })
                        }
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                        Priority
                      </label>
                      <select
                        value={ticket.priority}
                        onChange={(event) =>
                          handleUpdateTicket(ticket.id, { priority: event.target.value })
                        }
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => toggleTicketActivity(ticket.id)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-100"
                      >
                        {expandedTicketId === ticket.id ? 'Hide activity' : 'View activity'}
                      </button>
                    </div>
                  </div>
                </div>

                {expandedTicketId === ticket.id && (
                  <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Internal comments</h3>
                        <span className="text-xs uppercase tracking-[0.18em] text-gray-400">
                          {commentsByTicket[ticket.id]?.length || 0} comments
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {loadingActivity[ticket.id] ? (
                          <div className="text-sm text-gray-500">Loading ticket activity...</div>
                        ) : commentsByTicket[ticket.id]?.length ? (
                          commentsByTicket[ticket.id].map((comment) => (
                            <div key={comment.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-gray-900">{comment.author_name || 'Support agent'}</p>
                                <p className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</p>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-gray-600">{comment.content}</p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                            No internal comments yet.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                          Add internal comment
                        </label>
                        <textarea
                          rows="3"
                          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                          value={commentDrafts[ticket.id] || ''}
                          onChange={(event) =>
                            setCommentDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))
                          }
                          placeholder="Leave context for the next teammate..."
                        />
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleAddComment(ticket.id)}
                            disabled={isSaving || !(commentDrafts[ticket.id] || '').trim()}
                            className={`app-primary-button rounded-lg px-4 py-2 text-sm font-semibold ${
                              isSaving || !(commentDrafts[ticket.id] || '').trim()
                                ? 'cursor-not-allowed opacity-50'
                                : ''
                            }`}
                          >
                            Add comment
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Customer notifications</h3>
                        <span className="text-xs uppercase tracking-[0.18em] text-gray-400">
                          Simulated in-app updates
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {loadingActivity[ticket.id] ? (
                          <div className="text-sm text-gray-500">Loading customer notifications...</div>
                        ) : notificationsByTicket[ticket.id]?.length ? (
                          notificationsByTicket[ticket.id].map((notification) => (
                            <div key={notification.id} className="app-note-card rounded-xl p-3 shadow-sm">
                              <p className="text-sm font-medium text-gray-800">{notification.message}</p>
                              <p className="app-note-meta mt-2 text-xs">
                                Sent {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                            No customer notifications have been generated yet. Status updates to in-progress, resolved, or closed will appear here automatically.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isCreatingManualTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Create Manual Ticket</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Use this for issues that did not start from an existing conversation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingManualTicket(false)}
                className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close ticket modal"
              >
                x
              </button>
            </div>

            <form onSubmit={handleCreateManualTicket} className="space-y-5 px-6 py-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Customer</label>
                <select
                  required
                  className="w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-blue-500"
                  value={newTicket.customer_id}
                  onChange={(event) =>
                    setNewTicket((prev) => ({ ...prev, customer_id: event.target.value }))
                  }
                >
                  <option value="">Select a customer...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_12rem]">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
                  <input
                    required
                    type="text"
                    className="w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-blue-500"
                    value={newTicket.title}
                    onChange={(event) =>
                      setNewTicket((prev) => ({ ...prev, title: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Priority</label>
                  <select
                    className="w-full rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-blue-500"
                    value={newTicket.priority}
                    onChange={(event) =>
                      setNewTicket((prev) => ({ ...prev, priority: event.target.value }))
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  required
                  rows="4"
                  className="w-full resize-none rounded-xl border border-gray-300 px-3 py-3 outline-none focus:border-blue-500"
                  value={newTicket.description}
                  onChange={(event) =>
                    setNewTicket((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreatingManualTicket(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`app-primary-button rounded-xl px-5 py-2.5 text-sm font-semibold ${
                    isSaving ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                >
                  {isSaving ? 'Saving...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
