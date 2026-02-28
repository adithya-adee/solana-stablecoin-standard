import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SSS } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { Header, Spinner, Success, Err, Card } from '../components/ui.js';
import { loadProvider } from '../utils/config.js';

type BlacklistAction = 'add' | 'remove' | 'check';

interface BlacklistOptions {
  mint: string;
  action: BlacklistAction | 'list';
  address?: string;
  reason?: string;
}

export default function Blacklist({ options }: { options: BlacklistOptions }) {
  const [phase, setPhase] = useState<'running' | 'done' | 'error'>('running');
  const [sig, setSig] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const sss = await SSS.load(provider, mint as any);

        if (options.action === 'list') {
          // SDK has no .list() — inform user to use an explorer or indexer
          setSig(
            'Use a Solana explorer or your own indexer to enumerate all blacklist PDA accounts for this mint.',
          );
          setPhase('done');
          return;
        }

        if (!options.address) throw new Error('--address is required');
        const addr = new PublicKey(options.address);

        if (options.action === 'add') {
          const reason = options.reason ?? '';
          setSig(await sss.blacklist.add(addr, reason));
        } else if (options.action === 'remove') {
          setSig(await sss.blacklist.remove(addr));
        } else {
          const isBlacklisted = await sss.blacklist.check(addr);
          setSig(
            isBlacklisted ? 'YES — address is blacklisted' : 'No — address is not blacklisted',
          );
        }
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
      {phase === 'running' && <Spinner label={`Blacklist: ${options.action}...`} />}
      {phase === 'done' && <Success label={`Blacklist: ${options.action}`} value={sig} />}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
