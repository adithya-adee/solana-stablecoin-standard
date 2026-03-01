import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { PublicKey } from '@solana/web3.js';
import { Header, Spinner, Err, Card, Table } from '../components/ui.js';
import { loadProvider } from '../utils/config.js';

interface AuditLogOptions {
  mint: string;
  limit?: string;
}

interface LogInfo {
  signature: string;
}

export default function AuditLog({ options }: { options: AuditLogOptions }) {
  const [phase, setPhase] = useState<'running' | 'done' | 'error'>('running');
  const [logs, setLogs] = useState<LogInfo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const limit = parseInt(options.limit ?? '20', 10);

        const signatures = await provider.connection.getSignaturesForAddress(
          mint,
          { limit },
        );

        setLogs(signatures.map(s => ({ signature: s.signature })));
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
      {phase === 'running' && <Spinner label="Fetching transaction signatures..." />}
      {phase === 'done' && (
        <Card title="Transaction Signatures">
          <Table
            rows={logs.map(l => ({
              key: l.signature,
              value: ' ',
            }))}
          />
        </Card>
      )}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
