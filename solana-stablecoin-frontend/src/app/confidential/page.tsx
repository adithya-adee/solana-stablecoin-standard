'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Fingerprint, LogIn, LogOut, SendToBack, Settings, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/page-header';
import { useActiveMint } from '@/hooks/use-active-mint';
import { useTokenState } from '@/hooks/use-token-state';
import { cn } from '@/lib/utils';
import { generateTestElGamalKeypair } from '@stbr/sss-token';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useConfidential } from '@/hooks/use-confidential';

type OperationType = 'config' | 'deposit' | 'withdraw' | 'transfer' | 'info' | 'apply';

const OPERATIONS: Record<
  OperationType,
  {
    id: OperationType;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    buttonVariant: 'primary' | 'destructive' | 'warning';
    disabled?: boolean;
    requiresRust?: boolean;
  }
> = {
  config: {
    id: 'config',
    title: 'Configure Account',
    description: 'Initialize confidential transfer state on an empty token account (ElGamal keys).',
    icon: Settings,
    color: 'text-primary bg-primary/10 border-primary/20',
    buttonVariant: 'primary',
  },
  deposit: {
    id: 'deposit',
    title: 'Deposit to Confidential',
    description: 'Move tokens from public balance into your encrypted confidential balance.',
    icon: LogIn,
    color: 'text-success bg-success/10 border-success/20',
    buttonVariant: 'primary',
  },
  withdraw: {
    id: 'withdraw',
    title: 'Withdraw from Confidential',
    description: 'Move tokens out of your encrypted confidential balance to your public balance.',
    icon: LogOut,
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    buttonVariant: 'warning',
    disabled: true,
    requiresRust: true,
  },
  transfer: {
    id: 'transfer',
    title: 'Confidential Transfer',
    description:
      'Transfer tokens purely confidentially. Neither sender nor recipient balances are revealed.',
    icon: SendToBack,
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    buttonVariant: 'primary',
    disabled: true,
    requiresRust: true,
  },
  apply: {
    id: 'apply',
    title: 'Apply Pending Balance',
    description: 'Credits any pending confidential inward transfers to your available balance.',
    icon: CheckCircle2,
    color: 'text-green-500 bg-green-500/10 border-green-500/20',
    buttonVariant: 'primary',
  },
  info: {
    id: 'info',
    title: 'How It Works',
    description: 'Learn about Confidential Transfers and the SSS-3 Preset implementation model.',
    icon: Fingerprint,
    color: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    buttonVariant: 'primary',
  },
};

