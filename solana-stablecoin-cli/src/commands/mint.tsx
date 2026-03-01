import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SSS } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Header, Spinner, Success, Err, Card } from '../components/ui.js';
import { loadProvider, parseAmount, formatAmount } from '../utils/config.js';

interface MintOptions {
  mint: string;
  recipient: string;
  amount: string;
}

export default function Mint({ options }: { options: MintOptions }) {
  const [phase, setPhase] = useState<'running' | 'confirming' | 'done' | 'error'>('running');
  const [sig, setSig] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const recipient = new PublicKey(options.recipient);
        const sss = await SSS.load(provider, mint as any);
        const ata = getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_2022_PROGRAM_ID);
        const amount = parseAmount(options.amount);

        const txSig = await sss.mintTokens(ata, amount);
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
        <Spinner
          label={`Minting ${options.amount} tokens to ${options.recipient.slice(0, 8)}...`}
        />
      )}
      {phase === 'confirming' && <Spinner label="Confirming transaction..." />}
      {phase === 'done' && <Success label="Minted" value={sig} />}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
