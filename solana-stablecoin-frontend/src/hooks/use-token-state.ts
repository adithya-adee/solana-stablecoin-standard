'use client';

import { useEffect, useState, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useAnchorProvider } from './use-anchor-provider';
import { TokenService, type TokenStateExtended } from '@/lib/services/token-service';

export type { TokenStateExtended as TokenState };

export function useTokenState(mintAddress: string | null) {
  const { connection } = useConnection();
  const provider = useAnchorProvider();
  const [data, setData] = useState<TokenStateExtended | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!mintAddress) {
      setData(null);
      return;
    }

    // Validate mint address format before RPC call
    try {
      new PublicKey(mintAddress);
    } catch {
      setError('Invalid address format. Base58 addresses cannot contain 0, O, I, or l.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const state = await TokenService.fetchTokenState(
        connection,
        mintAddress,
        provider || undefined,
      );
      setData(state);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch config';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mintAddress, connection, provider]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
