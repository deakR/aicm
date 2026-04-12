import { useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCurrentSession, getDefaultRouteForRole } from '../auth';

const WORKSPACE_PATH_RE = /^\/(dashboard|inbox|knowledge|tickets|workflows|settings|users)(\/|$)/;

function canUseRouterBackNavigation() {
  if (typeof window === 'undefined') {
    return false;
  }

  const historyIndex = window.history?.state?.idx;
  if (typeof historyIndex === 'number') {
    return historyIndex > 0;
  }

  return window.history.length > 1;
}

function resolveFallbackPath(pathname) {
  const session = getCurrentSession();
  if (session.isAuthenticated) {
    const defaultRoute = getDefaultRouteForRole(session.role);
    if (defaultRoute && defaultRoute !== pathname) {
      return defaultRoute;
    }
  }

  if (pathname !== '/') {
    return '/';
  }

  return '/help';
}

export default function GlobalBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [buttonPosition, setButtonPosition] = useState({ left: 14, top: 14 });
  const fallbackPath = useMemo(() => resolveFallbackPath(location.pathname), [location.pathname]);
  const isWorkspaceRoute = useMemo(
    () => WORKSPACE_PATH_RE.test(location.pathname),
    [location.pathname],
  );
  const isCustomerRoute = useMemo(
    () => location.pathname === '/customer',
    [location.pathname],
  );

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updatePosition = () => {
      const isMobileViewport = window.innerWidth < 1024;
      if (isWorkspaceRoute && isMobileViewport) {
        setButtonPosition({ left: 14, top: 78 });
        return;
      }

      if (isWorkspaceRoute) {
        const mainSurface = document.querySelector('main.app-main-surface');
        const mainLeft =
          mainSurface instanceof HTMLElement
            ? Math.max(14, Math.round(mainSurface.getBoundingClientRect().left + 12))
            : 14;
        setButtonPosition({ left: mainLeft, top: 14 });
        return;
      }

      if (isCustomerRoute) {
        setButtonPosition({ left: 14, top: 18 });
        return;
      }

      setButtonPosition({ left: 14, top: 14 });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);

    const mainSurface = document.querySelector('main.app-main-surface');
    const observer =
      isWorkspaceRoute && typeof ResizeObserver !== 'undefined' && mainSurface instanceof HTMLElement
        ? new ResizeObserver(updatePosition)
        : null;
    if (observer && mainSurface instanceof HTMLElement) {
      observer.observe(mainSurface);
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
      observer?.disconnect();
    };
  }, [isWorkspaceRoute, isCustomerRoute]);

  const handleBack = () => {
    if (canUseRouterBackNavigation()) {
      navigate(-1);
      return;
    }

    navigate(fallbackPath, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="app-global-back-button"
      style={{ left: `${buttonPosition.left}px`, top: `${buttonPosition.top}px` }}
      aria-label="Go back"
      title="Go back"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12.5 4.5L7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}