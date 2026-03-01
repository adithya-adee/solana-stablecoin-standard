import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, AccountLayout } from '@solana/spl-token';
import { Header, Spinner, Err, Card, Table } from '../components/ui.js';
import { loadProvider, formatAmount } from '../utils/config.js';

interface HoldersOptions {
  mint: string;
  minBalance?: string;
}

interface HolderInfo {
  address: string;
  amount: bigint;
  isFrozen: boolean;
}

export default function Holders({ options }: { options: HoldersOptions }) {
  const [phase, setPhase] = useState<'running' | 'done' | 'error'>('running');
  const [holders, setHolders] = useState<HolderInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const minBalance = BigInt(options.minBalance ?? '0');

        const largestAccounts = await provider.connection.getTokenLargestAccounts(mint);

        setTotal(largestAccounts.value.length);

        const validAccounts = largestAccounts.value.filter((a) => BigInt(a.amount) > minBalance);

        const accountPubkeys = validAccounts.map((a) => a.address);
        const accountInfos = await provider.connection.getMultipleAccountsInfo(accountPubkeys);

        const parsed: HolderInfo[] = [];

        for (let i = 0; i < validAccounts.length; i++) {
          const info = accountInfos[i];
          if (!info) continue;
          const layout = AccountLayout.decode(info.data);
          parsed.push({
            address: layout.owner.toBase58(),
            amount: layout.amount,
            isFrozen: layout.state === 2, // 2 = Frozen
          });
        }

        setHolders(parsed);
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
      {phase === 'running' && <Spinner label="Fetching token holders..." />}
      {phase === 'done' && (
        <Card title="Token Holders">
          <Text color="gray">
            Showing {holders.length} of {total} total holders.
          </Text>
          <Table
            rows={holders.map((h) => ({
              key: h.address,
              value: `${formatAmount(h.amount)} ${h.isFrozen ? '(Frozen)' : ''}`,
            }))}
          />
        </Card>
      )}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
