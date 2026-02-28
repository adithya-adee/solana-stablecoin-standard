import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SSS } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { Header, Spinner, Err, Card } from '../components/ui.js';
import { loadProvider, formatAmount } from '../utils/config.js';

interface SupplyOptions {
  mint: string;
}

export default function Supply({ options }: { options: SupplyOptions }) {
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
      {!data && !error && <Spinner label="Fetching supply data..." />}
      {data && (
        <Card title="Supply Overview">
          <Box marginBottom={1}>
            <Text color="cyanBright" bold>
              {'─'.repeat(34)}
            </Text>
          </Box>
          <Box>
            <Text color="gray">{'Total Minted'.padEnd(16)}</Text>
            <Text color="greenBright" bold>
              {formatAmount(data.totalMinted)}
            </Text>
          </Box>
          <Box>
            <Text color="gray">{'Total Burned'.padEnd(16)}</Text>
            <Text color="redBright" bold>
              {formatAmount(data.totalBurned)}
            </Text>
          </Box>
          <Box>
            <Text color="gray">{'Current Supply'.padEnd(16)}</Text>
            <Text color="white" bold>
              {formatAmount(data.currentSupply)}
            </Text>
          </Box>
          <Box>
            <Text color="gray">{'Supply Cap'.padEnd(16)}</Text>
            <Text color="yellowBright" bold>
              {data.supplyCap ? formatAmount(data.supplyCap) : '∞'}
            </Text>
          </Box>
          {data.supplyCap && data.currentSupply && (
            <Box marginTop={1}>
              <Text color="gray">Utilization </Text>
              <Text color="white">
                {((Number(data.currentSupply) / Number(data.supplyCap)) * 100).toFixed(1)}%
              </Text>
            </Box>
          )}
        </Card>
      )}
      {error && <Err message={error} />}
    </Box>
  );
}
