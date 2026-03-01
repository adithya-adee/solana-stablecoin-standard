import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { PublicKey } from '@solana/web3.js';
import { BorshCoder, EventParser } from '@coral-xyz/anchor';
import { SssCoreIdl, SSS_CORE_PROGRAM_ID } from '@stbr/sss-token';
import { Header, Spinner, Err, Card, Table } from '../components/ui.js';
import { loadProvider, formatAmount } from '../utils/config.js';

interface AuditLogOptions {
  mint: string;
  limit?: string;
}

interface LogInfo {
  signature: string;
  event: string;
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

        const sssCoder = new BorshCoder(SssCoreIdl as any);
        const eventParser = new EventParser(SSS_CORE_PROGRAM_ID, sssCoder);

        const signatures = await provider.connection.getSignaturesForAddress(mint, { limit });

        const txs: (import('@solana/web3.js').VersionedTransactionResponse | null)[] = [];
        for (const sigInfo of signatures) {
          const tx = await provider.connection.getTransaction(sigInfo.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed',
          });
          txs.push(tx);
          await new Promise((r) => setTimeout(r, 100)); // Sleep 100ms to avoid rate limits
        }

        const parsedLogs: LogInfo[] = [];

        for (let i = 0; i < txs.length; i++) {
          const tx = txs[i];
          const sig = signatures[i].signature;
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
              break; // Take the first parsed event found
            }
          }
          parsedLogs.push({ signature: sig, event: eventStr });
        }

        setLogs(parsedLogs);
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
      {phase === 'running' && <Spinner label="Fetching/parsing transaction signatures..." />}
      {phase === 'done' && (
        <Card title="Transactions (Recent first)">
          <Table
            rows={logs.map((l) => ({
              key: l.signature.slice(0, 24) + '...',
              value: l.event,
            }))}
          />
        </Card>
      )}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
