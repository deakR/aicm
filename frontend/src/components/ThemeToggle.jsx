import { useThemePreference } from "../theme";

export default function ThemeToggle({ compact = false, className = "" }) {
  const { resolvedTheme, toggleTheme } = useThemePreference();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle ${compact ? "theme-toggle-compact" : ""} ${className}`.trim()}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2.5v2.2" />
            <path d="M12 19.3v2.2" />
            <path d="M4.9 4.9l1.5 1.5" />
            <path d="M17.6 17.6l1.5 1.5" />
            <path d="M2.5 12h2.2" />
            <path d="M19.3 12h2.2" />
            <path d="M4.9 19.1l1.5-1.5" />
            <path d="M17.6 6.4l1.5-1.5" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.8A8.8 8.8 0 1111.2 3 6.8 6.8 0 0021 12.8z" />
          </svg>
        )}
      </span>
      {!compact && (
        <span className="theme-toggle-label">
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      )}
    </button>
  );
}
