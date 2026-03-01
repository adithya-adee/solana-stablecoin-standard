'use client';

import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Coins, Zap, Flame, ShieldAlert, Play, ShieldBan } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Navbar } from '@/components/navbar';
import { MintSelector } from '@/components/mint-selector';
import { TxFeedback } from '@/components/tx-feedback';
import { useCoreProgram } from '@/hooks/use-program';
import { useTransaction } from '@/hooks/use-transaction';
import { deriveConfigPda, deriveRolePda } from '@/lib/pda';
import { isValidPubkey } from '@/lib/validation';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ROLE_MINTER = 1;
const ROLE_FREEZER = 2;
const ROLE_PAUSER = 3;
const ROLE_BURNER = 4;

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
    description: 'Issue new tokens to a recipient token account. Requires minter role.',
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
      <label className="mb-2 block text-sm font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
      />
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'destructive' | 'warning';
  disabled?: boolean;
}) {
  const styles = {
    primary: 'bg-accent hover:bg-accent/80 text-white shadow-accent/20',
    destructive: 'bg-destructive hover:bg-destructive/80 text-white shadow-destructive/20',
    warning: 'bg-warning hover:bg-warning/80 text-black shadow-warning/20',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition-all shadow-lg active:scale-[0.98]',
        styles[variant],
        disabled && 'opacity-50 cursor-not-allowed shadow-none active:scale-100',
      )}
    >
      {children}
    </button>
  );
}

export default function OperationsPage() {
  const { publicKey } = useWallet();
  const program = useCoreProgram();
  const { loading, error, signature, execute, reset } = useTransaction();

  const [activeMint, setActiveMint] = useState<string | null>(null);
  const [operation, setOperation] = useState<OperationType>('mint');
  const [isOpen, setIsOpen] = useState(false);

  // Form State
  const [addressInput, setAddressInput] = useState('');
  const [amountInput, setAmountInput] = useState('');

  const canOperate = !!publicKey && !!program && !!activeMint;

  const handleSubmit = useCallback(async () => {
    if (!canOperate) return;

    // Address validation for ops that require it
    if (['mint', 'burn', 'freeze', 'thaw'].includes(operation)) {
      if (!addressInput || !isValidPubkey(addressInput)) return;
    }

    // Amount validation
    if (['mint', 'burn'].includes(operation)) {
      if (!amountInput || amountInput === '0') return;
    }

    reset();

    const mintPubkey = new PublicKey(activeMint!);
    const [configPda] = deriveConfigPda(mintPubkey);
    const userPubkey = publicKey!;

    try {
      let tx;

      if (operation === 'mint') {
        const [rolePda] = deriveRolePda(configPda, userPubkey, ROLE_MINTER);
        tx = await program!.methods
          .mintTokens(new BN(amountInput))
          .accountsPartial({
            minter: userPubkey,
            config: configPda,
            minterRole: rolePda,
            mint: mintPubkey,
            to: new PublicKey(addressInput),
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .transaction();
      } else if (operation === 'burn') {
        const [rolePda] = deriveRolePda(configPda, userPubkey, ROLE_BURNER);
        tx = await program!.methods
          .burnTokens(new BN(amountInput))
          .accountsPartial({
            burner: userPubkey,
            config: configPda,
            burnerRole: rolePda,
            mint: mintPubkey,
            from: new PublicKey(addressInput),
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .transaction();
      } else if (operation === 'freeze') {
        const [rolePda] = deriveRolePda(configPda, userPubkey, ROLE_FREEZER);
        tx = await program!.methods
          .freezeAccount()
          .accountsPartial({
            freezer: userPubkey,
            config: configPda,
            freezerRole: rolePda,
            mint: mintPubkey,
            tokenAccount: new PublicKey(addressInput),
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .transaction();
      } else if (operation === 'thaw') {
        const [rolePda] = deriveRolePda(configPda, userPubkey, ROLE_FREEZER);
        tx = await program!.methods
          .thawAccount()
          .accountsPartial({
            freezer: userPubkey,
            config: configPda,
            freezerRole: rolePda,
            mint: mintPubkey,
            tokenAccount: new PublicKey(addressInput),
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .transaction();
      } else if (operation === 'pause') {
        const [rolePda] = deriveRolePda(configPda, userPubkey, ROLE_PAUSER);
        tx = await program!.methods
          .pause()
          .accountsPartial({
            pauser: userPubkey,
            config: configPda,
            pauserRole: rolePda,
          })
          .transaction();
      } else if (operation === 'unpause') {
        const [rolePda] = deriveRolePda(configPda, userPubkey, ROLE_PAUSER);
        tx = await program!.methods
          .unpause()
          .accountsPartial({
            pauser: userPubkey,
            config: configPda,
            pauserRole: rolePda,
          })
          .transaction();
      }

      if (tx) await execute(tx);
    } catch (err) {
      console.error(err);
    }
  }, [
    canOperate,
    operation,
    addressInput,
    amountInput,
    activeMint,
    publicKey,
    program,
    execute,
    reset,
  ]);

  const activeOp = OPERATIONS[operation];
  const ActiveIcon = activeOp.icon;

  const requiresAddress = ['mint', 'burn', 'freeze', 'thaw'].includes(operation);
  const requiresAmount = ['mint', 'burn'].includes(operation);

  return (
    <div>
      <Navbar title="Token Operations" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <MintSelector onSelect={setActiveMint} currentMint={activeMint} />

        {!activeMint && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Select a mint address above to perform token operations.
            </p>
          </div>
        )}

        {!publicKey && activeMint && (
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-5 text-center shadow-sm">
            <p className="text-sm text-warning font-medium">
              Connect your wallet to execute transactions.
            </p>
          </div>
        )}

        <TxFeedback loading={loading} error={error} signature={signature} />

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
            <div className="bg-background/30 rounded-xl p-6 border border-border/30">
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
                  {requiresAddress && (
                    <FormInput
                      label={
                        operation === 'freeze' || operation === 'thaw'
                          ? 'Target Token Account'
                          : 'Recipient Token Account'
                      }
                      placeholder="Enter SPL token account address..."
                      value={addressInput}
                      onChange={setAddressInput}
                    />
                  )}
                  {requiresAmount && (
                    <FormInput
                      label="Amount (in raw units)"
                      placeholder="e.g. 1000000"
                      value={amountInput}
                      onChange={setAmountInput}
                      type="number"
                    />
                  )}

                  <div className="pt-4 mt-2 border-t border-border/30">
                    <ActionButton
                      onClick={handleSubmit}
                      variant={activeOp.buttonVariant}
                      disabled={!canOperate || loading}
                    >
                      {loading ? 'Processing...' : `Execute ${activeOp.title}`}
                    </ActionButton>
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
