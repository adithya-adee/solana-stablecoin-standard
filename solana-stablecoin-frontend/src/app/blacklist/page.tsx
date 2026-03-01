'use client';

import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, ShieldOff, ShieldAlert, Info } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Navbar } from '@/components/navbar';
import { MintSelector } from '@/components/mint-selector';
import { deriveBlacklistPda } from '@/lib/pda';
import { isValidPubkey } from '@/lib/validation';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    description: 'Block an address from transferring tokens.',
    icon: ShieldOff,
    color: 'text-destructive bg-destructive/10 border-destructive/20',
    buttonVariant: 'destructive',
  },
  remove: {
    id: 'remove',
    title: 'Remove from Blacklist',
    description: "Restore an address's ability to transfer tokens.",
    icon: ShieldAlert,
    color: 'text-warning bg-warning/10 border-warning/20',
    buttonVariant: 'warning',
  },
};

export default function BlacklistPage() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [activeMint, setActiveMint] = useState<string | null>(null);

  const [operation, setOperation] = useState<OperationType>('check');
  const [isOpen, setIsOpen] = useState(false);

  const [addressInput, setAddressInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  const [checkResult, setCheckResult] = useState<
    'idle' | 'clean' | 'blacklisted' | 'loading' | 'error'
  >('idle');
  const [checkError, setCheckError] = useState<string | null>(null);

  const handleCheck = useCallback(async () => {
    if (!activeMint || !addressInput) return;
    if (!isValidPubkey(addressInput) || !isValidPubkey(activeMint)) {
      setCheckError('Invalid address format');
      setCheckResult('error');
      return;
    }

    setCheckResult('loading');
    setCheckError(null);

    try {
      const mintPubkey = new PublicKey(activeMint);
      const addressPubkey = new PublicKey(addressInput);
      const [blacklistPda] = deriveBlacklistPda(mintPubkey, addressPubkey);

      const accountInfo = await connection.getAccountInfo(blacklistPda);
      setCheckResult(accountInfo !== null ? 'blacklisted' : 'clean');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check failed';
      setCheckError(message);
      setCheckResult('error');
    }
  }, [activeMint, addressInput, connection]);

  const activeOp = OPERATIONS[operation];
  const ActiveIcon = activeOp.icon;

  return (
    <div>
      <Navbar title="Blacklist Management" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <MintSelector onSelect={setActiveMint} currentMint={activeMint} />

        {/* SSS-2 notice */}
        <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4 shadow-sm">
          <Info className="h-5 w-5 text-accent shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">SSS-2 Feature</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Blacklist management is available for SSS-2 (Compliant) presets with the transfer hook
              program enabled.
            </p>
          </div>
        </div>

        {!activeMint && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Select a mint address above to check blacklist status.
            </p>
          </div>
        )}

        {!publicKey && activeMint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-warning/20 bg-warning/5 p-5 text-center shadow-sm"
          >
            <p className="text-sm text-warning font-medium">
              Connect your wallet to manage blacklist entries.
            </p>
          </motion.div>
        )}

        {activeMint && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-8 shadow-xl relative z-10"
          >
            {/* Custom Dropdown */}
            <div className="relative mb-8">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Select Operation
              </label>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between rounded-xl border border-border bg-background/50 px-4 py-4 text-left shadow-sm hover:border-accent/50 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg border', activeOp.color)}>
                    <ActiveIcon size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{activeOp.title}</h4>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    'text-muted-foreground transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                  size={20}
                />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-2xl overflow-hidden z-50"
                  >
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
                          'w-full flex items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border/50 last:border-0',
                          operation === op.id && 'bg-accent/5',
                        )}
                      >
                        <div className={cn('p-2 rounded-lg border', op.color)}>
                          <op.icon size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{op.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {op.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dynamic Form Area */}
            <div className="bg-background/30 rounded-xl p-6 border border-border/30 overflow-hidden">
              <div className="mb-6 flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-1">{activeOp.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {activeOp.description}
                  </p>
                </div>
              </div>

              <AnimatePresence mode="popLayout">
                <motion.div
                  key={operation}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Target Address
                    </label>
                    <input
                      type="text"
                      value={addressInput}
                      onChange={(e) => {
                        setAddressInput(e.target.value);
                        if (operation === 'check') {
                          setCheckResult('idle');
                          setCheckError(null);
                        }
                      }}
                      placeholder="Enter Solana wallet address..."
                      className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                    />
                  </div>

                  {operation === 'add' && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-muted-foreground">
                        Reason (Optional)
                      </label>
                      <input
                        type="text"
                        value={reasonInput}
                        onChange={(e) => setReasonInput(e.target.value)}
                        placeholder="e.g. OFAC sanctioned entity"
                        maxLength={128}
                        className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                      />
                      <p className="mt-2 text-xs text-muted-foreground text-right">
                        {reasonInput.length}/128
                      </p>
                    </div>
                  )}

                  {operation === 'check' && (
                    <>
                      {checkResult === 'loading' && (
                        <div className="flex items-center gap-3 rounded-xl bg-muted/50 border border-muted p-4">
                          <svg
                            className="h-4 w-4 animate-spin text-muted-foreground"
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
                          <span className="text-sm font-medium text-foreground">
                            Querying on-chain state...
                          </span>
                        </div>
                      )}

                      {checkResult === 'error' && (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                          <p className="text-sm font-semibold text-destructive">
                            {checkError ?? 'Failed to check address'}
                          </p>
                        </div>
                      )}

                      {(checkResult === 'clean' || checkResult === 'blacklisted') && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border p-4 shadow-sm',
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
                    </>
                  )}

                  <div className="pt-4 mt-4 border-t border-border/30">
                    <button
                      onClick={operation === 'check' ? handleCheck : undefined}
                      disabled={!addressInput || operation !== 'check'}
                      className={cn(
                        'w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition-all shadow-lg active:scale-[0.98]',
                        activeOp.buttonVariant === 'primary' &&
                          'bg-accent hover:bg-accent/80 text-white shadow-accent/20',
                        activeOp.buttonVariant === 'warning' &&
                          'bg-warning hover:bg-warning/80 text-black shadow-warning/20',
                        activeOp.buttonVariant === 'destructive' &&
                          'bg-destructive hover:bg-destructive/80 text-white shadow-destructive/20',
                        (!addressInput || operation !== 'check') &&
                          'opacity-50 cursor-not-allowed shadow-none active:scale-100',
                      )}
                      title={
                        operation !== 'check'
                          ? 'Requires SSS Transfer Hook IDL client bindings (coming soon)'
                          : undefined
                      }
                    >
                      {operation === 'check'
                        ? 'Query On-Chain Status'
                        : `${activeOp.title} (Coming Soon)`}
                    </button>
                    {operation !== 'check' && (
                      <p className="text-xs text-muted-foreground text-center mt-3">
                        Blacklist mutation commands require the direct SDK or CLI presently.
                      </p>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
