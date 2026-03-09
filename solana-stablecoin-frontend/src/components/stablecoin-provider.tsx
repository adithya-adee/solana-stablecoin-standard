'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

const STORAGE_KEY = 'sss-active-mint';
const HISTORY_KEY = 'sss-mint-history';

interface StablecoinContextType {
  activeMint: string | null;
  setActiveMint: (address: string | null) => void;
}

const StablecoinContext = createContext<StablecoinContextType | undefined>(undefined);

export function StablecoinProvider({ children }: { children: ReactNode }) {
  const { connected } = useWallet();
  const [activeMint, setActiveMintState] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored !== 'null' && stored !== 'undefined') {
      Promise.resolve().then(() => setActiveMintState(stored));
    } else {
      const history = localStorage.getItem(HISTORY_KEY);
      if (history) {
        try {
          const parsed = JSON.parse(history);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].address) {
            Promise.resolve().then(() => setActiveMintState(parsed[0].address));
          }
        } catch (e) {
          console.error('Failed to parse mint history for default', e);
        }
      }
    }
  }, []); // Empty dependency array means this runs once on mount

  const setActiveMint = useCallback((address: string | null) => {
    setActiveMintState(address);
    if (address) {
      localStorage.setItem(STORAGE_KEY, address);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <StablecoinContext.Provider
      value={{ activeMint: connected ? activeMint : null, setActiveMint }}
    >
      {children}
    </StablecoinContext.Provider>
  );
}

export function useStablecoinContext() {
  const context = useContext(StablecoinContext);
  if (context === undefined) {
    throw new Error('useStablecoinContext must be used within a StablecoinProvider');
  }
  return context;
}
