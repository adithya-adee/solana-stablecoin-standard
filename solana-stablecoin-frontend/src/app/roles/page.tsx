'use client';

import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ShieldPlus, ShieldMinus, ScrollText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/page-header';
import { TxFeedback } from '@/components/tx-feedback';
import { useStablecoin } from '@/hooks/use-stablecoin';
import { useTransaction } from '@/hooks/use-transaction';
import { useActiveMint } from '@/hooks/use-active-mint';
import { isValidPubkey } from '@/lib/validation';
import { type AccessRole, asRole, SssCore } from '@stbr/sss-token';
import { AccountNamespace } from '@coral-xyz/anchor';
import { cn } from '@/lib/utils';

type RoleName = 'Admin' | 'Minter' | 'Freezer' | 'Pauser' | 'Burner' | 'Blacklister' | 'Seizer';

type CheckedRole = {
  name: RoleName;
  grantedBy: PublicKey;
  grantedAt: { toNumber(): number };
  amountMinted?: { toString(): string };
};

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

  const { activeMint } = useActiveMint();
  const [operation, setOperation] = useState<OperationType>('grant');
  const [isOpen, setIsOpen] = useState(false);

  const [addressInput, setAddressInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleName>('Minter');
  const [foundRoles, setFoundRoles] = useState<CheckedRole[]>([]);
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

        try {
          const roleEntries = Object.entries(ROLE_DISPLAY_MAP) as [RoleName, AccessRole][];
          const results = await Promise.all(
            roleEntries.map(async ([roleName, sdkRole]) => {
              try {
                const [pda] = client.resolveRoleAccount(targetPubkey, sdkRole);
                const info = await (
                  client.ledgerProgram.account as AccountNamespace<SssCore>
                ).roleAccount.fetch(pda);
                return {
                  name: roleName,
                  ...info,
                } as CheckedRole;
              } catch {
                return null;
              }
            }),
          );

          setFoundRoles(results.filter((role): role is CheckedRole => role !== null));
        } finally {
          setIsChecking(false);
        }

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
    <div className="flex flex-col gap-6">
      <PageHeader title="Role Management" />
      <div className="p-6 space-y-6 max-w-4xl mx-auto w-full">
        {!activeMint && (
          <Card className="p-12 text-center border-dashed">
            <CardDescription>
              Connect wallet and select a mint to view and manage roles.
            </CardDescription>
          </Card>
        )}

        {!publicKey && activeMint && (
          <Card className="border-warning/50 bg-warning/5 p-4 text-center">
            <p className="text-sm text-warning font-medium">Connect your wallet to manage roles.</p>
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

                    {operation !== 'info' ? (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="address">Target Wallet Address</Label>
                          <Input
                            id="address"
                            placeholder="Enter Solana wallet address..."
                            value={addressInput}
                            onChange={(e) => setAddressInput(e.target.value)}
                            className="bg-background/50 h-11"
                          />
                        </div>

                        {operation !== 'check' && (
                          <div className="space-y-2">
                            <Label>Role Type</Label>
                            <Select
                              value={selectedRole}
                              onValueChange={(v) => setSelectedRole(v as RoleName)}
                            >
                              <SelectTrigger className="bg-background/50 h-11">
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(ROLE_DISPLAY_MAP).map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {ROLE_DESCRIPTIONS[selectedRole]}
                            </p>
                          </div>
                        )}

                        {operation === 'check' && (
                          <div className="pt-2">
                            {isChecking && (
                              <div className="flex flex-col items-center py-8 gap-3">
                                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
                                    <div className="space-y-3">
                                      {foundRoles.map((role) => (
                                        <Card
                                          key={role.name}
                                          className="border-success/20 bg-success/5 p-4 space-y-3"
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="h-2 w-2 rounded-full bg-success ring-4 ring-success/20 animate-pulse" />
                                              <p className="text-sm font-bold text-success capitalize">
                                                {role.name}
                                              </p>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded">
                                              Active
                                            </span>
                                          </div>

                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                            <div>
                                              <span className="text-muted-foreground block mb-1">
                                                Granted By
                                              </span>
                                              <code className="text-foreground font-mono truncate block bg-background/50 px-2 py-1.5 rounded border border-border/50">
                                                {role.grantedBy.toBase58()}
                                              </code>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground block mb-1">
                                                Granted At
                                              </span>
                                              <span className="text-foreground block px-2 py-1.5">
                                                {new Date(
                                                  role.grantedAt.toNumber() * 1000,
                                                ).toLocaleDateString()}
                                              </span>
                                            </div>
                                            {role.name === 'Minter' && (
                                              <div className="col-span-1 sm:col-span-2 pt-2 border-t border-success/10">
                                                <div className="flex justify-between items-center">
                                                  <span className="text-muted-foreground">
                                                    Tokens Minted
                                                  </span>
                                                  <span className="text-foreground font-mono font-bold bg-success/10 px-2 py-1 rounded">
                                                    {role.amountMinted?.toString() ?? '0'}
                                                  </span>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </Card>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <Card className="p-10 text-center border-dashed">
                                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-muted mb-4 text-muted-foreground">
                                      <ShieldMinus size={24} />
                                    </div>
                                    <h4 className="text-sm font-semibold">No Permissions Found</h4>
                                    <CardDescription className="mt-1">
                                      This address does not hold any roles for the selected
                                      stablecoin.
                                    </CardDescription>
                                  </Card>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <Button
                          className="w-full h-12 text-base font-semibold"
                          variant={
                            operation === 'revoke'
                              ? 'destructive'
                              : operation === 'check'
                                ? 'secondary'
                                : 'default'
                          }
                          onClick={handleSubmit}
                          disabled={
                            !canOperate ||
                            (operation !== 'check' && loading) ||
                            (operation === 'check' && isChecking)
                          }
                        >
                          {loading || isChecking
                            ? 'Processing...'
                            : operation === 'grant'
                              ? 'Grant Role'
                              : operation === 'revoke'
                                ? 'Revoke Role'
                                : 'Check Status'}
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
                          <Card
                            key={role}
                            className="p-4 border-border/30 hover:border-primary/30 transition-colors bg-background/30"
                          >
                            <span className="text-sm font-bold block mb-1">{role}</span>
                            <CardDescription className="text-xs">{desc}</CardDescription>
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
