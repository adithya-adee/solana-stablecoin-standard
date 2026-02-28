import React, { useEffect, useState } from 'react';
import { Box } from 'ink';
import { SSS } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { Header, Spinner, Success, Err } from '../components/ui.js';
import { loadProvider } from '../utils/config.js';

interface PauseOptions {
  mint: string;
  unpause?: boolean;
}

export default function Pause({ options }: { options: PauseOptions }) {
  const action = options.unpause ? 'unpause' : 'pause';
  const [phase, setPhase] = useState<'running' | 'done' | 'error'>('running');
  const [sig, setSig] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const sss = await SSS.load(provider, mint as any);
        const tx = options.unpause ? await sss.unpause() : await sss.pause();
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
      {phase === 'running' && (
        <Spinner label={`${action === 'pause' ? 'Pausing' : 'Unpausing'} stablecoin...`} />
      )}
      {phase === 'done' && (
        <Success label={action === 'pause' ? 'Paused' : 'Unpaused'} value={sig} />
      )}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
