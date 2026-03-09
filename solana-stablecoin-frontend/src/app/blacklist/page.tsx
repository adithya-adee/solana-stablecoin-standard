'use client';

import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, ShieldOff, ShieldAlert, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/page-header';
import { TxFeedback } from '@/components/tx-feedback';
import { useStablecoin } from '@/hooks/use-stablecoin';
import { useTransaction } from '@/hooks/use-transaction';
import { useActiveMint } from '@/hooks/use-active-mint';
import { isValidPubkey } from '@/lib/validation';
import { cn } from '@/lib/utils';

type OperationType = 'check' | 'add' | 'remove';

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
  check: {
    id: 'check',
    title: 'Check Status',
    description: 'Verify whether an address is blacklisted by checking the on-chain PDA.',
    icon: Search,
    color: 'text-accent bg-accent/10 border-accent/20',
    buttonVariant: 'primary',
  },
  add: {
    id: 'add',
    title: 'Add to Blacklist',
    description: 'Block an address from transferring tokens. Requires blacklister role.',
    icon: ShieldOff,
    color: 'text-destructive bg-destructive/10 border-destructive/20',
    buttonVariant: 'destructive',
  },
  remove: {
    id: 'remove',
    title: 'Remove from Blacklist',
    description: "Restore an address's ability to transfer tokens. Requires blacklister role.",
    icon: ShieldAlert,
    color: 'text-warning bg-warning/10 border-warning/20',
    buttonVariant: 'warning',
  },
};

export default function BlacklistPage() {
  const { publicKey } = useWallet();
  const { client, loading: clientLoading } = useStablecoin();
  const { loading: txLoading, error: txError, signature, execute, reset } = useTransaction();
  const { activeMint } = useActiveMint();

  const [operation, setOperation] = useState<OperationType>('check');
  const [isOpen, setIsOpen] = useState(false);

  const [addressInput, setAddressInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  const [checkResult, setCheckResult] = useState<
    'idle' | 'clean' | 'blacklisted' | 'loading' | 'error'
  >('idle');
  const [checkError, setCheckError] = useState<string | null>(null);

  const loading = clientLoading || txLoading;

  const handleAction = useCallback(async () => {
    if (!client || !addressInput) return;
    if (!isValidPubkey(addressInput)) {
      setCheckError('Invalid address format');
      setCheckResult('error');
      return;
    }

    reset();

    if (operation === 'check') {
      setCheckResult('loading');
      setCheckError(null);

      try {
        const isBlacklisted = await client.denyList.check(new PublicKey(addressInput));
        setCheckResult(isBlacklisted ? 'blacklisted' : 'clean');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Check failed';
        setCheckError(message);
        setCheckResult('error');
      }
    } else {
      try {
        let tx;
        const targetPubkey = new PublicKey(addressInput);
        if (operation === 'add') {
          tx = await client.composeBlacklistAdd(targetPubkey, reasonInput || 'Manual blacklist');
        } else {
          tx = await client.composeBlacklistRemove(targetPubkey);
        }

        if (tx) await execute(tx);
      } catch (err) {
        console.error(err);
      }
    }
  }, [client, operation, addressInput, reasonInput, execute, reset]);

  const activeOp = OPERATIONS[operation];
  const ActiveIcon = activeOp.icon;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Blacklist Management" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* SSS-2 notice */}
        <Card className="border-accent/30 bg-accent/5 p-4 shadow-sm flex items-center gap-3">
          <Info className="h-5 w-5 text-accent shrink-0" />
          <div>
            <p className="text-sm font-semibold">SSS-2 Feature</p>
            <p className="text-xs text-muted-foreground">
              Blacklist management is available for SSS-2 (Compliant) presets with the transfer hook
              program enabled.
            </p>
          </div>
        </Card>

        {!activeMint && (
          <Card className="p-12 text-center border-dashed">
            <CardDescription>
              Select a mint address above to check blacklist status.
            </CardDescription>
          </Card>
        )}

        {!publicKey && activeMint && (
          <Card className="border-warning/50 bg-warning/5 p-4 text-center">
            <p className="text-sm text-warning font-medium">
              Connect your wallet to manage blacklist entries.
            </p>
          </Card>
        )}

        {activeMint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4">
                  {/* Transactions Feedback */}
                  {operation !== 'check' && (
                    <TxFeedback loading={txLoading} error={txError} signature={signature} />
                  )}

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
                                  setReasonInput('');
                                  setCheckResult('idle');
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
                      <div className="space-y-2">
                        <Label htmlFor="address">Target Address</Label>
                        <Input
                          id="address"
                          placeholder="Enter Solana wallet address..."
                          value={addressInput}
                          onChange={(e) => {
                            setAddressInput(e.target.value);
                            if (operation === 'check') {
                              setCheckResult('idle');
                              setCheckError(null);
                            }
                          }}
                          className="bg-background/50 h-11"
                        />
                      </div>

                      {operation === 'add' && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label htmlFor="reason">Reason (Optional)</Label>
                            <span className="text-[10px] text-muted-foreground">
                              {reasonInput.length}/128
                            </span>
                          </div>
                          <Input
                            id="reason"
                            placeholder="e.g. OFAC sanctioned entity"
                            maxLength={128}
                            value={reasonInput}
                            onChange={(e) => setReasonInput(e.target.value)}
                            className="bg-background/50 h-11"
                          />
                        </div>
                      )}

                      {operation === 'check' && (
                        <div className="pt-2">
                          {checkResult === 'loading' && (
                            <div className="flex items-center gap-3 rounded-md bg-muted/50 border border-border p-4">
                              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              <span className="text-sm font-medium">
                                Querying on-chain state...
                              </span>
                            </div>
                          )}

                          {checkResult === 'error' && (
                            <Card className="border-destructive/30 bg-destructive/10 p-4">
                              <p className="text-sm font-semibold text-destructive text-center">
                                {checkError ?? 'Failed to check address'}
                              </p>
                            </Card>
                          )}

                          {(checkResult === 'clean' || checkResult === 'blacklisted') && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                'flex items-center gap-3 rounded-md border p-4 shadow-sm',
                                checkResult === 'clean'
                                  ? 'border-success/30 bg-success/10 text-success'
                                  : 'border-destructive/30 bg-destructive/10 text-destructive',
                              )}
                            >
                              <div
                                className={cn(
                                  'h-2.5 w-2.5 rounded-full shadow-sm',
                                  checkResult === 'clean'
                                    ? 'bg-success shadow-success/50'
                                    : 'bg-destructive shadow-destructive/50',
                                )}
                              />
                              <p className="text-sm font-semibold">
                                {checkResult === 'clean'
                                  ? 'Address is NOT blacklisted'
                                  : 'Address is EXPLICITLY BLACKLISTED'}
                              </p>
                            </motion.div>
                          )}
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
                      onClick={handleAction}
                      disabled={!addressInput || loading}
                    >
                      {loading
                        ? 'Processing...'
                        : operation === 'check'
                          ? 'Query On-Chain Status'
                          : `Execute ${activeOp.title}`}
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
