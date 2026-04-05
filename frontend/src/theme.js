import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "aicm:theme";

function getSystemTheme() {
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function getStoredThemePreference() {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return getSystemTheme();
}

export function applyThemePreference(theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function persistThemePreference(theme) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyThemePreference(theme);
  window.dispatchEvent(
    new CustomEvent("aicm-theme-change", { detail: { theme } }),
  );
}

export function useThemePreference() {
  const [theme, setTheme] = useState(() => getStoredThemePreference());

  useEffect(() => {
    applyThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = (event) => {
      const nextTheme = event.detail?.theme;
      if (nextTheme === "light" || nextTheme === "dark") {
        setTheme(nextTheme);
      }
    };

    const handleStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY) {
        setTheme(getStoredThemePreference());
      }
    };

    window.addEventListener("aicm-theme-change", handleThemeChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("aicm-theme-change", handleThemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const updateTheme = (nextTheme) => {
    setTheme(nextTheme);
    persistThemePreference(nextTheme);
  };

  return {
    theme,
    resolvedTheme: theme,
    setTheme: updateTheme,
    toggleTheme: () => updateTheme(theme === "dark" ? "light" : "dark"),
  };
}

if (typeof document !== "undefined") {
  applyThemePreference(getStoredThemePreference());
}
