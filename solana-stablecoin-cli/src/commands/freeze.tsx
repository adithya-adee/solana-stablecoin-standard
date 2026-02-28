import React, { useEffect, useState } from 'react';
import { Box } from 'ink';
import { SSS } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Header, Spinner, Success, Err } from '../components/ui.js';
import { loadProvider } from '../utils/config.js';

interface FreezeOptions {
  mint: string;
  address: string;
}

export default function Freeze({ options }: { options: FreezeOptions }) {
  const [phase, setPhase] = useState<'running' | 'done' | 'error'>('running');
  const [sig, setSig] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const target = new PublicKey(options.address);
        const sss = await SSS.load(provider, mint as any);
        const ata = getAssociatedTokenAddressSync(mint, target, false, TOKEN_2022_PROGRAM_ID);
        const tx = await sss.freeze(ata);
        setSig(tx);
        setPhase('done');
      } catch (e: any) {
        setError(e.message ?? String(e));
        setPhase('error');
      }
    })();
  }, []);

  return (
    <Box flexDirection="column">
      <Header />
      {phase === 'running' && <Spinner label={`Freezing ${options.address.slice(0, 8)}...`} />}
      {phase === 'done' && <Success label="Account frozen" value={sig} />}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
