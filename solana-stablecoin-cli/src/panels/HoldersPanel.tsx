import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Spinner, Card, Table, Err } from '../components/ui.js';
import { loadProvider, formatAmount } from '../utils/config.js';
import { PublicKey } from '@solana/web3.js';
import { AccountLayout } from '@solana/spl-token';
import { usePolling } from '../hooks/usePolling.js';

interface HoldersPanelProps {
  mint: string | undefined;
  setRefreshRate: (ms: number | undefined) => void;
}

interface HolderInfo {
  address: string;
  amount: bigint;
  isFrozen: boolean;
}

export function HoldersPanel({ mint, setRefreshRate }: HoldersPanelProps) {
  useEffect(() => {
    setRefreshRate(10000);
    return () => setRefreshRate(undefined);
  }, [setRefreshRate]);

  const fetcher = React.useCallback(async () => {
    if (!mint) throw new Error('No mint defined');
    const provider = loadProvider();
    const mintPub = new PublicKey(mint);

    const largestAccounts = await provider.connection.getTokenLargestAccounts(mintPub);
    const validAccounts = largestAccounts.value.filter((a) => BigInt(a.amount) > 0n);

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
        isFrozen: layout.state === 2,
      });
    }
    return { holders: parsed, total: validAccounts.length };
  }, [mint]);

  const { data, loading, error } = usePolling(fetcher, mint ? 10000 : null);

  if (!mint) return <Err message="No mint configured." />;
  if (loading && !data) return <Spinner label="Fetching token holders..." />;
  if (error && !data) return <Err message={error} />;
  if (!data) return <Text>No data</Text>;

  return (
    <Box flexDirection="column" gap={1}>
      <Card title="Token Holders (Top Tokenizer Accounts)">
        <Text color="gray">
          Showing {data.holders.length} of {data.total} total holders.
        </Text>
        <Table
          rows={data.holders.map((h) => ({
            key: h.address,
            value: `${formatAmount(h.amount)} ${h.isFrozen ? '(Frozen)' : ''}`,
            highlight: h.isFrozen,
          }))}
        />
      </Card>
      <Box>
        <Text color="gray">Holders automatically refresh every 10 seconds.</Text>
      </Box>
    </Box>
  );
}
