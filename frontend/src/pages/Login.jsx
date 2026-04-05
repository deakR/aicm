import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  admin: {
    title: "Admin sign in",
    subtitle: "Manage users, analytics, AI settings, and operations.",
    loginEndpoint: `${API_URL}/api/auth/admin/login`,
    loginLabel: "Sign In as Admin",
  },
  agent: {
    title: "Agent sign in",
    subtitle: "Access the shared inbox, tickets, and day-to-day support tools.",
    loginEndpoint: `${API_URL}/api/auth/agent/login`,
    loginLabel: "Sign In as Agent",
  },
  customer: {
    title: "Customer sign in",
    subtitle: "Track conversations, tickets, and continue support chats.",
    loginEndpoint: `${API_URL}/api/auth/customer/login`,
    loginLabel: "Sign In",
  },
  workspace: {
    title: "Workspace sign in",
    subtitle: "Choose the right workspace account for your team role.",
    loginEndpoint: `${API_URL}/api/auth/login`,
    loginLabel: "Sign In to Workspace",
  },
};

export default function Login({ mode = "workspace", variant = "login" }) {
  const isRegisterMode = variant === "register";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { branding } = useBranding();
  const navigate = useNavigate();
  const palette = buildBrandPalette(branding.accent_color);
  const config = useMemo(() => MODE_META[mode] || MODE_META.workspace, [mode]);
  const isCustomerMode = mode === "customer";
  const isWorkspaceMode = mode === "workspace" || mode === "admin" || mode === "agent";

  const performLogin = async (loginEmail, loginPassword) => {
    try {
      const response = await fetch(config.loginEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const raw = await response.text();
      let data = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        setError(data?.message || raw || "Invalid credentials");
        return false;
      }

      const token = data?.token || "";
      const session = decodeAuthToken(token);
      if (!session?.role) {
        clearStoredToken();
        setError("Login succeeded, but the session could not be verified.");
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

    if (isRegisterMode) {
      if (!name.trim()) {
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
        const response = await fetch(`${API_URL}/api/auth/customer/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email,
            password,
          }),
        });

        const raw = await response.text();
        if (!response.ok) {
          setError(raw || "Failed to create your account.");
          setIsSubmitting(false);
          return;
        }

        const loggedIn = await performLogin(email, password);
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

    await performLogin(email, password);
    setIsSubmitting(false);
  };

  return (
    <div className="app-shell relative flex min-h-screen items-center justify-center px-4 py-8">
      <div className="absolute right-4 top-4 z-20 md:right-6 md:top-6">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="app-card rounded-3xl p-8 shadow-2xl md:p-10">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center justify-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${palette.accentDark}, ${palette.accent})`,
                }}
              >
                {branding.brand_name.charAt(0)}
              </div>
            </div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--app-text)" }}
            >
              {isRegisterMode ? "Create Customer Account" : config.title}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--app-text-muted)" }}>
              {isRegisterMode
                ? "Create a customer account before starting support chat."
                : config.subtitle}
            </p>
          </div>

          {error && (
            <div
              className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <div>
                <label htmlFor="name-input" className="mb-2 block text-sm font-medium" style={{ color: "var(--app-text)" }}>
                  Name
                </label>
                <input
                  id="name-input"
                  type="text"
                  required
                  placeholder="John Doe"
                  className="app-field-control w-full"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            )}

            <div>
              <label htmlFor="email-input" className="mb-2 block text-sm font-medium" style={{ color: "var(--app-text)" }}>
                Email
              </label>
              <input
                id="email-input"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="app-field-control w-full"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password-input" className="mb-2 block text-sm font-medium" style={{ color: "var(--app-text)" }}>
                Password
              </label>
              <input
                id="password-input"
                type="password"
                required
                autoComplete={isRegisterMode ? "new-password" : "current-password"}
                placeholder="********"
                className="app-field-control w-full"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {isRegisterMode && (
              <div>
                <label htmlFor="confirm-password-input" className="mb-2 block text-sm font-medium" style={{ color: "var(--app-text)" }}>
                  Confirm Password
                </label>
                <input
                  id="confirm-password-input"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="********"
                  className="app-field-control w-full"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="app-primary-button w-full py-3 text-base font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? isRegisterMode
                  ? "Creating Account..."
                  : "Signing In..."
                : isRegisterMode
                  ? "Create Account"
                  : config.loginLabel}
            </button>
          </form>

          <div className="mt-8 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: "var(--app-border)" }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2" style={{ background: "var(--app-card)", color: "var(--app-text-muted)" }}>
                  Account routes
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link to="/workspace/login" className="font-medium transition-colors" style={{ color: isWorkspaceMode && !isCustomerMode && !isRegisterMode ? palette.accent : "var(--app-text-muted)" }}>
                Workspace
              </Link>
              <span style={{ color: "var(--app-border)" }}>•</span>
              <Link to="/login" className="font-medium transition-colors" style={{ color: isCustomerMode && !isRegisterMode ? palette.accent : "var(--app-text-muted)" }}>
                Customer Sign In
              </Link>
              <span style={{ color: "var(--app-border)" }}>•</span>
              <Link to="/register" className="font-medium transition-colors" style={{ color: isRegisterMode ? palette.accent : "var(--app-text-muted)" }}>
                Customer Register
              </Link>
            </div>
          </div>

          <div
            className="mt-6 rounded-xl px-4 py-3 text-center text-xs leading-relaxed"
            style={{
              backgroundColor: "var(--app-card-muted)",
              color: "var(--app-text-soft)",
            }}
          >
            {isRegisterMode
              ? "Customer accounts can use the public chat, sign in to the dashboard, and track tickets."
              : isCustomerMode
                ? "Customers can sign in here, then use the help center or widget to start authenticated support chat."
                : mode === "admin"
                  ? "Admins can manage users, AI settings, workflows, analytics, and the shared support workspace."
                  : "Agents use the shared inbox, tickets, knowledge hub, and workflow tools for support operations."}
          </div>
        </div>
      </div>
    </div>
  );
}
