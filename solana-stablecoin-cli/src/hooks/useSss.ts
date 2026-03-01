import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';
import { SSS } from '@stbr/sss-token';
import { loadProvider } from '../utils/config.js';

export function useSss(mintAddress: string | undefined) {
  const [sss, setSss] = useState<SSS | null>(null);
  const [provider, setProvider] = useState<AnchorProvider | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const prov = loadProvider();
        if (active) setProvider(prov);

        if (mintAddress) {
          const mint = new PublicKey(mintAddress);
          const sssInstance = await SSS.load(prov, mint as any);
          if (active) setSss(sssInstance);
        } else {
          if (active) setSss(null);
        }
      } catch (e: any) {
        if (active) setError(e.message ?? String(e));
      } finally {
        if (active) setLoading(false);
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [mintAddress]);

  return { sss, provider, loading, error };
}
