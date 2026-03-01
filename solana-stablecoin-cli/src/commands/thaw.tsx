import React, { useEffect, useState } from 'react';
import { Box } from 'ink';
import { SSS } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Header, Spinner, Success, Err } from '../components/ui.js';
import { loadProvider } from '../utils/config.js';

interface ThawOptions {
  mint: string;
  address: string;
}

export default function Thaw({ options }: { options: ThawOptions }) {
  const [phase, setPhase] = useState<'running' | 'confirming' | 'done' | 'error'>('running');
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

        const txSig = await sss.thaw(ata);
        setSig(txSig);
        setPhase('confirming');

        const latestBlockHash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: txSig,
        });

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
      {phase === 'running' && <Spinner label={`Thawing ${options.address.slice(0, 8)}...`} />}
      {phase === 'confirming' && <Spinner label="Confirming transaction..." />}
      {phase === 'done' && <Success label="Account thawed" value={sig} />}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
