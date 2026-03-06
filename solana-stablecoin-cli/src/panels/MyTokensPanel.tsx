import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner, Card, Err, Divider } from '../components/ui.js';
import { loadProvider } from '../utils/config.js';
import { Program } from '@coral-xyz/anchor';
import { SssCore, SssCoreIdl, STBL_CORE_PROGRAM_ID } from '@stbr/sss-token';
import { usePolling } from '../hooks/usePolling.js';
import { Theme, Icons } from '../utils/theme.js';

interface MyTokensPanelProps {
  onMintChange: (mint: string) => void;
  setRefreshRate: (ms: number | undefined) => void;
}

interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  preset: number;
}

export function MyTokensPanel({ onMintChange, setRefreshRate }: MyTokensPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setRefreshRate(30000);
    return () => setRefreshRate(undefined);
  }, [setRefreshRate]);

  const fetcher = React.useCallback(async () => {
    const provider = loadProvider();
    const program = new Program(SssCoreIdl as any, provider) as unknown as Program<SssCore>;

    const allConfigs = await program.account.stablecoinConfig.all();

    // Filter by current wallet authority
    const myTokens = allConfigs
      .filter((conf: any) => conf.account.authority.equals(provider.publicKey!))
      .map((conf: any) => {
        // clean strings from null bytes
        const cleanName = String(conf.account.name).replace(/\0/g, '').trim();
        const cleanSymbol = String(conf.account.symbol).replace(/\0/g, '').trim();

        return {
          mint: conf.account.mint.toBase58(),
          name: cleanName || 'Unknown Token',
          symbol: cleanSymbol || '???',
          preset: conf.account.preset,
        };
      });

    return myTokens;
  }, []);

  const { data, loading, error } = usePolling(fetcher, 30000);

  useInput((input, key) => {
    if (!data) return;

    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < data.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (key.return) {
      const selected = data[selectedIndex];
      if (selected) {
        onMintChange(selected.mint);
      }
    }
  });

  if (loading && !data) return <Spinner label="Scanning blockchain for your tokens..." />;
  if (error && !data) return <Err message={error} />;
  if (!data) return <Text>No data</Text>;

  return (
    <Box flexDirection="column" gap={1}>
      <Card title="My Tokens (Created by Wallet)">
        {data.length === 0 ? (
          <Box marginY={1}>
            <Text color={Theme.dim as any}>No tokens found created by this wallet.</Text>
          </Box>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            <Box flexDirection="row" marginBottom={1}>
              <Box width={4} />
              <Box width={30}>
                <Text color={Theme.dim as any} bold>
                  Name
                </Text>
              </Box>
              <Box width={15}>
                <Text color={Theme.dim as any} bold>
                  Symbol
                </Text>
              </Box>
              <Box width={15}>
                <Text color={Theme.dim as any} bold>
                  Preset
                </Text>
              </Box>
              <Box>
                <Text color={Theme.dim as any} bold>
                  Mint Address
                </Text>
              </Box>
            </Box>

            {data.map((token: TokenInfo, idx: number) => {
              const isSelected = idx === selectedIndex;
              return (
                <Box key={token.mint} flexDirection="row">
                  <Box width={4}>
                    <Text color={(isSelected ? Theme.highlight : 'black') as any}>
                      {isSelected ? Icons.arrow : ' '}
                    </Text>
                  </Box>
                  <Box width={30}>
                    <Text color={(isSelected ? Theme.text : Theme.dim) as any} bold={isSelected}>
                      {token.name}
                    </Text>
                  </Box>
                  <Box width={15}>
                    <Text color={(isSelected ? Theme.text : Theme.dim) as any}>{token.symbol}</Text>
                  </Box>
                  <Box width={15}>
                    <Text color={(isSelected ? Theme.highlight : Theme.dim) as any}>
                      Type {token.preset}
                    </Text>
                  </Box>
                  <Box>
                    <Text color={(isSelected ? Theme.text : Theme.dim) as any}>{token.mint}</Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Card>

      {data.length > 0 && (
        <Box>
          <Text color="gray">Use ↑/↓ to navigate, Enter to select active mint.</Text>
        </Box>
      )}
    </Box>
  );
}
