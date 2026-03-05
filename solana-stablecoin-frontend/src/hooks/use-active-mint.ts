'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

const STORAGE_KEY = 'sss-active-mint';

export function useActiveMint() {
  const { connected } = useWallet();
  const [activeMint, setActiveMintState] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored !== 'null' && stored !== 'undefined') {
      setActiveMintState(stored);
    } else {
      // Smart default: check sss-mint-history
      const history = localStorage.getItem('sss-mint-history');
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
    if (address) {
      localStorage.setItem(STORAGE_KEY, address);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return { activeMint: connected ? activeMint : null, setActiveMint };
}
