import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner, Card, Table, Err, PageInfo } from '../components/ui.js';
import { loadProvider, formatAmount } from '../utils/config.js';
import { PublicKey } from '@solana/web3.js';
import { BorshCoder, EventParser } from '@coral-xyz/anchor';
import { SssCoreIdl, STBL_CORE_PROGRAM_ID } from '@stbr/sss-token';
import { usePolling } from '../hooks/usePolling.js';

interface AuditLogPanelProps {
  mint: string | undefined;
  setRefreshRate: (ms: number | undefined) => void;
}

interface LogInfo {
  signature: string;
  event: string;
}

export function AuditLogPanel({ mint, setRefreshRate }: AuditLogPanelProps) {
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const PAGE_SIZE = 25;

  useEffect(() => {
    // Only auto-refresh if we are on the first page
    setRefreshRate(page === 1 ? 10000 : undefined);
    return () => setRefreshRate(undefined);
  }, [setRefreshRate, page]);

  const fetcher = React.useCallback(async () => {
    if (!mint) throw new Error('No mint defined');
    const provider = loadProvider();
    const mintPub = new PublicKey(mint);

    const sssCoder = new BorshCoder(SssCoreIdl as any);
    const eventParser = new EventParser(STBL_CORE_PROGRAM_ID, sssCoder);

    const beforeCursor = cursors[page - 1];
    const signatures = await provider.connection.getSignaturesForAddress(mintPub, {
      limit: PAGE_SIZE,
      before: beforeCursor,
    });

    if (signatures.length === PAGE_SIZE) {
      setCursors((prev) => {
        const next = [...prev];
        next[page] = signatures[signatures.length - 1]!.signature;
        return next;
      });
    }

    const txs = await Promise.all(
      signatures.map((sig) =>
        provider.connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        }),
      ),
    );

    const parsedLogs: LogInfo[] = [];

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const sig = signatures[i]!.signature;
      let eventStr = 'System / Unknown Tx';

      if (tx && tx.meta && tx.meta.logMessages) {
        for (const event of eventParser.parseLogs(tx.meta.logMessages)) {
          if (event.name === 'TokensMinted') {
            eventStr = `Minted ${formatAmount(BigInt((event.data as any).amount.toString()))} to ${(event.data as any).to.toString().slice(0, 8)}`;
          } else if (event.name === 'TokensBurned') {
            eventStr = `Burned ${formatAmount(BigInt((event.data as any).amount.toString()))} from ${(event.data as any).from.toString().slice(0, 8)}`;
          } else if (event.name === 'RoleGranted') {
            const roleType = Object.keys((event.data as any).role)[0];
            eventStr = `Granted ${roleType} to ${(event.data as any).account.toString().slice(0, 8)}`;
          } else if (event.name === 'RoleRevoked') {
            const roleType = Object.keys((event.data as any).role)[0];
            eventStr = `Revoked ${roleType} from ${(event.data as any).account.toString().slice(0, 8)}`;
          } else if (event.name === 'StablecoinInitialized') {
            eventStr = `Initialized ${(event.data as any).symbol}`;
          } else {
            eventStr = event.name;
          }
          break; // Take the first parsed event
        }
      }
      parsedLogs.push({ signature: sig, event: eventStr });
    }

    return parsedLogs;
  }, [mint, page, cursors]);

  const { data, loading, error } = usePolling(fetcher, mint && page === 1 ? 10000 : null);

  useInput((input) => {
    if (input === 'n' && data && data.length === PAGE_SIZE) {
      setPage((p) => p + 1);
    } else if (input === 'p' && page > 1) {
      setPage((p) => p - 1);
    }
  });

  if (!mint) return <Err message="No mint configured." />;
  if (loading && !data) return <Spinner label="Fetching audit log..." />;
  if (error && !data) return <Err message={error} />;
  if (!data) return <Text>No data</Text>;

  return (
    <Box flexDirection="column" gap={1}>
      <Card title="Recent Transactions">
        <Table
          rows={data.map((l) => ({
            key: l.signature.slice(0, 24) + '...',
            value: l.event,
          }))}
        />
        <PageInfo page={page} pageSize={PAGE_SIZE} hasMore={data.length === PAGE_SIZE} />
      </Card>
      <Box>
        <Text color="gray">
          {page === 1
            ? 'Log automatically refreshes every 10 seconds.'
            : 'Auto-refresh paused while viewing older pages.'}
        </Text>
      </Box>
    </Box>
  );
}
