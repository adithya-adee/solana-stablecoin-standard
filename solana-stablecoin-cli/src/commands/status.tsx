import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SSS } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { Header, Spinner, Success, Err, Card, Table, Badge, Row } from '../components/ui.js';
import { loadProvider, formatAmount } from '../utils/config.js';

interface StatusOptions {
  mint: string;
}

export default function Status({ options }: { options: StatusOptions }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const sss = await SSS.load(provider, mint as any);
        setData(await sss.info());
      } catch (e: any) {
        setError(e.message ?? String(e));
      }
    })();
  }, []);

  return (
    <Box flexDirection="column">
      <Header />
      {!data && !error && <Spinner label="Fetching status..." />}
      {data && (
        <Card title="Stablecoin Status">
          <Table
            rows={[
              { key: 'Mint', value: data.mint?.toBase58?.() ?? options.mint },
              { key: 'Preset', value: String(data.preset).toUpperCase(), highlight: true },
              { key: 'Authority', value: data.authority?.toBase58?.() ?? '—' },
              { key: 'Total Minted', value: formatAmount(data.totalMinted) },
              { key: 'Total Burned', value: formatAmount(data.totalBurned) },
              { key: 'Current Supply', value: formatAmount(data.currentSupply) },
              { key: 'Supply Cap', value: data.supplyCap ? formatAmount(data.supplyCap) : '∞' },
              { key: 'Paused', value: data.paused ? 'YES' : 'No', highlight: data.paused },
            ]}
          />
        </Card>
      )}
      {error && <Err message={error} />}
    </Box>
  );
}
