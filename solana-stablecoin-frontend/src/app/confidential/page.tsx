'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Fingerprint, LogIn, LogOut, SendToBack, Settings, Info } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Navbar } from '@/components/navbar';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold shadow-sm',
        active
          ? 'bg-success/10 text-success border border-success/20'
          : 'bg-muted text-muted-foreground border border-muted',
      )}
    >
      <div
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-success shadow-success/50' : 'bg-muted-foreground',
        )}
      />
      {label}
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors px-2 rounded-lg">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span
        className={cn('text-sm text-foreground', mono && 'font-mono font-medium tracking-tight')}
      >
        {value}
      </span>
    </div>
  );
}

type OperationType = 'config' | 'deposit' | 'withdraw' | 'transfer' | 'info';

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
  config: {
    id: 'config',
    title: 'Configure Account',
    description: 'Initialize confidential transfer state on an empty token account (ElGamal keys).',
    icon: Settings,
    color: 'text-accent bg-accent/10 border-accent/20',
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
  },
  transfer: {
    id: 'transfer',
    title: 'Confidential Transfer',
    description:
      'Transfer tokens purely confidentially. Neither sender nor recipient balances are revealed.',
    icon: SendToBack,
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
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
  const [operation, setOperation] = useState<OperationType>('config');
  const [isOpen, setIsOpen] = useState(false);

  const [addressInput, setAddressInput] = useState('');
  const [amountInput, setAmountInput] = useState('');

  const activeOp = OPERATIONS[operation];
  const ActiveIcon = activeOp.icon;

  return (
    <div>
      <Navbar title="Confidential Transfers" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* SSS-3 Info Banner */}
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/20 border border-accent/30 shadow-inner">
              <Fingerprint className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">SSS-3 Privacy Preset</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Uses Token-2022 Confidential Transfer extension to encrypt balances and transfer
                amounts on-chain. Only the account owner and designated auditor can decrypt values.
              </p>
            </div>
          </div>
        </div>

        {/* Extension Status Details */}
        <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-6 shadow-md relative z-0">
          <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider opacity-80">
            Extension Status Context
          </h3>
          <div className="flex flex-wrap gap-2.5 mb-5">
            <StatusBadge label="ConfidentialTransferMint" active={true} />
            <StatusBadge label="MetadataPointer" active={true} />
            <StatusBadge label="PermanentDelegate" active={true} />
            <StatusBadge label="TransferHook" active={false} />
          </div>
          <div className="bg-background/40 rounded-lg p-3 border border-border/30">
            <InfoRow label="Protocol Level" value="SSS-3 (Private Stablecoin)" />
            <InfoRow label="Auto-Approve Strategy" value="Enabled (Optimistic ZKP)" />
            <InfoRow label="Auditor Access Key" value="Retained by Issuer Multi-Sig" />
          </div>
        </div>

        {/* Coming Soon Warning */}
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-warning">Client-Side ZKP Disabled</p>
              <p className="text-xs font-medium text-warning/80 mt-1">
                Zero-knowledge proof generation via WASM requires external hardware acceleration for
                reasonable UX. Use the local native SSS CLI/SDK for live generation.
              </p>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl p-8 shadow-2xl relative z-10 transition-all"
        >
          {/* Custom Dropdown */}
          <div className="relative mb-8">
            <label className="mb-2 block text-sm font-medium text-muted-foreground tracking-wide">
              Select Confidential Operation
            </label>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-4 text-left shadow-sm hover:border-accent/50 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg border', activeOp.color)}>
                  <ActiveIcon size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">{activeOp.title}</h4>
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
                        setAmountInput('');
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
                        <div className="text-xs text-muted-foreground mt-0.5">{op.description}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dynamic Form Area */}
          <div className="bg-background/40 rounded-xl p-6 border border-border/40 overflow-hidden shadow-inner">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-1">{activeOp.title}</h3>
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
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
              >
                {operation !== 'info' ? (
                  <div className="space-y-5">
                    {(operation === 'config' || operation === 'transfer') && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">
                          {operation === 'transfer'
                            ? 'Recipient Destination Address'
                            : 'Target Token Account'}
                        </label>
                        <input
                          type="text"
                          value={addressInput}
                          onChange={(e) => setAddressInput(e.target.value)}
                          placeholder="Enter Solana wallet address..."
                          className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm font-mono text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                        />
                      </div>
                    )}

                    {(operation === 'deposit' ||
                      operation === 'withdraw' ||
                      operation === 'transfer') && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">
                          Amount (in raw units)
                        </label>
                        <input
                          type="number"
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          placeholder="e.g. 1000000"
                          className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm font-mono text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                        />
                      </div>
                    )}

                    <div className="pt-4 mt-4 border-t border-border/30">
                      <button
                        disabled
                        className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition-all shadow-none bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                        title="Requires local WASM ZKP client bindings (currently disabled)"
                      >
                        Execute {activeOp.title} (WASM Only)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col gap-2 rounded-xl bg-background/60 p-5 border border-border/30 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-accent/5 rounded-bl-full pointer-events-none" />
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent text-sm font-bold border border-accent/20">
                        1
                      </div>
                      <p className="text-sm font-bold text-foreground">Configure Substrate</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Initialize an ElGamal keypair on-chain for your empty token bucket via the
                        ZKP config extension.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 rounded-xl bg-background/60 p-5 border border-border/30 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-accent/5 rounded-bl-full pointer-events-none" />
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent text-sm font-bold border border-accent/20">
                        2
                      </div>
                      <p className="text-sm font-bold text-foreground">Encrypted Deposit</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Burn your public tokens locally while simultaneously incrementing your
                        ciphertext ElGamal representation securely.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 rounded-xl bg-background/60 p-5 border border-border/30 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-accent/5 rounded-bl-full pointer-events-none" />
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent text-sm font-bold border border-accent/20">
                        3
                      </div>
                      <p className="text-sm font-bold text-foreground">Shielded Transfers</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Execute full peer-to-peer hidden-amount bridging. Validated opaquely
                        entirely via network consensus ZKP verification.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
