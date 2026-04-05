export const defaultBranding = {
  assistant_name: 'AI Agent',
  brand_name: 'AICM Support',
  accent_color: '#2563EB',
};

export function normalizeHexColor(value, fallback = '#2563EB') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : fallback;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(baseHex, targetHex, amount) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);

  return rgbToHex({
    r: base.r + (target.r - base.r) * amount,
    g: base.g + (target.g - base.g) * amount,
    b: base.b + (target.b - base.b) * amount,
  });
}

export function buildBrandPalette(accentColor) {
  const accent = normalizeHexColor(accentColor);

  return {
    accent,
    accentDark: mixHex(accent, '#111827', 0.28),
    accentSoft: mixHex(accent, '#ffffff', 0.82),
    accentSurface: mixHex(accent, '#ffffff', 0.92),
    accentBorder: mixHex(accent, '#ffffff', 0.7),
  };
}

export function applyBrandPaletteToDocument(accentColor) {
  if (typeof document === "undefined") {
    return buildBrandPalette(accentColor);
  }

  const palette = buildBrandPalette(accentColor);
  const root = document.documentElement;
  root.style.setProperty("--brand-accent", palette.accent);
  root.style.setProperty("--brand-accent-dark", palette.accentDark);
  root.style.setProperty("--brand-accent-soft", palette.accentSoft);
  root.style.setProperty("--brand-accent-surface", palette.accentSurface);
  root.style.setProperty("--brand-accent-border", palette.accentBorder);
  return palette;
}

if (typeof document !== "undefined") {
  applyBrandPaletteToDocument(defaultBranding.accent_color);
}
