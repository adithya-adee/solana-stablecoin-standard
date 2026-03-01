import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SSS } from '@stbr/sss-token';
import { Keypair, PublicKey } from '@solana/web3.js';
import { Header, Spinner, Success, Err, Card, Table, Badge, Row } from '../components/ui.js';
import { loadProvider, parseAmount, formatAmount } from '../utils/config.js';
import { preset as mkPreset } from '@stbr/sss-token';
import type { StablecoinCreateOptions } from '@stbr/sss-token';
import fs from 'fs';
import toml from 'smol-toml';

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

const presetBadges: Record<PresetChoice, React.ReactElement> = {
  'sss-1': <Badge label="MINIMAL" variant="success" />,
  'sss-2': <Badge label="COMPLIANT" variant="warning" />,
  'sss-3': <Badge label="CONFIDENTIAL" variant="confidential" />,
};

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
          const configContents = fs.readFileSync(options.config, 'utf-8');
          let raw: any;

          if (options.config.endsWith('.toml')) {
            raw = toml.parse(configContents);
          } else {
            raw = JSON.parse(configContents);
          }

          // The TOML file might have a top-level table, e.g. [stablecoin]
          const configData = raw.stablecoin ?? raw;

          createOpts = {
            preset: mkPreset(resolvedPreset),
            name: configData.name ?? options.name,
            symbol: configData.symbol ?? options.symbol,
            uri: configData.uri ?? options.uri,
            decimals: configData.decimals ?? parseInt(options.decimals ?? '6', 10),
            supplyCap: configData.supply_cap ? BigInt(configData.supply_cap) : undefined,
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

        // Write config file
        const configPath = process.env.SSS_CONFIG ?? '.sss-config.json';
        const config = {
          mint: sss.mintAddress.toBase58(),
          preset: resolvedPreset,
          cluster: process.env.SOLANA_CLUSTER ?? 'devnet',
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

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
              { key: 'Preset', value: presetBadges[resolvedPreset] },
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