export default function ConfidentialPage() {
  const { activeMint } = useActiveMint();
  const { data: tokenState, loading: tokenLoading } = useTokenState(activeMint);
  const {
    configureAccount,
    deposit,
    applyPending,
    loading: confLoading,
    error: confError,
    signature,
  } = useConfidential();
  const [operation, setOperation] = useState<OperationType>('config');
  const [isOpen, setIsOpen] = useState(false);

  const [addressInput, setAddressInput] = useState('');
  const [amountInput, setAmountInput] = useState('');

  const activeOp = OPERATIONS[operation];
  const ActiveIcon = activeOp.icon;

  const handleExecute = async () => {
    try {
      if (operation === 'config') {
        const { secretKey } = generateTestElGamalKeypair();
        // In a real app, we would store this secretKey securely or let the user download it.
        // For the demo, we just pass it to the configureAccount hook.
        await configureAccount(addressInput, secretKey);
      }
      if (operation === 'deposit')
        await deposit(addressInput, BigInt(amountInput), tokenState?.decimals || 9);
      if (operation === 'apply') await applyPending(addressInput);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Confidential Transfers" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* SSS-3 Info Banner */}
        <Card className="border-accent/30 bg-accent/5 p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shadow-inner">
              <Fingerprint className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold">SSS-3 Privacy Preset</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Uses Token-2022 Confidential Transfer extension to encrypt balances and transfer
                amounts on-chain. Only the account owner and designated auditor can decrypt values.
              </p>
            </div>
          </div>
        </Card>

        {/* Extension Status Details */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              Extension Status Context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'ConfidentialTransferMint', active: true },
                { name: 'MetadataPointer', active: true },
                { name: 'PermanentDelegate', active: true },
                { name: 'TransferHook', active: false },
              ].map((badge) => (
                <div
                  key={badge.name}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold border transition-colors',
                    badge.active
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-muted text-muted-foreground border-border',
                  )}
                >
                  <div
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      badge.active ? 'bg-success animate-pulse' : 'bg-muted-foreground',
                    )}
                  />
                  {badge.name}
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border/50 bg-background/50 divide-y divide-border/50">
              {[
                { label: 'Protocol Level', value: 'SSS-3 (Private Stablecoin)' },
                { label: 'Auto-Approve Strategy', value: 'Enabled (Optimistic ZKP)' },
                { label: 'Auditor Access Key', value: 'Retained by Issuer Multi-Sig' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between p-3 text-sm">
                  <span className="text-muted-foreground font-medium">{row.label}</span>
                  <span className="text-foreground font-semibold">{row.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ZKP Warning / Status Banner */}
        <Card className="border-warning/30 bg-warning/5 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-warning font-heading">
                Client-Side ZKP Disabled
              </p>
              <p className="text-xs font-medium text-warning/80 mt-1">
                Zero-knowledge proof generation via WASM requires external hardware acceleration for
                reasonable UX. <b>Configure, Deposit, and Apply</b> are enabled (free of proofs),
                while
                <b> Withdraw and Transfer</b> require the Rust proof service.
              </p>
            </div>
          </div>
        </Card>

        {!activeMint && (
          <Card className="p-12 text-center border-dashed">
            <CardDescription>
              Select a mint address above to manage confidential operations.
            </CardDescription>
          </Card>
        )}

        {activeMint && tokenLoading && (
          <Card className="p-12 text-center border-dashed">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="h-5 w-5 animate-spin text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <CardDescription>Loading token configuration...</CardDescription>
            </div>
          </Card>
        )}

        {activeMint && !tokenLoading && tokenState && tokenState.preset !== 'sss-3' && (
          <Card className="border-destructive/30 bg-destructive/5 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20 shadow-inner">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-bold text-destructive">
                  Confidential Transfers Not Supported
                </h3>
                <p className="mt-1 text-sm text-foreground/80 leading-relaxed">
                  The selected token (
                  <span className="font-mono font-bold">{tokenState.symbol}</span>) uses the{' '}
                  <span className="font-bold">{tokenState.presetName}</span> preset.
                </p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Confidential transfers are only available for tokens using the{' '}
                  <strong>SSS-3 (Private)</strong> preset, which includes the necessary SPL
                  Token-2022 encrypted balance extensions.
                </p>
              </div>
            </div>
          </Card>
        )}

        {activeMint && !tokenLoading && tokenState && tokenState.preset === 'sss-3' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      Select Confidential Operation
                    </Label>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-14 px-4 bg-background/50 hover:bg-background/80"
                      onClick={() => setIsOpen(!isOpen)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-md border', activeOp.color)}>
                          <ActiveIcon size={18} />
                        </div>
                        <span className="font-semibold">{activeOp.title}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform duration-200',
                          isOpen && 'rotate-180',
                        )}
                      />
                    </Button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-2 rounded-md border border-border bg-popover shadow-xl z-50 overflow-hidden"
                        >
                          <div className="p-1">
                            {Object.values(OPERATIONS).map((op) => (
                              <button
                                key={op.id}
                                onClick={() => {
                                  setOperation(op.id);
                                  setIsOpen(false);
                                  setAddressInput('');
                                  setAmountInput('');
                                }}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                                  operation === op.id && 'bg-accent/50',
                                )}
                              >
                                <div className={cn('p-1.5 rounded border', op.color)}>
                                  <op.icon size={16} />
                                </div>
                                <div className="flex flex-col flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{op.title}</span>
                                    {op.requiresRust && (
                                      <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        Rust Only
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground line-clamp-1">
                                    {op.description}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </CardHeader>

              <Separator className="bg-border/50" />

              <CardContent className="pt-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={operation}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold tracking-tight">{activeOp.title}</h3>
                      <p className="text-sm text-muted-foreground">{activeOp.description}</p>
                    </div>

                    {operation !== 'info' ? (
                      <div className="space-y-5">
                        {(operation === 'config' ||
                          operation === 'transfer' ||
                          operation === 'deposit' ||
                          operation === 'withdraw' ||
                          operation === 'apply') && (
                          <div className="space-y-2">
                            <Label htmlFor="address">
                              {operation === 'transfer' || operation === 'deposit'
                                ? 'Target Destination Address'
                                : 'Token Account Address'}
                            </Label>
                            <Input
                              id="address"
                              type="text"
                              value={addressInput}
                              onChange={(e) => setAddressInput(e.target.value)}
                              placeholder="Enter Solana wallet address..."
                              className="bg-background/50 h-11 font-mono"
                              disabled={activeOp.disabled || confLoading}
                            />
                          </div>
                        )}

                        {(operation === 'deposit' ||
                          operation === 'withdraw' ||
                          operation === 'transfer') && (
                          <div className="space-y-2">
                            <Label htmlFor="amount">Amount (in raw units)</Label>
                            <Input
                              id="amount"
                              type="number"
                              value={amountInput}
                              onChange={(e) => setAmountInput(e.target.value)}
                              placeholder={`e.g. ${tokenState?.decimals ? Math.pow(10, tokenState.decimals) : 1000000}`}
                              className="bg-background/50 h-11 font-mono"
                              disabled={activeOp.disabled || confLoading}
                            />
                          </div>
                        )}

                        <div className="pt-4 mt-4 border-t border-border/50">
                          {confError && (
                            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                              {confError}
                            </div>
                          )}
                          {signature && (
                            <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-md text-sm text-success flex flex-col gap-1">
                              <strong>Success!</strong>
                              <a
                                href={`https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899`}
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:text-success/80 font-mono text-xs break-all"
                              >
                                View on Explorer
                              </a>
                            </div>
                          )}

                          <Button
                            className="w-full h-12 text-base font-semibold"
                            variant={activeOp.disabled ? 'secondary' : 'default'}
                            disabled={activeOp.disabled || confLoading || !addressInput}
                            onClick={handleExecute}
                          >
                            {confLoading
                              ? 'Executing...'
                              : activeOp.disabled
                                ? `Execute (WASM Only)`
                                : `Execute ${activeOp.title}`}
                          </Button>
                          {activeOp.requiresRust && (
                            <p className="text-[10px] text-center text-muted-foreground mt-3 italic">
                              Requires local WASM ZKP client bindings (currently disabled in
                              browser)
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {[
                          {
                            step: 1,
                            title: 'Configure Substrate',
                            desc: 'Initialize an ElGamal keypair on-chain for your empty token bucket via the ZKP config extension.',
                          },
                          {
                            step: 2,
                            title: 'Encrypted Deposit',
                            desc: 'Burn your public tokens locally while simultaneously incrementing your ciphertext ElGamal representation securely.',
                          },
                          {
                            step: 3,
                            title: 'Shielded Transfers',
                            desc: 'Execute full peer-to-peer hidden-amount bridging. Validated opaquely entirely via network consensus ZKP verification.',
                          },
                        ].map((item) => (
                          <Card
                            key={item.step}
                            className="p-5 border-border/30 bg-background/30 relative overflow-hidden group hover:border-accent/40 transition-colors"
                          >
                            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full pointer-events-none group-hover:bg-primary/10 transition-colors" />
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold border border-primary/20 mb-4">
                              {item.step}
                            </div>
                            <h4 className="text-sm font-bold mb-2">{item.title}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {item.desc}
                            </p>
                          </Card>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
