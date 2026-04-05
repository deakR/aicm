import { useContext } from 'react';
import BrandingContext from './branding-context';

export default function useBranding() {
  return useContext(BrandingContext);
}
