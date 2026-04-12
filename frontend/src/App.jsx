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
import AppErrorBoundary from './components/AppErrorBoundary';
import GlobalBackButton from './components/GlobalBackButton';
import ThemeToggle from './components/ThemeToggle';
import { clearStoredToken, getCurrentSession, getDefaultRouteForRole } from './auth';
import { buildBrandPalette } from './branding';
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
  const palette = buildBrandPalette(branding.accent_color);

  return (
    <div className="app-shell min-h-screen">
      {/* Nav */}
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-5 md:px-8">
        <p
          className="text-sm font-bold tracking-tight"
          style={{ color: 'var(--app-text)' }}
        >
          {branding.brand_name}
        </p>
        <div className="flex items-center gap-3">
          <Link to="/help" className="app-secondary-button">
            Help Center
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* Hero */}
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6 py-20">
        <div className="w-full max-w-xl text-center">
          <h1
            className="text-5xl font-bold tracking-tight sm:text-6xl"
            style={{ color: 'var(--app-text)' }}
          >
            Help, without the noise.
          </h1>
          <p
            className="mx-auto mt-6 max-w-sm text-base leading-7"
            style={{ color: 'var(--app-text-muted)' }}
          >
            Search the help center or sign in to continue a conversation.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/help"
              className="app-primary-button w-full sm:w-auto"
            >
              Browse help center
            </Link>
            <Link
              to="/login"
              className="app-secondary-button w-full sm:w-auto"
            >
              Sign in
            </Link>
          </div>

          <p
            className="mt-12 text-xs"
            style={{ color: 'var(--app-text-soft)' }}
          >
            Internal staff?{' '}
            <Link
              to="/workspace/login"
              style={{ color: palette.accentDark }}
            >
              Workspace sign in
            </Link>
          </p>
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

function withRouteBoundary(element, routeName) {
  return <AppErrorBoundary routeName={routeName}>{element}</AppErrorBoundary>;
}

function App() {
  return (
    <BrowserRouter>
      <BrandingProvider>
        <GlobalBackButton />
        <Routes>
          <Route path="/" element={withRouteBoundary(<HomeRedirect />, 'home')} />
          <Route path="/help" element={withRouteBoundary(<HelpCenter />, 'help center')} />
          <Route path="/embed/widget" element={withRouteBoundary(<WidgetEmbedPage />, 'widget embed')} />
          <Route path="/login" element={withRouteBoundary(<LoginRedirect mode="customer" variant="login" />, 'login')} />
          <Route path="/register" element={withRouteBoundary(<LoginRedirect mode="customer" variant="register" />, 'register')} />
          <Route path="/workspace/login" element={withRouteBoundary(<LoginRedirect mode="workspace" variant="login" />, 'workspace login')} />
          <Route path="/customer/login" element={withRouteBoundary(<Navigate to="/login" replace />, 'customer login')} />
          <Route path="/customer/register" element={withRouteBoundary(<Navigate to="/register" replace />, 'customer register')} />
          <Route
            path="/customer"
            element={withRouteBoundary(
              <ProtectedRoute allowedRoles={['customer']} loginPath="/login">
                <CustomerDashboard />
              </ProtectedRoute>,
              'customer dashboard',
            )}
          />
          <Route
            path="/dashboard"
            element={withRouteBoundary(
              <ProtectedRoute loginPath="/workspace/login">
                <AppLayout><Dashboard /></AppLayout>
              </ProtectedRoute>,
              'dashboard',
            )}
          />
          <Route
            path="/inbox"
            element={withRouteBoundary(
              <ProtectedRoute loginPath="/workspace/login">
                <AppLayout><Inbox /></AppLayout>
              </ProtectedRoute>,
              'inbox',
            )}
          />
          <Route
            path="/knowledge"
            element={withRouteBoundary(
              <ProtectedRoute loginPath="/workspace/login">
                <AppLayout><KnowledgeHub /></AppLayout>
              </ProtectedRoute>,
              'knowledge hub',
            )}
          />
          <Route
            path="/tickets"
            element={withRouteBoundary(
              <ProtectedRoute loginPath="/workspace/login">
                <AppLayout><Tickets /></AppLayout>
              </ProtectedRoute>,
              'tickets',
            )}
          />
          <Route
            path="/workflows"
            element={withRouteBoundary(
              <ProtectedRoute loginPath="/workspace/login">
                <AppLayout><Workflows /></AppLayout>
              </ProtectedRoute>,
              'workflows',
            )}
          />
          <Route
            path="/settings"
            element={withRouteBoundary(
              <ProtectedRoute allowedRoles={['admin']} loginPath="/workspace/login">
                <AppLayout><AISettings /></AppLayout>
              </ProtectedRoute>,
              'settings',
            )}
          />
          <Route
            path="/users"
            element={withRouteBoundary(
              <ProtectedRoute allowedRoles={['admin']} loginPath="/workspace/login">
                <AppLayout><Users /></AppLayout>
              </ProtectedRoute>,
              'users',
            )}
          />
        </Routes>
      </BrandingProvider>
    </BrowserRouter>
  );
}

export default App;
