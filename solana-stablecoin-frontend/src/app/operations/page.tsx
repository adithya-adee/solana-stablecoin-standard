'use client';

import { useState, useCallback, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Coins, Zap, Flame, ShieldAlert, Play, ShieldBan } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/page-header';
import { MintSelector } from '@/components/mint-selector';
import { TxFeedback } from '@/components/tx-feedback';
import { useStablecoin } from '@/hooks/use-stablecoin';
import { useTransaction } from '@/hooks/use-transaction';
import { useActiveMint } from '@/hooks/use-active-mint';
import { useTokenState } from '@/hooks/use-token-state';
import { isValidPubkey } from '@/lib/validation';
import { cn } from '@/lib/utils';

type OperationType = 'mint' | 'burn' | 'freeze' | 'thaw' | 'pause' | 'unpause';

const OPERATIONS: Record<
  OperationType,
  {
    id: OperationType;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    buttonVariant: 'primary' | 'destructive' | 'warning';
  }
> = {
  mint: {
    id: 'mint',
    title: 'Mint Tokens',
    description:
      'Issue new tokens to a recipient token account. Automatically creates ATA if missing. Requires minter role.',
    icon: Coins,
    color: 'text-success bg-success/10 border-success/20',
    buttonVariant: 'primary',
  },
  burn: {
    id: 'burn',
    title: 'Burn Tokens',
    description:
      'Burn tokens from a token account. Reduces circulating supply. Requires burner role.',
    icon: Flame,
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    buttonVariant: 'destructive',
  },
  freeze: {
    id: 'freeze',
    title: 'Freeze Account',
    description: 'Freeze a token account to prevent all transfers. Requires freezer role.',
    icon: ShieldBan,
    color: 'text-warning bg-warning/10 border-warning/20',
    buttonVariant: 'warning',
  },
  thaw: {
    id: 'thaw',
    title: 'Thaw Account',
    description: 'Unfreeze a previously frozen token account to restore transfers.',
    icon: ShieldAlert,
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    buttonVariant: 'primary',
  },
  pause: {
    id: 'pause',
    title: 'Pause Operations',
    description:
      'Pause all mint, burn, and transfer operations for this stablecoin. Requires pauser role.',
    icon: Zap,
    color: 'text-destructive bg-destructive/10 border-destructive/20',
    buttonVariant: 'destructive',
  },
  unpause: {
    id: 'unpause',
    title: 'Resume Operations',
    description: 'Resume operations for a paused stablecoin. Requires pauser role.',
    icon: Play,
    color: 'text-success bg-success/10 border-success/20',
    buttonVariant: 'primary',
  },
};

