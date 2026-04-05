import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  applyBrandPaletteToDocument,
  defaultBranding,
} from '../branding';
import BrandingContext from './branding-context';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8900';

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(defaultBranding);
  const [isBrandingLoading, setIsBrandingLoading] = useState(true);

  const refreshBranding = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/public`);
      if (res.ok) {
        const data = await res.json();
        setBranding((prev) => ({ ...prev, ...data }));
      }
    } catch {
      // Keep defaults when settings endpoint is unavailable.
    } finally {
      setIsBrandingLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  useEffect(() => {
    applyBrandPaletteToDocument(branding.accent_color);
  }, [branding.accent_color]);

  const contextValue = useMemo(
    () => ({ branding, isBrandingLoading, refreshBranding }),
    [branding, isBrandingLoading, refreshBranding],
  );

  return (
    <BrandingContext.Provider value={contextValue}>
      {children}
    </BrandingContext.Provider>
  );
}
