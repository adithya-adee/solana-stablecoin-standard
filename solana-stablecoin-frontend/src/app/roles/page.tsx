'use client';

import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ShieldPlus, ShieldMinus, ScrollText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PageHeader } from '@/components/page-header';
import { MintSelector } from '@/components/mint-selector';
import { TxFeedback } from '@/components/tx-feedback';
import { useStablecoin } from '@/hooks/use-stablecoin';
import { useTransaction } from '@/hooks/use-transaction';
import { useActiveMint } from '@/hooks/use-active-mint';
import { isValidPubkey } from '@/lib/validation';
import { type AccessRole, asRole } from '@stbr/sss-token';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type RoleName = 'Admin' | 'Minter' | 'Freezer' | 'Pauser' | 'Burner' | 'Blacklister' | 'Seizer';

const ROLE_DISPLAY_MAP: Record<RoleName, AccessRole> = {
  Admin: asRole('admin'),
  Minter: asRole('minter'),
  Freezer: asRole('freezer'),
  Pauser: asRole('pauser'),
  Burner: asRole('burner'),
  Blacklister: asRole('blacklister'),
  Seizer: asRole('seizer'),
};

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  Admin: 'Full authority. Can grant/revoke roles, update config, and manage supply cap.',
  Minter: 'Can mint new tokens up to the supply cap.',
  Freezer: 'Can freeze and thaw individual token accounts for compliance.',
  Pauser: 'Can pause and unpause all stablecoin operations in emergencies.',
  Burner: 'Can burn tokens from any token account for redemption or compliance.',
  Blacklister: 'Can add and remove addresses from the transfer hook blacklist (SSS-2).',
  Seizer: 'Can seize tokens via permanent delegate. Works even when paused.',
};

type OperationType = 'grant' | 'revoke' | 'check' | 'info';

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
  check: {
    id: 'check',
    title: 'Check Role Status',
    description: 'Verify all roles held by an address. Scans all recursive permission levels.',
    icon: ScrollText,
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    buttonVariant: 'primary',
  },
};

