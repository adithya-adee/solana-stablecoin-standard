import React from 'react';
import { Box, Text } from 'ink';
import { Spinner, Card, Table, Err } from '../components/ui.js';
import { useSss } from '../hooks/useSss.js';
import { usePolling } from '../hooks/usePolling.js';
import { formatAmount } from '../utils/config.js';

interface DashboardPanelProps {
  mint: string | undefined;
  setRefreshRate: (ms: number | undefined) => void;
  setLastRefresh: (date: Date) => void;
}

export function DashboardPanel({ mint, setRefreshRate, setLastRefresh }: DashboardPanelProps) {
  const { sss, loading: sssLoading, error: sssError } = useSss(mint);

  const fetcher = React.useCallback(async () => {
    if (!sss) throw new Error('SSS not initialized');
    return await sss.info();
  }, [sss]);

  const { data, loading, error, lastRefresh } = usePolling(fetcher, sss ? 5000 : null);

  React.useEffect(() => {
    setRefreshRate(sss ? 5000 : undefined);
    return () => setRefreshRate(undefined);
  }, [sss, setRefreshRate]);

  React.useEffect(() => {
    if (lastRefresh) setLastRefresh(lastRefresh);
  }, [lastRefresh, setLastRefresh]);

  if (!mint) return <Err message="No mint configured. Go to Config tab to init or set one." />;
  if (sssLoading) return <Spinner label="Loading SDK..." />;
  if (sssError) return <Err message={sssError} />;

  if (loading && !data) return <Spinner label="Loading dashboard data..." />;
  if (error && !data) return <Err message={error} />;
  if (!data) return <Text>No data</Text>;

  return (
    <Box flexDirection="column" gap={1}>
      <Card title="Stablecoin Status">
        <Table
          rows={[
            { key: 'Mint', value: data.mint?.toBase58?.() ?? mint },
            { key: 'Preset', value: String(data.preset).toUpperCase(), highlight: true },
            { key: 'Authority', value: data.authority?.toBase58?.() ?? '—' },
            { key: 'Paused', value: data.paused ? 'YES' : 'No', highlight: data.paused },
          ]}
        />
      </Card>

      <Card title="Supply Overview">
        <Table
          rows={[
            { key: 'Total Minted', value: formatAmount(data.totalMinted) },
            { key: 'Total Burned', value: formatAmount(data.totalBurned) },
            { key: 'Current Supply', value: formatAmount(data.currentSupply) },
            { key: 'Supply Cap', value: data.supplyCap ? formatAmount(data.supplyCap) : '∞' },
            {
              key: 'Utilization',
              value: data.supplyCap
                ? `${((Number(data.currentSupply) / Number(data.supplyCap)) * 100).toFixed(1)}%`
                : '—',
            },
          ]}
        />
      </Card>
      
      {/* We could add Recent Activity here later if we want to parse the last 5 logs inline */}
    </Box>
  );
}
