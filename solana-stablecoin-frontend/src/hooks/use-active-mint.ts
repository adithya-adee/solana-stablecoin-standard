'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'sss-active-mint';

export function useActiveMint() {
  const [activeMint, setActiveMintState] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored !== 'null' && stored !== 'undefined') {
      setActiveMintState(stored);
    } else {
      // Smart default: check sss-mint-history
      const history = window.localStorage.getItem('sss-mint-history');
      if (history) {
        try {
          const parsed = JSON.parse(history);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].address) {
            setActiveMintState(parsed[0].address);
          }
        } catch (e) {
          console.error('Failed to parse mint history for default', e);
        }
      }
    }
  }, []);

  const setActiveMint = useCallback((address: string | null) => {
    setActiveMintState(address);
    if (typeof window !== 'undefined') {
      if (address) {
        window.localStorage.setItem(STORAGE_KEY, address);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  return { activeMint, setActiveMint };
}
