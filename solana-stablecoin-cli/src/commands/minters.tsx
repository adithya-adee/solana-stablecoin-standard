import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SSS, roleType, roleId } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { Header, Spinner, Success, Err, Card, Table } from '../components/ui.js';
import { loadProvider } from '../utils/config.js';

type MinterAction = 'list' | 'add' | 'remove';

interface MintersOptions {
  mint: string;
  action: MinterAction;
  address?: string;
}

export default function Minters({ options }: { options: MintersOptions }) {
  const [phase, setPhase] = useState<'running' | 'confirming' | 'done' | 'error'>('running');
  const [sig, setSig] = useState('');
  const [isMinter, setIsMinter] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const sss = await SSS.load(provider, mint as any);

        if (options.action === 'list') {
          if (!options.address) {
            throw new Error('--address is required for this action');
          }
          const addr = new PublicKey(options.address);
          const hasRole = await sss.roles.check(addr, roleType('minter'));
          setIsMinter(hasRole);
        } else {
          if (!options.address) {
            throw new Error('--address is required for this action');
          }
          const addr = new PublicKey(options.address);
          const role = roleType('minter');
          if (options.action === 'add') {
            const txSig = await sss.roles.grant(addr, role);
            setSig(txSig);
            setPhase('confirming');
            const latestBlockHash = await provider.connection.getLatestBlockhash();
            await provider.connection.confirmTransaction({
              blockhash: latestBlockHash.blockhash,
              lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
              signature: txSig,
            });
          } else if (options.action === 'remove') {
            const txSig = await sss.roles.revoke(addr, role);
            setSig(txSig);
            setPhase('confirming');
            const latestBlockHash = await provider.connection.getLatestBlockhash();
            await provider.connection.confirmTransaction({
              blockhash: latestBlockHash.blockhash,
              lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
              signature: txSig,
            });
          }
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
      {phase === 'running' && <Spinner label={`Minters: ${options.action}...`} />}
      {phase === 'confirming' && <Spinner label="Confirming transaction..." />}
      {phase === 'done' && options.action === 'list' && (
        <Card title="Minter Check">
          <Text>
            {options.address} {isMinter ? 'is' : 'is not'} a minter.
          </Text>
        </Card>
      )}
      {phase === 'done' && options.action !== 'list' && (
        <Success label={`Minter ${options.action}ed`} value={sig} />
      )}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
