import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import KnowledgeHub from './pages/KnowledgeHub';
import Tickets from './pages/Tickets';
import Workflows from './pages/Workflows';
import HelpCenter from './pages/HelpCenter';
import Dashboard from './pages/Dashboard';
import AISettings from './pages/AISettings';
import Users from './pages/Users';
import WidgetEmbedPage from './pages/WidgetEmbedPage';
import CustomerDashboard from './pages/CustomerDashboard';
import Widget from './components/Widget';
import AppLayout from './components/AppLayout';
import ThemeToggle from './components/ThemeToggle';
import { clearStoredToken, getCurrentSession, getDefaultRouteForRole } from './auth';
import { buildBrandPalette } from './branding';
import { useThemePreference } from './theme';
import { BrandingProvider } from './context/BrandingContext';
import useBranding from './context/useBranding';

function ProtectedRoute({ children, allowedRoles = ['admin', 'agent'], loginPath = '/workspace/login' }) {
  const session = getCurrentSession();

  if (!session.isAuthenticated) {
    clearStoredToken();
    return <Navigate to={loginPath} replace />;
  }

  if (!allowedRoles.includes(session.role)) {
    return <Navigate to={getDefaultRouteForRole(session.role)} replace />;
  }

  return children;
}

function PublicWebsite() {
  const { branding } = useBranding();
  const { resolvedTheme } = useThemePreference();
  const palette = buildBrandPalette(branding.accent_color);
  const isDark = resolvedTheme === 'dark';
  const actions = [
    {
      to: '/help',
      label: 'Browse Help Center',
      description: 'Find straightforward answers for billing, account access, orders, and policy questions.',
      primary: true,
    },
    {
      to: '/register',
      label: 'Create Customer Account',
      description: 'Open a secure support account so you can continue chats and track updates later.',
    },
    {
      to: '/login',
      label: 'Customer Sign In',
      description: 'Return to your support dashboard, continue conversations, and review tickets.',
    },
  ];

  return (
    <div className="app-shell min-h-screen overflow-hidden">
      <div
        className="relative min-h-screen px-6 py-6 md:px-8 lg:px-10"
        style={{
          backgroundImage: isDark
            ? `radial-gradient(circle at top, ${palette.accent}18, transparent 26%), linear-gradient(180deg, #06111f 0%, #0b1830 60%, #0d1a31 100%)`
            : `radial-gradient(circle at top, ${palette.accent}18, transparent 28%), linear-gradient(180deg, #f8fbff 0%, #eef5ff 60%, #e9f1fd 100%)`,
        }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 py-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: isDark ? palette.accentSoft : palette.accentDark }}>
              {branding.brand_name}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--app-text-muted)' }}>
              Customer support that starts with answers and reaches a person when needed.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/help" className="app-secondary-button">
              Help Center
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-4xl items-center justify-center py-12 lg:py-20">
          <div className="w-full text-center">
            <p
              className="text-sm font-semibold uppercase tracking-[0.3em]"
              style={{ color: isDark ? palette.accentSoft : palette.accentDark }}
            >
              Customer Support
            </p>
            <h1 className={`mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl ${isDark ? 'text-white' : 'text-slate-950'}`}>
              Help, without the noise.
            </h1>
            <p className={`mx-auto mt-6 max-w-2xl text-lg leading-8 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Search the help center, sign in to continue your support history, or create an account to start a secure conversation.
            </p>

            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
              {actions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className={`rounded-[1.4rem] border px-5 py-5 text-left transition duration-200 hover:-translate-y-0.5 ${
                    action.primary ? 'shadow-xl' : ''
                  }`}
                  style={
                    action.primary
                      ? {
                          borderColor: `${palette.accent}AA`,
                          background: `linear-gradient(145deg, ${palette.accentDark}, ${palette.accent})`,
                          color: '#ffffff',
                          boxShadow: `0 18px 36px ${palette.accent}22`,
                        }
                      : {
                          borderColor: 'var(--app-border)',
                          background: 'color-mix(in srgb, var(--app-card) 96%, transparent)',
                          color: 'var(--app-text)',
                        }
                  }
                >
                  <div className="text-base font-semibold leading-7">{action.label}</div>
                  <p
                    className="mt-3 text-sm leading-6"
                    style={{
                      color: action.primary ? 'rgba(255,255,255,0.82)' : 'var(--app-text-muted)',
                    }}
                  >
                    {action.description}
                  </p>
                </Link>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {['Account access', 'Billing', 'Orders', 'Returns'].map((topic) => (
                <span key={topic} className="app-chip">
                  {topic}
                </span>
              ))}
            </div>

            <div className="mt-10 text-sm" style={{ color: 'var(--app-text-muted)' }}>
              Internal staff? <Link to="/workspace/login" style={{ color: palette.accentDark }}>Open workspace sign in</Link>.
            </div>
          </div>
        </div>
      </div>
      <Widget />
    </div>
  );
}

function HomeRedirect() {
  const session = getCurrentSession();

  if (session.isAuthenticated) {
    return <Navigate to={getDefaultRouteForRole(session.role)} replace />;
  }

  return <PublicWebsite />;
}

function LoginRedirect({ mode = 'workspace', variant = 'login' }) {
  const session = getCurrentSession();

  if (session.isAuthenticated) {
    return <Navigate to={getDefaultRouteForRole(session.role)} replace />;
  }

  return <Login mode={mode} variant={variant} />;
}

function LoginChooser() {
  const { branding } = useBranding();
  const palette = buildBrandPalette(branding.accent_color);

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        <div className="app-card rounded-3xl p-8 shadow-2xl md:p-10">
          <div className="mb-8 text-center">
            <p className="app-section-kicker">{branding.brand_name}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>
              Choose your sign-in route
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--app-text-muted)' }}>
              Admins, agents, and customers each have their own login path.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Admin', '/admin/login', 'Workspace administration, analytics, users, and settings.'],
              ['Agent', '/agent/login', 'Shared inbox, tickets, workflows, and day-to-day support.'],
            ].map(([label, path, description]) => (
              <Link key={path} to={path} className="app-detail-card rounded-3xl p-5 transition hover:-translate-y-0.5">
                <p className="text-sm font-semibold" style={{ color: palette.accentDark }}>{label}</p>
                <p className="mt-3 text-sm leading-6" style={{ color: 'var(--app-text-muted)' }}>{description}</p>
              </Link>
            ))}
          </div>

          <div className="mt-6 text-center text-sm" style={{ color: 'var(--app-text-muted)' }}>
            Customer access lives on the public routes: <Link to="/login" style={{ color: palette.accentDark }}>sign in</Link> or <Link to="/register" style={{ color: palette.accentDark }}>create an account</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <BrandingProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/embed/widget" element={<WidgetEmbedPage />} />
          <Route path="/login" element={<LoginRedirect mode="customer" variant="login" />} />
          <Route path="/register" element={<LoginRedirect mode="customer" variant="register" />} />
          <Route path="/workspace/login" element={<LoginChooser />} />
          <Route path="/admin/login" element={<LoginRedirect mode="admin" variant="login" />} />
          <Route path="/agent/login" element={<LoginRedirect mode="agent" variant="login" />} />
          <Route path="/customer/login" element={<Navigate to="/login" replace />} />
          <Route path="/customer/register" element={<Navigate to="/register" replace />} />
          <Route
            path="/customer"
            element={
              <ProtectedRoute allowedRoles={['customer']} loginPath="/login">
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute loginPath="/workspace/login">
                <AppLayout><Dashboard /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute loginPath="/workspace/login">
                <AppLayout><Inbox /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/knowledge"
            element={
              <ProtectedRoute loginPath="/workspace/login">
                <AppLayout><KnowledgeHub /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets"
            element={
              <ProtectedRoute loginPath="/workspace/login">
                <AppLayout><Tickets /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <ProtectedRoute loginPath="/workspace/login">
                <AppLayout><Workflows /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['admin']} loginPath="/workspace/login">
                <AppLayout><AISettings /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['admin']} loginPath="/workspace/login">
                <AppLayout><Users /></AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrandingProvider>
    </BrowserRouter>
  );
}

export default App;
