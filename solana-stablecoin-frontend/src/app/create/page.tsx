'use client';

import { useState, useCallback } from 'react';
import { Keypair } from '@solana/web3.js';
import { BN, Program, AnchorProvider } from '@coral-xyz/anchor';
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import {
  createSss1MintTx,
  createSss2MintTx,
  createSss3MintTx,
  createInitInstruction,
  createHookMetaInitInstruction,
  type TokenMintKey,
  SssCoreIdl,
  SssTransferHookIdl,
  type SssCore,
  type SssTransferHook,
} from '@stbr/sss-token';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SSS_CORE_PROGRAM_ID } from '@/lib/constants';
import { PageHeader } from '@/components/page-header';
import { TxFeedback } from '@/components/tx-feedback';
import { useTransaction } from '@/hooks/use-transaction';
import { useMintHistory } from '@/hooks/use-mint-history';
import { useActiveMint } from '@/hooks/use-active-mint';
import { cn } from '@/lib/utils';

type PresetChoice = 'sss-1' | 'sss-2' | 'sss-3';

const PRESET_ORDINAL: Record<PresetChoice, number> = {
  'sss-1': 1,
  'sss-2': 2,
  'sss-3': 3,
};

export default function CreateStablecoinPage() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { loading, error, signature, execute, reset } = useTransaction();
  const { addMint } = useMintHistory();
  const { setActiveMint } = useActiveMint();

  const [preset, setPreset] = useState<PresetChoice>('sss-1');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [uri, setUri] = useState('');
  const [decimals, setDecimals] = useState('6');
  const [supplyCap, setSupplyCap] = useState('');
  const [createdMint, setCreatedMint] = useState<string | null>(null);

  const canCreate = !!publicKey && name.trim() !== '' && symbol.trim() !== '' && decimals !== '';

  const handleCreate = useCallback(async () => {
    if (!canCreate || !anchorWallet || !publicKey) return;
    reset();
    setCreatedMint(null);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coreProgram = new Program<SssCore>(SssCoreIdl as any, provider);

      const mintKeypair = Keypair.generate();
      const payer = publicKey;
      const parsedDecimals = parseInt(decimals, 10);
      const capBN = supplyCap ? new BN(supplyCap) : null;

      if (!Number.isInteger(parsedDecimals) || parsedDecimals < 0 || parsedDecimals > 9) return;

      let mintTx;
      const options = { name, symbol, uri, decimals: parsedDecimals };

      if (preset === 'sss-1') {
        mintTx = await createSss1MintTx(
          connection,
          payer,
          mintKeypair,
          options,
          SSS_CORE_PROGRAM_ID,
        );
      } else if (preset === 'sss-2') {
        mintTx = await createSss2MintTx(
          connection,
          payer,
          mintKeypair,
          options,
          SSS_CORE_PROGRAM_ID,
        );
      } else {
        mintTx = await createSss3MintTx(
          connection,
          payer,
          mintKeypair,
          options,
          SSS_CORE_PROGRAM_ID,
        );
      }

      // Build sss-core initialize ix
      const initIx = await createInitInstruction(
        coreProgram,
        mintKeypair.publicKey as TokenMintKey,
        payer,
        {
          preset: PRESET_ORDINAL[preset],
          name,
          symbol,
          uri,
          decimals: parsedDecimals,
          supplyCap: capBN,
        },
      );

      mintTx.add(initIx);

      // Handle extra account metas for SSS-2
      if (preset === 'sss-2') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hookProgram = new Program<SssTransferHook>(SssTransferHookIdl as any, provider);
        const hookInitIx = await createHookMetaInitInstruction(
          hookProgram,
          mintKeypair.publicKey as TokenMintKey,
          payer,
        );
        mintTx.add(hookInitIx);
      }

      const sig = await execute(mintTx, [mintKeypair]);
      if (sig) {
        const addr = mintKeypair.publicKey.toBase58();
        setCreatedMint(addr);
        addMint(addr);
        setActiveMint(addr);
      }
    } catch (err) {
      console.error(err);
    }
  }, [
    canCreate,
    anchorWallet,
    reset,
    connection,
    publicKey,
    decimals,
    supplyCap,
    preset,
    name,
    symbol,
    uri,
    execute,
    addMint,
    setActiveMint,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Deploy New Stablecoin" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto w-full">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Generate a new mint keypair and deploy a stablecoin powered by SSS.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Token Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. US Dollar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background/50 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symbol">Token Symbol</Label>
                <Input
                  id="symbol"
                  placeholder="e.g. USD"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="bg-background/50 h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="decimals">Decimals</Label>
                <Input
                  id="decimals"
                  type="number"
                  placeholder="6"
                  value={decimals}
                  onChange={(e) => setDecimals(e.target.value)}
                  className="bg-background/50 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplyCap">Supply Cap (Optional)</Label>
                <Input
                  id="supplyCap"
                  type="number"
                  placeholder="Leave empty for infinite"
                  value={supplyCap}
                  onChange={(e) => setSupplyCap(e.target.value)}
                  className="bg-background/50 h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="uri">Metadata URI (Optional)</Label>
              <Input
                id="uri"
                placeholder="https://..."
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                className="bg-background/50 h-11"
              />
            </div>

            <div className="space-y-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                Select Preset
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    id: 'sss-1',
                    title: 'SSS-1 (Minimal)',
                    description: 'Standard Token-2022 mint. Lightweight.',
                  },
                  {
                    id: 'sss-2',
                    title: 'SSS-2 (Compliant)',
                    description: 'Includes Transfer Hook & Blacklisting.',
                  },
                  {
                    id: 'sss-3',
                    title: 'SSS-3 (Confidential)',
                    description: 'Zero-knowledge private transfers.',
                  },
                ].map((p) => (
                  <Card
                    key={p.id}
                    className={cn(
                      'cursor-pointer transition-all duration-200 bg-background/30 hover:border-foreground/30',
                      preset === p.id
                        ? 'border-foreground bg-foreground/5 ring-1 ring-foreground/30'
                        : 'border-border',
                    )}
                    onClick={() => setPreset(p.id as PresetChoice)}
                  >
                    <CardHeader className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        {preset === p.id && (
                          <span className="h-2 w-2 rounded-full bg-foreground shrink-0" />
                        )}
                        <CardTitle className="text-sm font-bold">{p.title}</CardTitle>
                      </div>
                      <CardDescription className="text-xs">{p.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-border/50">
              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={handleCreate}
                disabled={!canCreate || loading}
              >
                {loading ? 'Deploying...' : 'Deploy Stablecoin'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <TxFeedback loading={loading} error={error} signature={signature} />

        {createdMint && (
          <Card className="border-success/30 bg-success/5 p-6 text-center space-y-4">
            <div className="space-y-2">
              <CardTitle className="text-success text-lg">Deployment Successful!</CardTitle>
              <CardDescription className="text-foreground">
                Your stablecoin works perfectly. You can now operate it using the mint address:
              </CardDescription>
            </div>
            <code className="bg-background border border-success/20 text-foreground px-4 py-3 rounded-lg font-mono text-sm inline-block shadow-inner select-all w-full md:w-auto overflow-x-auto">
              {createdMint}
            </code>
          </Card>
        )}
      </div>
    </div>
  );
}
