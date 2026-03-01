import React, { useEffect, useState } from 'react';
import { Box } from 'ink';
import { SSS } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Header, Spinner, Success, Err } from '../components/ui.js';
import { loadProvider, parseAmount } from '../utils/config.js';

interface SeizeOptions {
  mint: string;
  from: string;
  to: string;
  amount: string;
}

export default function Seize({ options }: { options: SeizeOptions }) {
  const [phase, setPhase] = useState<'running' | 'confirming' | 'done' | 'error'>('running');
  const [sig, setSig] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const from = new PublicKey(options.from);
        const to = new PublicKey(options.to);
        const sss = await SSS.load(provider, mint as any);
        const fromAta = getAssociatedTokenAddressSync(mint, from, false, TOKEN_2022_PROGRAM_ID);
        const toAta = getAssociatedTokenAddressSync(mint, to, false, TOKEN_2022_PROGRAM_ID);
        const amount = parseAmount(options.amount);

        const txSig = await sss.seize(fromAta, toAta, amount);
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
      {phase === 'running' && (
        <Spinner label={`Seizing funds from ${options.from.slice(0, 8)}...`} />
      )}
      {phase === 'confirming' && <Spinner label="Confirming transaction..." />}
      {phase === 'done' && <Success label="Seized" value={sig} />}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
