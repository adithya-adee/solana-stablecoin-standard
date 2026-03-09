'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'sss-mint-history';

export interface HistoryItem {
  address: string;
  name?: string;
  symbol?: string;
  presetName?: string;
  timestamp: number;
}

export function useMintHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        Promise.resolve().then(() => setHistory(parsed));
      } catch (e) {
        console.error('Failed to parse mint history', e);
      }
    }
  }, []);

  const addMint = useCallback(
    (address: string, metadata?: { name?: string; symbol?: string; presetName?: string }) => {
      setHistory((prev) => {
        // Remove if already exists to move it to the top
        const filtered = prev.filter((item) => item.address !== address);
        const newItem: HistoryItem = {
          address,
          timestamp: Date.now(),
          ...metadata,
        };
        const updated = [newItem, ...filtered].slice(0, 10);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [],
  );

  const removeMint = useCallback((address: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.address !== address);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { history, addMint, removeMint };
}
