'use client';

import { useState, useCallback } from 'react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ShieldPlus, ShieldMinus, ScrollText } from 'lucide-react';
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

type Role = 'Admin' | 'Minter' | 'Freezer' | 'Pauser' | 'Burner' | 'Blacklister' | 'Seizer';

const ROLE_MAP: Record<Role, number> = {
  Admin: 0,
  Minter: 1,
  Freezer: 2,
  Pauser: 3,
  Burner: 4,
  Blacklister: 5,
  Seizer: 6,
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  Admin: 'Full authority. Can grant/revoke roles, update config, and manage supply cap.',
  Minter: 'Can mint new tokens up to the supply cap.',
  Freezer: 'Can freeze and thaw individual token accounts for compliance.',
  Pauser: 'Can pause and unpause all stablecoin operations in emergencies.',
  Burner: 'Can burn tokens from any token account for redemption or compliance.',
  Blacklister: 'Can add and remove addresses from the transfer hook blacklist (SSS-2).',
  Seizer: 'Can seize tokens via permanent delegate. Works even when paused.',
};

type OperationType = 'grant' | 'revoke' | 'info';

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
  grant: {
    id: 'grant',
    title: 'Grant Role',
    description: 'Assign a role to an address. Only the admin can grant roles.',
    icon: ShieldPlus,
    color: 'text-success bg-success/10 border-success/20',
    buttonVariant: 'primary',
  },
  revoke: {
    id: 'revoke',
    title: 'Revoke Role',
    description: 'Remove a role from an address. The role PDA will be closed and rent returned.',
    icon: ShieldMinus,
    color: 'text-destructive bg-destructive/10 border-destructive/20',
    buttonVariant: 'destructive',
  },
  info: {
    id: 'info',
    title: 'Role Descriptions',
    description: 'View details on the capabilities of each role type.',
    icon: ScrollText,
    color: 'text-accent bg-accent/10 border-accent/20',
    buttonVariant: 'primary',
  },
};

export default function RolesPage() {
  const { publicKey } = useWallet();
  const program = useCoreProgram();
  const { loading, error, signature, execute, reset } = useTransaction();

  const [activeMint, setActiveMint] = useState<string | null>(null);
  const [operation, setOperation] = useState<OperationType>('grant');
  const [isOpen, setIsOpen] = useState(false);

  const [addressInput, setAddressInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('Minter');

  const canOperate = !!publicKey && !!program && !!activeMint;

  const handleSubmit = useCallback(async () => {
    if (!canOperate) return;
    if (operation === 'info') return;
    if (!addressInput || !isValidPubkey(addressInput)) return;

    reset();

    const mintPubkey = new PublicKey(activeMint!);
    const [configPda] = deriveConfigPda(mintPubkey);
    const [adminRolePda] = deriveRolePda(configPda, publicKey!, ROLE_MAP.Admin);
    const targetPubkey = new PublicKey(addressInput);
    const roleValue = ROLE_MAP[selectedRole];
    const [roleAccountPda] = deriveRolePda(configPda, targetPubkey, roleValue);

    try {
      let tx;

      if (operation === 'grant') {
        tx = await program!.methods
          .grantRole(roleValue)
          .accountsPartial({
            admin: publicKey!,
            config: configPda,
            adminRole: adminRolePda,
            grantee: targetPubkey,
            roleAccount: roleAccountPda,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
      } else if (operation === 'revoke') {
        tx = await program!.methods
          .revokeRole()
          .accountsPartial({
            admin: publicKey!,
            config: configPda,
            adminRole: adminRolePda,
            roleAccount: roleAccountPda,
          })
          .transaction();
      }

      const sig = await execute(tx!);
      if (sig) {
        setAddressInput('');
      }
    } catch (err) {
      console.error(err);
    }
  }, [
    canOperate,
    operation,
    addressInput,
    selectedRole,
    activeMint,
    publicKey,
    program,
    execute,
    reset,
  ]);

  const activeOp = OPERATIONS[operation];
  const ActiveIcon = activeOp.icon;

  return (
    <div>
      <Navbar title="Role Management" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <MintSelector onSelect={setActiveMint} currentMint={activeMint} />

        {!activeMint && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Connect wallet and select a mint to view and manage roles.
            </p>
          </div>
        )}

        {!publicKey && activeMint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-warning/20 bg-warning/5 p-5 text-center shadow-sm"
          >
            <p className="text-sm text-warning font-medium">Connect your wallet to manage roles.</p>
          </motion.div>
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
                >
                  {operation !== 'info' ? (
                    <div className="space-y-5">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">
                          Target Wallet Address
                        </label>
                        <input
                          type="text"
                          value={addressInput}
                          onChange={(e) => setAddressInput(e.target.value)}
                          placeholder="Enter Solana wallet address..."
                          className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">
                          Role Type
                        </label>
                        <div className="relative">
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as Role)}
                            className="w-full appearance-none rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                          >
                            {Object.keys(ROLE_MAP).map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                            size={16}
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {ROLE_DESCRIPTIONS[selectedRole]}
                        </p>
                      </div>

                      <div className="pt-4 mt-2 border-t border-border/30">
                        <button
                          onClick={handleSubmit}
                          disabled={!canOperate || loading}
                          className={cn(
                            'w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition-all shadow-lg active:scale-[0.98]',
                            operation === 'grant'
                              ? 'bg-accent hover:bg-accent/80 text-white shadow-accent/20'
                              : 'bg-destructive hover:bg-destructive/80 text-white shadow-destructive/20',
                            (!canOperate || loading) &&
                              'opacity-50 cursor-not-allowed shadow-none active:scale-100',
                          )}
                        >
                          {loading
                            ? 'Processing...'
                            : `${operation === 'grant' ? 'Grant' : 'Revoke'} Role`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
                        <div
                          key={role}
                          className="flex flex-col gap-1 rounded-xl bg-background/50 p-4 border border-border/30 hover:border-accent/40 transition-colors"
                        >
                          <span className="text-sm font-bold text-foreground">{role}</span>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
