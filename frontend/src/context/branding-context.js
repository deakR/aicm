import { createContext } from 'react';
import { defaultBranding } from '../branding';

const BrandingContext = createContext({
  branding: defaultBranding,
  isBrandingLoading: true,
  refreshBranding: async () => {},
});

export default BrandingContext;
