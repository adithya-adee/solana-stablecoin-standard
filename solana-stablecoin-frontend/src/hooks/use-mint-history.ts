'use client';

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'sss-mint-history';

export interface HistoryItem {
  address: string;
  timestamp: number;
}

export function useMintHistory() {
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse mint history', e);
        return [];
      }
    }
    return [];
  });

  const addMint = useCallback((address: string) => {
    setHistory((prev) => {
      // Remove if already exists to move it to the top
      const filtered = prev.filter((item) => item.address !== address);
      const updated = [{ address, timestamp: Date.now() }, ...filtered].slice(0, 10);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeMint = useCallback((address: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.address !== address);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { history, addMint, removeMint };
}