export default function OperationsPage() {
  const { publicKey } = useWallet();
  const { client, loading: clientLoading } = useStablecoin();
  const { loading: txLoading, error, signature, execute, reset } = useTransaction();

  const { activeMint, setActiveMint } = useActiveMint();
  const { data: tokenState } = useTokenState(activeMint);
  const [operation, setOperation] = useState<OperationType>('mint');
  const [isOpen, setIsOpen] = useState(false);

  // Form State
  const [addressInput, setAddressInput] = useState('');
  const [amountInput, setAmountInput] = useState('');

  // Permission State
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [checkingPermission, setCheckingPermission] = useState(false);

  const requiresAddress = ['mint', 'burn', 'freeze', 'thaw'].includes(operation);
  const requiresAmount = ['mint', 'burn'].includes(operation);

  const loading = clientLoading || txLoading;
  const canOperate = !!publicKey && !!client && !!activeMint;

  // Check permissions when operation or activeMint changes
  useEffect(() => {
    async function checkPerms() {
      if (!client || !publicKey) {
        setHasPermission(null);
        return;
      }

      setCheckingPermission(true);
      try {
        const role =
          operation === 'mint'
            ? 'minter'
            : operation === 'burn'
              ? 'burner'
              : operation === 'freeze' || operation === 'thaw'
                ? 'freezer'
                : 'pauser';

        const ok = await client.accessControl.check(publicKey, role as any);
        setHasPermission(ok);
      } catch (err) {
        console.error('Failed to check permission:', err);
        setHasPermission(null);
      } finally {
        setCheckingPermission(false);
      }
    }

    checkPerms();
  }, [client, publicKey, operation, activeMint]);

  const handleSubmit = useCallback(async () => {
    if (!canOperate || !client) return;

    // Address validation for ops that require it
    if (requiresAddress) {
      if (!addressInput || !isValidPubkey(addressInput)) return;
    }

    // Amount validation
    if (requiresAmount) {
      if (!amountInput || amountInput === '0') return;
    }

    reset();

    try {
      let tx;
      const targetPubkey = requiresAddress ? new PublicKey(addressInput) : null;
      let amountBigInt = 0n;
      if (requiresAmount && amountInput) {
        const decimals = tokenState?.decimals ?? 6;
        const parts = amountInput.split('.');
        const whole = parts[0] || '0';
        const frac = (parts[1] || '').slice(0, decimals).padEnd(decimals, '0');
        amountBigInt = BigInt(whole + frac);
      }

      if (operation === 'mint') {
        tx = await client.composeMintTokens(targetPubkey!, amountBigInt);
      } else if (operation === 'burn') {
        tx = await client.composeBurnTokens(targetPubkey!, amountBigInt);
      } else if (operation === 'freeze') {
        tx = await client.composeFreezeAccount(targetPubkey!);
      } else if (operation === 'thaw') {
        tx = await client.composeThawAccount(targetPubkey!);
      } else if (operation === 'pause') {
        tx = await client.composePause();
      } else if (operation === 'unpause') {
        tx = await client.composeResume();
      }

      // If it's a string, it means it already sent. If it's a Transaction, we execute it.
      if (typeof tx === 'string') {
        // This is a bit of a hack since some methods still return sigs
        // We'll update the SDK further if needed, but let's handle it for now.
        return;
      }

      if (tx) await execute(tx);
    } catch (err) {
      console.error(err);
    }
  }, [canOperate, client, operation, addressInput, amountInput, execute, reset]);

  const activeOp = OPERATIONS[operation];
  const ActiveIcon = activeOp.icon;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Token Operations" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto w-full">
        <MintSelector onSelect={setActiveMint} currentMint={activeMint} />

        {!activeMint && (
          <Card className="p-12 text-center border-dashed">
            <CardDescription>
              Select a mint address above to perform token operations.
            </CardDescription>
          </Card>
        )}

        {!publicKey && activeMint && (
          <Card className="border-warning/50 bg-warning/5 p-4 text-center">
            <p className="text-sm text-warning font-medium">
              Connect your wallet to execute transactions.
            </p>
          </Card>
        )}

        {publicKey && activeMint && hasPermission === false && !checkingPermission && (
          <Card className="border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
            <ShieldBan className="text-destructive shrink-0" size={20} />
            <p className="text-sm text-destructive font-medium">
              Unauthorized: Your wallet lacks the required role to perform this operation.
            </p>
          </Card>
        )}

        <TxFeedback loading={loading} error={error} signature={signature} />

        {activeMint && (
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
                      Select Operation
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
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{op.title}</span>
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

                    <div className="space-y-4">
                      {requiresAddress && (
                        <div className="space-y-2">
                          <Label htmlFor="address">
                            {operation === 'freeze' || operation === 'thaw'
                              ? 'Target Token Account'
                              : 'Recipient Token Account'}
                          </Label>
                          <Input
                            id="address"
                            placeholder="Enter SPL token account address..."
                            value={addressInput}
                            onChange={(e) => setAddressInput(e.target.value)}
                            className="bg-background/50 h-11"
                          />
                        </div>
                      )}

                      {requiresAmount && (
                        <div className="space-y-2">
                          <Label htmlFor="amount">Amount (in raw units)</Label>
                          <Input
                            id="amount"
                            type="number"
                            placeholder="e.g. 1000000"
                            value={amountInput}
                            onChange={(e) => setAmountInput(e.target.value)}
                            className="bg-background/50 h-11"
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full h-12 text-base font-semibold"
                      variant={
                        activeOp.buttonVariant === 'destructive'
                          ? 'destructive'
                          : activeOp.buttonVariant === 'warning'
                            ? 'secondary'
                            : 'default'
                      }
                      onClick={handleSubmit}
                      disabled={!canOperate || loading}
                    >
                      {loading ? 'Processing...' : `Execute ${activeOp.title}`}
                    </Button>
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