export default function RolesPage() {
  const { publicKey } = useWallet();
  const { client, loading: clientLoading } = useStablecoin();
  const { loading: txLoading, error, signature, execute, reset } = useTransaction();

  const { activeMint, setActiveMint } = useActiveMint();
  const [operation, setOperation] = useState<OperationType>('grant');
  const [isOpen, setIsOpen] = useState(false);

  const [addressInput, setAddressInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleName>('Minter');
  const [foundRoles, setFoundRoles] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedAddress, setLastCheckedAddress] = useState<string | null>(null);

  const loading = clientLoading || txLoading;
  const canOperate = !!publicKey && !!client && !!activeMint;

  const handleSubmit = useCallback(async () => {
    if (!canOperate || !client) return;
    if (operation === 'info') return;
    if (!addressInput || !isValidPubkey(addressInput)) return;

    reset();

    const targetPubkey = new PublicKey(addressInput);
    const roleValue = ROLE_DISPLAY_MAP[selectedRole];

    try {
      if (operation === 'check') {
        setIsChecking(true);
        setFoundRoles([]);
        setLastCheckedAddress(addressInput);

        const results = [];
        // We still use the internal ledgerProgram for bulk scan to get full objects
        for (const [roleName, sdkRole] of Object.entries(ROLE_DISPLAY_MAP)) {
          try {
            const [pda] = client.resolveRoleAccount(targetPubkey, sdkRole);
            const info = await (client.ledgerProgram.account as any).roleAccount.fetch(pda);
            results.push({
              name: roleName,
              ...info,
            });
          } catch (e) {
            // Role not found, skip
          }
        }

        setFoundRoles(results);
        setIsChecking(false);
        return;
      }

      let tx;

      if (operation === 'grant') {
        tx = await client.composeGrantRole(targetPubkey, roleValue);
      } else if (operation === 'revoke') {
        tx = await client.composeRevokeRole(targetPubkey, roleValue);
      }

      if (tx) {
        const sig = await execute(tx);
        if (sig) {
          setAddressInput('');
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [canOperate, client, operation, addressInput, selectedRole, execute, reset]);

  const activeOp = OPERATIONS[operation];
  const ActiveIcon = activeOp.icon;

  return (
    <div>
      <PageHeader title="Role Management" />
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

                      {operation !== 'check' && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-muted-foreground">
                            Role Type
                          </label>
                          <div className="relative">
                            <select
                              value={selectedRole}
                              onChange={(e) => setSelectedRole(e.target.value as RoleName)}
                              className="w-full appearance-none rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                            >
                              {Object.keys(ROLE_DISPLAY_MAP).map((r) => (
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
                      )}

                      {operation === 'check' && (
                        <div className="pt-2">
                          {isChecking && (
                            <div className="flex flex-col items-center py-8 gap-3">
                              <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                              <p className="text-xs text-muted-foreground italic">
                                Scanning all role levels...
                              </p>
                            </div>
                          )}

                          {!isChecking && lastCheckedAddress && (
                            <div className="space-y-3">
                              {foundRoles.length > 0 ? (
                                <>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Active Permissions Found
                                  </p>
                                  <div className="grid grid-cols-1 gap-3">
                                    {foundRoles.map((role) => (
                                      <div
                                        key={role.name}
                                        className="rounded-xl border border-success/20 bg-success/5 p-4 space-y-3"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-success ring-4 ring-success/20 animate-pulse" />
                                            <p className="text-sm font-bold text-success capitalize">
                                              {role.name}
                                            </p>
                                          </div>
                                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                                            Active
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                                          <div>
                                            <span className="text-muted-foreground block mb-0.5">
                                              Granted By
                                            </span>
                                            <code className="text-foreground font-mono truncate block bg-background/50 px-1.5 py-0.5 rounded border border-border/50">
                                              {role.grantedBy.toBase58()}
                                            </code>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground block mb-0.5">
                                              Granted At
                                            </span>
                                            <span className="text-foreground block px-1.5 py-0.5">
                                              {new Date(
                                                role.grantedAt.toNumber() * 1000,
                                              ).toLocaleDateString()}
                                            </span>
                                          </div>
                                          {role.name === 'Minter' && (
                                            <div className="col-span-2 pt-2 border-t border-success/10 mt-1">
                                              <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">
                                                  Tokens Minted
                                                </span>
                                                <span className="text-foreground font-mono font-bold bg-success/10 px-2 py-0.5 rounded">
                                                  {role.amountMinted.toString()}
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div className="rounded-xl border border-dashed border-border bg-muted/10 p-10 text-center">
                                  <div className="inline-flex items-center justify-center p-3 rounded-full bg-muted mb-4">
                                    <ShieldMinus className="text-muted-foreground" size={24} />
                                  </div>
                                  <h4 className="text-sm font-semibold text-foreground">
                                    No Permissions Found
                                  </h4>
                                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
                                    This address does not hold any roles for the selected
                                    stablecoin.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="pt-4 mt-2 border-t border-border/30">
                        <button
                          onClick={handleSubmit}
                          disabled={
                            !canOperate ||
                            (operation !== 'check' && loading) ||
                            (operation === 'check' && isChecking)
                          }
                          className={cn(
                            'w-full rounded-xl px-4 py-3.5 text-sm font-semibold transition-all shadow-lg active:scale-[0.98]',
                            operation === 'grant'
                              ? 'bg-accent hover:bg-accent/80 text-white shadow-accent/20'
                              : operation === 'revoke'
                                ? 'bg-destructive hover:bg-destructive/80 text-white shadow-destructive/20'
                                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20',
                            (!canOperate || loading) &&
                              operation !== 'check' &&
                              'opacity-50 cursor-not-allowed shadow-none active:scale-100',
                          )}
                        >
                          {loading || isChecking
                            ? 'Processing...'
                            : operation === 'grant'
                              ? 'Grant Role'
                              : operation === 'revoke'
                                ? 'Revoke Role'
                                : 'Check Status'}
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
