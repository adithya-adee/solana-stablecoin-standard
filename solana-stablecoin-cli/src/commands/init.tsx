import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SSS } from '@stbr/sss-token';
import { Keypair, PublicKey } from '@solana/web3.js';
import { Header, Spinner, Success, Err, Card, Table, Badge, Row } from '../components/ui.js';
import { loadProvider, parseAmount, formatAmount } from '../utils/config.js';
import { preset as mkPreset } from '@stbr/sss-token';
import type { StablecoinCreateOptions } from '@stbr/sss-token';
import fs from 'fs';

type PresetChoice = 'sss-1' | 'sss-2' | 'sss-3';

interface InitOptions {
  preset?: PresetChoice;
  name: string;
  symbol: string;
  decimals?: string;
  supplyCap?: string;
  uri?: string;
  config?: string; // path to TOML/JSON custom config
  mint?: string; // optional keypair path
}

type Phase = 'idle' | 'creating' | 'done' | 'error';

export default function Init({ options }: { options: InitOptions }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [mintAddr, setMintAddr] = useState('');
  const [txSig, setTxSig] = useState('');
  const [error, setError] = useState('');
  const resolvedPreset: PresetChoice = options.preset ?? 'sss-1';

  useEffect(() => {
    setPhase('creating');
    (async () => {
      try {
        const provider = loadProvider();

        // Load optional mint keypair
        let mintKp: Keypair | undefined;
        if (options.mint && fs.existsSync(options.mint)) {
          const sk = Uint8Array.from(JSON.parse(fs.readFileSync(options.mint, 'utf-8')));
          mintKp = Keypair.fromSecretKey(sk);
        }

        // Resolve create options
        let createOpts: StablecoinCreateOptions;

        if (options.config) {
          // Parse custom JSON config
          const raw = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
          createOpts = {
            preset: mkPreset(resolvedPreset),
            name: raw.name ?? options.name,
            symbol: raw.symbol ?? options.symbol,
            uri: raw.uri ?? options.uri,
            decimals: raw.decimals ?? parseInt(options.decimals ?? '6', 10),
            supplyCap: raw.supply_cap ? BigInt(raw.supply_cap) : undefined,
          };
        } else {
          createOpts = {
            preset: mkPreset(resolvedPreset),
            name: options.name,
            symbol: options.symbol,
            uri: options.uri,
            decimals: parseInt(options.decimals ?? '6', 10),
            supplyCap: options.supplyCap ? BigInt(options.supplyCap) : undefined,
          };
        }

        const sss = await SSS.create(provider, createOpts, mintKp);
        setMintAddr(sss.mintAddress.toBase58());
        setTxSig(sss.mintAddress.toBase58()); // mint address IS the confirmation
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
      {phase === 'creating' && (
        <Spinner label={`Deploying SSS-${resolvedPreset.split('-')[1]} stablecoin...`} />
      )}
      {phase === 'done' && (
        <Card title="Stablecoin Created">
          <Table
            rows={[
              { key: 'Preset', value: resolvedPreset.toUpperCase(), highlight: true },
              { key: 'Name', value: options.name },
              { key: 'Symbol', value: options.symbol },
              { key: 'Decimals', value: options.decimals ?? '6' },
              { key: 'Mint Address', value: mintAddr },
            ]}
          />
          <Box marginTop={1}>
            <Text color="greenBright" bold>
              ✓ Ready on-chain
            </Text>
          </Box>
        </Card>
      )}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
