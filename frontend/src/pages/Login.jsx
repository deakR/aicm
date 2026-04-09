import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { buildBrandPalette } from "../branding";
import {
  decodeAuthToken,
  getDefaultRouteForRole,
  persistToken,
  clearStoredToken,
  consumePostLoginPath,
} from "../auth";
import useBranding from "../context/useBranding";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8900";

const MODE_META = {
  customer: {
    title: "Sign in to track your support requests",
    subtitle: "Track conversations, tickets, and continue support chats.",      
    loginEndpoint: `${API_URL}/api/auth/customer/login`,
    loginLabel: "Sign In",
    registerEndpoint: `${API_URL}/api/auth/customer/register`,
    registerLabel: "Create Account",
  },
  workspace: {
    title: "Workspace sign in",
    subtitle: "Access the shared inbox, tickets, and administration tools.",
    loginEndpoint: `${API_URL}/api/auth/workspace/login`,
    loginLabel: "Sign In",
  },
};

const WORKSPACE_ROLES = new Set(["admin", "agent"]);

function safeParseJson(raw) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRoleAllowedForMode(role, mode) {
  if (mode === "workspace") {
    return WORKSPACE_ROLES.has(role);
  }

  return role === "customer";
}

export default function Login({ mode = "workspace", variant = "login" }) {
  const [internalVariant, setInternalVariant] = useState(variant);
  const isRegisterMode = internalVariant === "register";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { branding } = useBranding();
  const navigate = useNavigate();
  const palette = buildBrandPalette(branding.accent_color);
  const isWorkspaceMode = mode === "workspace";
  const config = useMemo(() => MODE_META[mode] || MODE_META.workspace, [mode]);

  useEffect(() => {
    setInternalVariant(variant);
  }, [variant, mode]);

  const readResponsePayload = async (response) => {
    const raw = await response.text();
    return {
      raw,
      json: safeParseJson(raw),
    };
  };

  const roleMismatchMessage = isWorkspaceMode
    ? "This account is not allowed in workspace sign in. Use an admin or agent account."
    : "This account is not a customer account. Please use workspace sign in.";

  const performLogin = async (loginEmail, loginPassword) => {
    try {
      const response = await fetch(config.loginEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const payload = await readResponsePayload(response);
      const errorMessage = payload.json?.message || payload.raw;

      if (!response.ok) {
        setError(errorMessage || "Invalid credentials");
        return false;
      }

      const token = payload.json?.token || "";
      const session = decodeAuthToken(token);
      if (!session?.role) {
        clearStoredToken();
        setError("Login succeeded, but the session could not be verified.");
        return false;
      }

      if (!isRoleAllowedForMode(session.role, mode)) {
        clearStoredToken();
        setError(roleMismatchMessage);
        return false;
      }

      persistToken(token);
      const returnPath = consumePostLoginPath();
      const safeReturnPath =
        session.role === "customer" &&
        typeof returnPath === "string" &&
        returnPath.startsWith("/")
          ? returnPath
          : "";
      navigate(safeReturnPath || getDefaultRouteForRole(session.role), {
        replace: true,
      });
      return true;
    } catch {
      setError("Failed to connect to the server.");
      return false;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    if (isRegisterMode) {
      if (!trimmedName) {
        setError("Name is required.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setIsSubmitting(true);

    if (isRegisterMode) {
      try {
        const response = await fetch(config.registerEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            email: normalizedEmail,
            password,
          }),
        });

        const payload = await readResponsePayload(response);
        if (!response.ok) {
          setError(payload.json?.message || payload.raw || "Failed to create your account.");
          setIsSubmitting(false);
          return;
        }

        const loggedIn = await performLogin(normalizedEmail, password);
        if (!loggedIn) {
          setError("Account created, but automatic sign-in failed. Please sign in manually.");
        }
      } catch {
        setError("Failed to connect to the server.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    await performLogin(normalizedEmail, password);
    setIsSubmitting(false);
  };

  return (
    <div className="app-shell relative flex min-h-screen items-center justify-center px-4 py-8">
      <div className="absolute right-4 top-4 z-20 md:right-6 md:top-6">
        <ThemeToggle />
      </div>

      {isWorkspaceMode ? (
        <div className="flex w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ minHeight: '80vh' }}>
          <div className="hidden md:flex w-1/2 flex-col items-center justify-center p-12 text-center text-white" style={{ background: `linear-gradient(135deg, ${palette.accentDark}, ${palette.accent})` }}>
            <h1 className="text-4xl font-bold mb-4">AICM Workspace</h1>
            <p className="text-lg opacity-90">Deliver exceptional support faster.</p>
          </div>
          <div className="flex w-full md:w-1/2 flex-col justify-center p-8 lg:p-16 bg-white">
            <div className="mx-auto w-full max-w-sm">
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Sign in</h1>
                <p className="mt-2 text-sm text-gray-500">Sign in to your team workspace</p>
              </div>

              {error && (
                <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div className="mb-6 space-y-3">
                <button type="button" disabled className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 opacity-60 cursor-not-allowed">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>
                <button type="button" disabled className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 opacity-60 cursor-not-allowed">
                  <svg className="h-5 w-5" fill="#00a4ef" viewBox="0 0 21 21">
                    <path d="M0 0h10v10H0zm11 0h10v10H11zM0 11h10v10H0zm11 0h10v10H11z" />
                  </svg>
                  Continue with Microsoft
                </button>
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-4 text-gray-500">Or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="workspace-email" className="mb-2 block text-sm font-medium text-gray-900">Email</label>
                  <input
                    id="workspace-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="app-field-control w-full bg-white text-gray-900 border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="workspace-password" className="mb-2 block text-sm font-medium text-gray-900">Password</label>
                  <input
                    id="workspace-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="app-field-control w-full bg-white text-gray-900 border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="app-primary-button mt-4 w-full justify-center disabled:opacity-50"
                  style={{ backgroundColor: palette.accent }}
                >
                  {isSubmitting ? 'Signing in...' : config.loginLabel}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-md">
          <div className="app-card rounded-3xl p-8 border border-slate-200 bg-white shadow-sm md:p-10">
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex items-center justify-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${palette.accentDark}, ${palette.accent})` }}
                >
                  {branding.brand_name.charAt(0)}
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {isRegisterMode ? config.registerLabel : config.title}
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {isRegisterMode
                  ? 'Create a customer account before starting support chat.'
                  : config.subtitle}
              </p>
            </div>

            <div className="mb-6 inline-flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setInternalVariant("login")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  !isRegisterMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setInternalVariant("register")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isRegisterMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegisterMode && (
                <div>
                  <label htmlFor="customer-name" className="mb-2 block text-sm font-medium text-gray-900">Name</label>
                  <input
                    id="customer-name"
                    type="text"
                    required
                    placeholder="Jane Doe"
                    className="app-field-control w-full bg-white text-gray-900 border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label htmlFor="customer-email" className="mb-2 block text-sm font-medium text-gray-900">Email</label>
                <input
                  id="customer-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="app-field-control w-full bg-white text-gray-900 border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="customer-password" className="mb-2 block text-sm font-medium text-gray-900">Password</label>
                <input
                  id="customer-password"
                  type="password"
                  required
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  className="app-field-control w-full bg-white text-gray-900 border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {isRegisterMode && (
                <div>
                  <label htmlFor="customer-confirm-password" className="mb-2 block text-sm font-medium text-gray-900">Confirm Password</label>
                  <input
                    id="customer-confirm-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="app-field-control w-full bg-white text-gray-900 border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              )}
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="app-primary-button mt-4 w-full justify-center disabled:opacity-50"
                style={{ backgroundColor: palette.accent }}
              >
                {isSubmitting
                  ? 'Working...'
                  : isRegisterMode
                  ? config.registerLabel
                  : config.loginLabel}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-gray-500">
              Customer authentication only. Staff should use workspace sign in.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}