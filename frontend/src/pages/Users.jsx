import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearStoredToken } from '../auth';
import ResizablePanels from '../components/ResizablePanels';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8900';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'agent',
};

export default function Users() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/protected/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          setUsers(await res.json());
          setNotice('');
        } else if (res.status === 401) {
          clearStoredToken();
          navigate('/workspace/login');
        } else if (res.status === 403) {
          setNotice('Only admins can manage user accounts.');
        } else {
          setNotice('Failed to load users.');
        }
      } catch (error) {
        console.error('Failed to fetch users', error);
        setNotice('Failed to load users.');
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchUsers();
    }
  }, [navigate, token]);

  const filteredUsers = users.filter((user) => (roleFilter ? user.role === roleFilter : true));
  const adminCount = users.filter((user) => user.role === 'admin').length;
  const agentCount = users.filter((user) => user.role === 'agent').length;
  const customerCount = users.filter((user) => user.role === 'customer').length;

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice('');

    try {
      const res = await fetch(`${API_URL}/api/protected/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setForm(emptyForm);
        setNotice(`Created ${form.role} account for ${form.email}. They can now sign in with the password you set.`);

        const usersRes = await fetch(`${API_URL}/api/protected/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (usersRes.ok) {
          setUsers(await usersRes.json());
        }
      } else if (res.status === 401) {
        clearStoredToken();
        navigate('/workspace/login');
      } else {
        const text = await res.text();
        setNotice(text || 'Failed to create user.');
      }
    } catch (error) {
      console.error('Failed to create user', error);
      setNotice('Failed to create user.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app-page-shell">
      <div className="app-page-header px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create new admin and agent accounts, review current users, and keep role access understandable for demos.
        </p>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {notice && (
          <div className="app-accent-card mb-6 px-4 py-3 text-sm">
            {notice}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="app-stat-card p-5">
            <p className="app-section-kicker">Admins</p>
            <div className="mt-3 text-3xl font-bold text-gray-900">{adminCount}</div>
            <p className="mt-2 text-sm text-gray-500">Admins can manage users, AI settings, and the internal workspace.</p>
          </div>
          <div className="app-stat-card p-5">
            <p className="app-section-kicker">Agents</p>
            <div className="mt-3 text-3xl font-bold text-gray-900">{agentCount}</div>
            <p className="mt-2 text-sm text-gray-500">Agents handle inbox, tickets, knowledge, workflows, and day-to-day support.</p>
          </div>
          <div className="app-stat-card p-5">
            <p className="app-section-kicker">Customers</p>
            <div className="mt-3 text-3xl font-bold text-gray-900">{customerCount}</div>
            <p className="mt-2 text-sm text-gray-500">Customers create their own account through the public register flow before they can chat.</p>
          </div>
        </div>

        <ResizablePanels
          storageKey="aicm:user-panels"
          initialSizes={[70, 30]}
          minSizes={[620, 320]}
          className="mt-6 min-h-0 gap-0"
          stackBelow={1220}
        >
          <div className="space-y-6">
            <section className="app-panel-card p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Current users</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Review every account in the workspace and filter by role when you want a narrower view.
                  </p>
                </div>

                <select
                  className="app-input rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                >
                  <option value="">All roles</option>
                  <option value="admin">Admins</option>
                  <option value="agent">Agents</option>
                  <option value="customer">Customers</option>
                </select>
              </div>

              <div className="app-table-shell mt-5">
                <div className="app-table-header grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em]">
                  <div>User</div>
                  <div>Email</div>
                  <div>Role</div>
                </div>

                {isLoading ? (
                  <div className="px-5 py-10 text-center text-sm text-gray-500">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-gray-500">No users match this filter.</div>
                ) : (
                  <div className="divide-y app-surface-divider">
                    {filteredUsers.map((user) => (
                      <div key={user.id} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem] gap-4 px-5 py-4 text-sm text-gray-700">
                        <div>
                          <div className="font-semibold text-gray-900">{user.name || 'Unnamed user'}</div>
                          <div className="mt-1 text-xs text-gray-400">{user.id}</div>
                        </div>
                        <div className="truncate">{user.email}</div>
                        <div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                            user.role === 'admin'
                              ? 'app-status-pill app-role-pill-admin'
                              : user.role === 'agent'
                                ? 'app-status-pill app-role-pill-agent'
                                : 'app-status-pill app-role-pill-customer'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="app-panel-card p-6">
              <h2 className="text-lg font-semibold text-gray-900">How sign-in and sign-up work</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="app-soft-card rounded-2xl p-4">
                  <p className="text-sm font-semibold text-gray-900">Admin</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Signs in through <span className="font-medium text-gray-900">/workspace/login</span> or directly at <span className="font-medium text-gray-900">/admin/login</span>, lands on the dashboard, and can create more users from this page.
                  </p>
                </div>
                <div className="app-soft-card rounded-2xl p-4">
                  <p className="text-sm font-semibold text-gray-900">Agent</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Signs in through <span className="font-medium text-gray-900">/workspace/login</span> or directly at <span className="font-medium text-gray-900">/agent/login</span>, lands in the inbox, and uses the internal workspace for support operations.
                  </p>
                </div>
                <div className="app-soft-card rounded-2xl p-4">
                  <p className="text-sm font-semibold text-gray-900">Customer</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Registers at <span className="font-medium text-gray-900">/register</span>, signs in at <span className="font-medium text-gray-900">/login</span>, and then starts authenticated chat from the widget or customer dashboard.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="app-panel-card p-6">
              <h2 className="text-lg font-semibold text-gray-900">Create a new account</h2>
              <p className="mt-1 text-sm text-gray-500">
                Use this for new admins, support agents, or manually created customer test accounts.
              </p>

              <form onSubmit={handleCreateUser} className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    required
                    className="app-input w-full rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    required
                    className="app-input w-full rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className="app-input w-full rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Role</label>
                  <select
                    className="app-input w-full rounded-2xl px-4 py-3 outline-none focus:border-blue-500"
                    value={form.role}
                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                  >
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="app-primary-button w-full rounded-2xl px-5 py-3 text-sm"
                >
                  {isSaving ? 'Creating account...' : 'Create account'}
                </button>
              </form>
            </section>

            <section className="app-panel-card p-6">
              <p className="app-section-kicker">Quick guide</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
                <li>Customers must register or sign in before the public widget will open chat.</li>
                <li>Create agent and admin accounts here instead of using the public register endpoint.</li>
                <li>Customers use the public routes `/register` and `/login`, while admins and agents use `/workspace/login` or their direct `/admin/login` and `/agent/login` routes.</li>
                <li>The root `README.md` also includes a role-by-role auth guide for local setup and demos.</li>
              </ul>
            </section>
          </div>
        </ResizablePanels>
      </div>
    </div>
  );
}
