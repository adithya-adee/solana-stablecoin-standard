import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Theme, Icons } from '../utils/theme.js';
import { loadProvider } from '../utils/config.js';

interface StatusBarProps {
  refreshRateMs?: number;
  lastRefresh?: Date;
}

function truncate(str: string, len: number) {
  if (str.length <= len) return str;
  return str.slice(0, len) + '…';
}

export function StatusBar({ refreshRateMs, lastRefresh }: StatusBarProps) {
  const [wallet, setWallet] = useState<string>('Unknown');
  const cluster = process.env.SOLANA_CLUSTER ?? 'devnet';

  useEffect(() => {
    try {
      const provider = loadProvider();
      setWallet(provider.publicKey?.toBase58() ?? 'Unknown');
    } catch {}
  }, []);

  return (
    <Box marginTop={1} paddingTop={1} borderStyle="single" borderTop borderColor="gray">
      <Box flexGrow={1} flexDirection="row" gap={2}>
        <Box>
          <Text color={Theme.dim as any}>{Icons.key} </Text>
          <Text color={Theme.text as any}>{truncate(wallet, 8)}</Text>
        </Box>
        <Box>
          <Text color={Theme.dim as any}>Net: </Text>
          <Text
            color={(cluster === 'mainnet-beta' ? Theme.warning : Theme.text) as any}
            bold={cluster === 'mainnet-beta'}
          >
            {cluster}
          </Text>
        </Box>

        {refreshRateMs !== undefined && (
          <Box>
            <Text color={Theme.dim as any}>
              ⟳ {lastRefresh ? lastRefresh.toLocaleTimeString() : '...'}
            </Text>
            <Text color={Theme.dim as any}> ({Math.round(refreshRateMs / 1000)}s)</Text>
          </Box>
        )}
      </Box>

      <Box>
        <Text color={Theme.dim as any}>? help    q quit</Text>
      </Box>
    </Box>
  );
}
