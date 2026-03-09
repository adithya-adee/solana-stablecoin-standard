'use client';

import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { StablecoinClient, type TokenMintKey } from '@stbr/sss-token';
import { useActiveMint } from './use-active-mint';
import { useAnchorProvider } from './use-anchor-provider';

export function useStablecoin() {
  const provider = useAnchorProvider();
  const { activeMint } = useActiveMint();
  const [client, setClient] = useState<StablecoinClient | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadClient() {
      if (!provider || !activeMint) {
        setClient(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const stablecoin = await StablecoinClient.load(
          provider,
          new PublicKey(activeMint) as TokenMintKey,
        );

        if (!cancelled) {
          setClient(stablecoin);
        }
      } catch (err) {
        console.error('Failed to load StablecoinClient:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load stablecoin');
          setClient(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadClient();

    return () => {
      cancelled = true;
    };
  }, [provider, activeMint]);

  return { client, loading, error };
}
