import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearStoredToken } from '../auth';
import { getCurrentSession } from '../auth';
import ResizablePanels from './ResizablePanels';
import ThemeToggle from './ThemeToggle';
import Button from './ui/Button';
import Sheet from './ui/Sheet';
import { buildBrandPalette } from '../branding';
import useBranding from '../context/useBranding';
import { useThemePreference } from '../theme';

const DESKTOP_BREAKPOINT = 1024;

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function AppLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path) => location.pathname.startsWith(path);
  const session = getCurrentSession();
  const { branding } = useBranding();
  const { resolvedTheme } = useThemePreference();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return 1280;
    }
    return window.innerWidth;
  });
  const [shellSizes, setShellSizes] = useState(() => {
    try {
      const persisted = localStorage.getItem('aicm:layout-shell');
      if (persisted) {
        const parsed = JSON.parse(persisted);
        if (Array.isArray(parsed) && parsed.length === 2) {
          return parsed;
        }
      }
    } catch {
      // ignore stale local layout data
    }
    return [14, 86];
  });
  const isCompactSidebar = shellSizes[0] < 13;
  const isMobileViewport = viewportWidth < DESKTOP_BREAKPOINT;
  const palette = buildBrandPalette(branding.accent_color);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Inbox', path: '/inbox', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
    { label: 'Tickets', path: '/tickets', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
    { label: 'Knowledge Hub', path: '/knowledge', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { label: 'Automations', path: '/workflows', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    ...(session.role === 'admin'
      ? [
        { label: 'Users', path: '/users', icon: 'M17 20h5V18a4 4 0 00-5.34-3.77M17 20H7m10 0v-2c0-.65-.13-1.27-.37-1.84M7 20H2V18a4 4 0 015.34-3.77M7 20v-2c0-.65.13-1.27.37-1.84m0 0a5 5 0 019.26 0M14 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM6 10a2 2 0 11-4 0 2 2 0 014 0z' },
        { label: 'AI Settings', path: '/settings', icon: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 4a7.96 7.96 0 00-.34-2.3l2.02-1.57-2-3.46-2.44.99a8.22 8.22 0 00-1.98-1.15L15.5 2h-4l-.7 2.51c-.7.27-1.36.66-1.98 1.15l-2.44-.99-2 3.46 2.02 1.57A7.96 7.96 0 004.06 12c0 .79.12 1.55.34 2.3l-2.02 1.57 2 3.46 2.44-.99c.62.49 1.28.88 1.98 1.15L11.5 22h4l.7-2.51c.7-.27 1.36-.66 1.98-1.15l2.44.99 2-3.46-2.02-1.57c.22-.75.34-1.51.34-2.3z' },
      ]
      : []),
  ];

  const handleLogout = () => {
    clearStoredToken();
    navigate('/workspace/login');
  };

  const renderSidebar = ({ compactSidebar, mobile = false } = {}) => (
    <nav
      className={cx(
        'flex h-full w-full min-w-0 flex-col',
        mobile ? 'shadow-none' : 'shadow-2xl',
      )}
      style={{
        color: 'var(--app-sidebar-text)',
        background:
          resolvedTheme === 'dark'
            ? 'linear-gradient(180deg, var(--app-sidebar-bg), color-mix(in srgb, var(--app-sidebar-bg) 84%, var(--app-card-muted)) 100%)'
            : 'linear-gradient(180deg, var(--app-sidebar-bg), color-mix(in srgb, var(--app-sidebar-bg) 78%, var(--app-card-muted)) 100%)',
      }}
    >
      <div
        className={cx(
          'flex h-16 items-center border-b',
          compactSidebar ? 'justify-center px-3' : 'justify-between px-5',
        )}
        style={{ borderColor: 'var(--app-sidebar-border)' }}
      >
        <div className="flex min-w-0 items-center">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white shadow-inner"
            style={{ backgroundColor: palette.accent }}
          >
            AI
          </div>
          {!compactSidebar && (
            <div className="ml-3 min-w-0">
              <span className="block truncate font-semibold tracking-tight">{branding.brand_name}</span>
              <span className="block truncate text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--app-sidebar-muted)' }}>
                Support workspace
              </span>
            </div>
          )}
        </div>

        {!compactSidebar && (
          <div className="flex items-center gap-2">
            {!mobile && <ThemeToggle compact />}
            {mobile && (
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-black/5 dark:hover:bg-white/10"
                style={{ color: 'var(--app-sidebar-text)' }}
                onClick={() => setIsMobileNavOpen(false)}
              >
                Close
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            title={compactSidebar ? item.label : undefined}
            className={cx(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
              isActive(item.path)
                ? 'shadow-lg'
                : 'hover:bg-black/5 dark:hover:bg-white/5',
              compactSidebar ? 'justify-center' : '',
            )}
            style={
              isActive(item.path)
                ? {
                    color: 'var(--app-sidebar-text)',
                    backgroundColor:
                      resolvedTheme === 'dark'
                        ? 'color-mix(in srgb, var(--brand-accent) 12%, var(--app-sidebar-elevated))'
                        : 'color-mix(in srgb, var(--brand-accent) 14%, var(--app-sidebar-elevated))',
                    border: '1px solid var(--app-sidebar-border)',
                    boxShadow:
                      resolvedTheme === 'dark'
                        ? 'inset 3px 0 0 var(--brand-accent), 0 12px 24px rgba(2, 6, 23, 0.22)'
                        : 'inset 3px 0 0 var(--brand-accent), 0 12px 24px rgba(37, 99, 235, 0.08)',
                  }
                : { color: 'var(--app-sidebar-muted)' }
            }
            onClick={() => {
              if (mobile) {
                setIsMobileNavOpen(false);
              }
            }}
          >
            <svg
              className={cx(
                'h-5 w-5 flex-shrink-0',
                isActive(item.path)
                  ? ''
                  : 'group-hover:text-[var(--app-sidebar-text)]',
              )}
              style={{
                color: isActive(item.path)
                  ? 'var(--app-sidebar-text)'
                  : 'var(--app-sidebar-muted)',
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              {item.label === 'Automations' && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              )}
            </svg>
            {!compactSidebar && <span className="truncate font-medium text-sm">{item.label}</span>}

            {compactSidebar && (
              <div
                className="absolute left-14 z-50 invisible whitespace-nowrap rounded-xl border px-2 py-1 text-xs opacity-0 shadow-lg backdrop-blur transition-all group-hover:visible group-hover:opacity-100"
                style={{
                  borderColor: 'var(--app-sidebar-border)',
                  color: 'var(--app-sidebar-text)',
                  backgroundColor:
                    resolvedTheme === 'dark'
                      ? 'rgba(15, 23, 42, 0.9)'
                      : 'rgba(255, 255, 255, 0.95)',
                }}
              >
                {item.label}
              </div>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-auto border-t p-3" style={{ borderColor: 'var(--app-sidebar-border)' }}>
        {compactSidebar && !mobile && (
          <div className="mb-3 flex justify-center">
            <ThemeToggle compact />
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cx(
            'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:text-rose-400',
            resolvedTheme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5',
            compactSidebar ? 'justify-center' : 'justify-start',
          )}
          style={{ color: 'var(--app-sidebar-muted)' }}
          title="Sign out"
        >
          <svg
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          {!compactSidebar && <span className="font-medium text-sm">Sign out</span>}
        </button>
      </div>
    </nav>
  );

  if (isMobileViewport) {
    return (
      <div className="app-shell flex h-screen w-full flex-col font-sans antialiased">
        <header className="app-mobile-header">
          <button
            type="button"
            className="app-nav-icon-button"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight" style={{ color: 'var(--app-text)' }}>
              {branding.brand_name}
            </p>
            <p className="truncate text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--app-text-soft)' }}>
              Support workspace
            </p>
          </div>

          <ThemeToggle compact />
        </header>

        <Sheet open={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} title="Navigation">
          {renderSidebar({ compactSidebar: false, mobile: true })}
        </Sheet>

        <main className="app-main-surface relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden shadow-inner">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell flex h-screen w-full font-sans antialiased">
      <ResizablePanels
        storageKey="aicm:layout-shell"
        initialSizes={[14, 86]}
        minSizes={[80, 720]}
        maxSizes={[320]}
        className="h-full w-full"
        stackBelow={DESKTOP_BREAKPOINT}
        onSizesChange={setShellSizes}
      >
        {renderSidebar({ compactSidebar: isCompactSidebar })}

        <main className="app-main-surface relative flex h-full min-w-0 flex-1 flex-col overflow-hidden shadow-inner">
          {children}
        </main>
      </ResizablePanels>
    </div>
  );
}
