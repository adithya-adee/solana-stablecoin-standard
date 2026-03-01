'use client';

import { useState, useCallback } from 'react';
import { Keypair } from '@solana/web3.js';
import { BN, Program, AnchorProvider } from '@coral-xyz/anchor';
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import {
  createSss1MintTransaction,
  createSss2MintTransaction,
  createSss3MintTransaction,
  buildInitializeIx,
  buildInitializeExtraAccountMetasIx,
  SSS_CORE_PROGRAM_ID,
  PRESET_MAP,
  type MintAddress,
  SssCoreIdl,
  SssTransferHookIdl,
  type SssCore,
  type SssTransferHook,
} from '@stbr/sss-token';
import { Navbar } from '@/components/navbar';
import { TxFeedback } from '@/components/tx-feedback';
import { useTransaction } from '@/hooks/use-transaction';

type PresetChoice = 'sss-1' | 'sss-2' | 'sss-3';

function FormInput({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}

function PresetCard({
  id,
  title,
  description,
  selected,
  onSelect,
}: {
  id: PresetChoice;
  title: string;
  description: string;
  selected: boolean;
  onSelect: (id: PresetChoice) => void;
}) {
  return (
    <div
      onClick={() => onSelect(id)}
      className={`cursor-pointer rounded-xl border p-4 transition-colors ${
        selected ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-accent/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-4 w-4 rounded-full border flex items-center justify-center ${
            selected ? 'border-accent' : 'border-muted-foreground'
          }`}
        >
          {selected && <div className="h-2 w-2 rounded-full bg-accent" />}
        </div>
        <div>
          <h4 className="font-semibold text-foreground text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function CreateStablecoinPage() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { loading, error, signature, execute, reset } = useTransaction();

  const [preset, setPreset] = useState<PresetChoice>('sss-1');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [uri, setUri] = useState('');
  const [decimals, setDecimals] = useState('6');
  const [supplyCap, setSupplyCap] = useState('');
  const [createdMint, setCreatedMint] = useState<string | null>(null);

  const canCreate = !!publicKey && name.trim() !== '' && symbol.trim() !== '' && decimals !== '';

  const handleCreate = useCallback(async () => {
    if (!canCreate || !anchorWallet) return;
    reset();
    setCreatedMint(null);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coreProgram = new Program<SssCore>(SssCoreIdl as any, provider);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hookProgram = new Program<SssTransferHook>(SssTransferHookIdl as any, provider);

      const mintKeypair = Keypair.generate();
      const payer = publicKey;
      const parsedDecimals = parseInt(decimals, 10);
      const capBN = supplyCap ? new BN(supplyCap) : null;

      let mintTx;
      const options = { name, symbol, uri, decimals: parsedDecimals };

      if (preset === 'sss-1') {
        mintTx = await createSss1MintTransaction(
          connection,
          payer,
          mintKeypair,
          options,
          SSS_CORE_PROGRAM_ID,
        );
      } else if (preset === 'sss-2') {
        mintTx = await createSss2MintTransaction(
          connection,
          payer,
          mintKeypair,
          options,
          SSS_CORE_PROGRAM_ID,
        );
      } else {
        mintTx = await createSss3MintTransaction(
          connection,
          payer,
          mintKeypair,
          options,
          SSS_CORE_PROGRAM_ID,
        );
      }

      // Build sss-core initialize ix
      const initIx = await buildInitializeIx(
        coreProgram,
        mintKeypair.publicKey as MintAddress,
        payer,
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preset: (PRESET_MAP as any)[preset],
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
        const hookInitIx = await buildInitializeExtraAccountMetasIx(
          hookProgram,
          mintKeypair.publicKey as MintAddress,
          payer,
        );
        mintTx.add(hookInitIx);
      }

      const sig = await execute(mintTx, [mintKeypair]);
      if (sig) {
        setCreatedMint(mintKeypair.publicKey.toBase58());
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
  ]);

  return (
    <div>
      <Navbar title="Deploy New Stablecoin" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-1">Configuration</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Generate a new mint keypair and deploy a stablecoin powered by SSS.
          </p>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Token Name"
                placeholder="e.g. US Dollar"
                value={name}
                onChange={setName}
              />
              <FormInput
                label="Token Symbol"
                placeholder="e.g. USD"
                value={symbol}
                onChange={setSymbol}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Decimals"
                placeholder="6"
                value={decimals}
                onChange={setDecimals}
                type="number"
              />
              <FormInput
                label="Supply Cap (Optional)"
                placeholder="Leave empty for infinite"
                value={supplyCap}
                onChange={setSupplyCap}
                type="number"
              />
            </div>

            <FormInput
              label="Metadata URI (Optional)"
              placeholder="https://..."
              value={uri}
              onChange={setUri}
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Select Preset
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PresetCard
                  id="sss-1"
                  title="SSS-1 (Minimal)"
                  description="Standard Token-2022 mint. Lightweight."
                  selected={preset === 'sss-1'}
                  onSelect={setPreset}
                />
                <PresetCard
                  id="sss-2"
                  title="SSS-2 (Compliant)"
                  description="Includes Transfer Hook & Blacklisting."
                  selected={preset === 'sss-2'}
                  onSelect={setPreset}
                />
                <PresetCard
                  id="sss-3"
                  title="SSS-3 (Confidential)"
                  description="Zero-knowledge private transfers."
                  selected={preset === 'sss-3'}
                  onSelect={setPreset}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <button
                onClick={handleCreate}
                disabled={!canCreate || loading}
                className={`w-full rounded-lg px-4 py-3 font-semibold transition-colors ${
                  !canCreate || loading
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-accent hover:bg-accent/80 text-white'
                }`}
              >
                {loading ? 'Deploying...' : 'Deploy Stablecoin'}
              </button>
            </div>
          </div>
        </div>

        <TxFeedback loading={loading} error={error} signature={signature} />

        {createdMint && (
          <div className="rounded-xl border border-success/30 bg-success/10 p-5 mt-4 text-center space-y-2">
            <h4 className="text-success font-semibold">Deployment Successful!</h4>
            <p className="text-sm text-foreground">
              Your stablecoin works perfectly. You can now operate it using the mint address:
            </p>
            <code className="bg-background text-foreground px-4 py-2 rounded-lg font-mono text-sm inline-block shadow-sm select-all">
              {createdMint}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
