import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner, Card, Err, Divider, PageInfo } from '../components/ui.js';
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
  isAuthority: boolean;
  roles: string[];
}

export function MyTokensPanel({ onMintChange, setRefreshRate }: MyTokensPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [filterMode, setFilterMode] = useState<'all' | 'authority' | 'roles' | 'involved'>(
    'involved',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setRefreshRate(30000);
    return () => setRefreshRate(undefined);
  }, [setRefreshRate]);

  const fetcher = React.useCallback(async () => {
    const provider = loadProvider();
    const program = new Program(SssCoreIdl as any, provider) as unknown as Program<SssCore>;

    const [allConfigs, userRoles] = await Promise.all([
      program.account.stablecoinConfig.all(),
      program.account.roleAccount.all([
        { memcmp: { offset: 40, bytes: provider.publicKey.toBase58() } },
      ]),
    ]);

    const rolesByMint: Record<string, string[]> = {};
    userRoles.forEach((r: any) => {
      const mintStr = r.account.config.toBase58();
      if (!rolesByMint[mintStr]) rolesByMint[mintStr] = [];
      const roleName = Object.keys(r.account.role)[0]!;
      rolesByMint[mintStr]!.push(roleName.charAt(0).toUpperCase() + roleName.slice(1));
    });

    const myTokens = allConfigs.map((conf: any) => {
      const mintStr = conf.account.mint.toBase58();
      const cleanName = String(conf.account.name).replace(/\0/g, '').trim();
      const cleanSymbol = String(conf.account.symbol).replace(/\0/g, '').trim();

      return {
        mint: mintStr,
        name: cleanName || 'Unknown Token',
        symbol: cleanSymbol || '???',
        preset: conf.account.preset,
        isAuthority: conf.account.authority.equals(provider.publicKey!),
        roles: rolesByMint[mintStr] || [],
      };
    });

    return myTokens;
  }, []);

  const { data: rawData, loading, error } = usePolling(fetcher, 30000);

  const data = useMemo(() => {
    if (!rawData) return null;

    // 1. Filter by relationship
    let filtered = rawData.filter((t: any) => {
      if (filterMode === 'all') return true;
      if (filterMode === 'authority') return t.isAuthority;
      if (filterMode === 'roles') return t.roles.length > 0;
      return t.isAuthority || t.roles.length > 0; // 'involved'
    });

    // 2. Filter by search query
    if (searchQuery) {
      try {
        const regex = new RegExp(searchQuery, 'i');
        filtered = filtered.filter((t: any) => regex.test(t.name) || regex.test(t.symbol));
      } catch (e) {
        filtered = filtered.filter(
          (t: any) =>
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.symbol.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      }
    }

    return filtered;
  }, [rawData, filterMode, searchQuery]);

  useInput((input, key) => {
    if (!data) return;

    if (isSearching) {
      if (key.escape || key.return) {
        setIsSearching(false);
      } else if (key.backspace || key.delete) {
        setSearchQuery((q) => q.slice(0, -1));
        setSelectedIndex(0);
        setPage(1);
      } else if (input) {
        setSearchQuery((q) => q + input);
        setSelectedIndex(0);
        setPage(1);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((i) => (i > 0 ? i - 1 : i));
    } else if (key.downArrow) {
      const pageData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      setSelectedIndex((i) => (i < pageData.length - 1 ? i + 1 : i));
    } else if (input === 'n') {
      if (page * PAGE_SIZE < data.length) {
        setPage(page + 1);
        setSelectedIndex(0);
      }
    } else if (input === 'p') {
      if (page > 1) {
        setPage(page - 1);
        setSelectedIndex(0);
      }
    } else if (input === 'f') {
      setFilterMode((curr) => {
        if (curr === 'involved') return 'all';
        if (curr === 'all') return 'authority';
        if (curr === 'authority') return 'roles';
        return 'involved';
      });
      setSelectedIndex(0);
      setPage(1);
    } else if (input === '/') {
      setIsSearching(true);
    } else if (key.return) {
      const pageData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      const selected = pageData[selectedIndex];
      if (selected) {
        onMintChange(selected.mint);
      }
    }
  });

  if (loading && !data) return <Spinner label="Scanning blockchain for your tokens..." />;
  if (error && !data) return <Err message={error} />;
  if (!data) return <Text>No data</Text>;

  const pageData = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(data.length / PAGE_SIZE);

  return (
    <Box flexDirection="column" gap={1}>
      <Card
        title={`Tokens (${filterMode === 'involved' ? 'All Managed' : filterMode.toUpperCase()})`}
      >
        {isSearching && (
          <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
            <Text color="cyanBright">{Icons.search} Regex Search: </Text>
            <Text color="white" bold>
              {searchQuery}
            </Text>
            <Text color="gray">_</Text>
          </Box>
        )}
        {data.length === 0 ? (
          <Box marginY={1}>
            <Text color={Theme.dim as any}>No tokens match your filters.</Text>
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
              <Box width={20}>
                <Text color={Theme.dim as any} bold>
                  Your Relationship
                </Text>
              </Box>
              <Box>
                <Text color={Theme.dim as any} bold>
                  Mint Address
                </Text>
              </Box>
            </Box>

            {pageData.map((token: TokenInfo, idx: number) => {
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
                      Tier {token.preset}
                    </Text>
                  </Box>
                  <Box width={20}>
                    <Text color={isSelected ? 'white' : 'gray'}>
                      {token.isAuthority ? 'Authority ' : ''}
                      {token.roles.length > 0 ? `[${token.roles.join(', ')}]` : ''}
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
        <Box marginTop={1}>
          <PageInfo page={page} pageSize={PAGE_SIZE} hasMore={page * PAGE_SIZE < data.length} />
        </Box>
      </Card>

      {data && (
        <Box flexDirection="column" gap={0}>
          <Text color="gray">
            Selection: [↑/↓] navigate, [Enter] select active mint. [/] regex search. [f] filter:{' '}
            {filterMode}.
          </Text>
          {isSearching && (
            <Text color="cyanBright">SEARCH MODE ACTIVE - Press Esc/Enter to finish</Text>
          )}
          <Text color="gray">Pagination: [n] next page, [p] previous page.</Text>
        </Box>
      )}
    </Box>
  );
}
