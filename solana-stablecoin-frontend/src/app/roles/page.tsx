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
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/page-header';
import { TxFeedback } from '@/components/tx-feedback';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
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
  Admin:
    'The ultimate authority over the stablecoin. Admins can grant and revoke any other role (including other admins), update global configuration parameters like the supply cap, and change the treasury account. This role should be held by a secure multisig or DAO.',
  Minter:
    "Authorized to issue new supply of the stablecoin. Minters can create tokens up to the global supply cap. Every minting event is tracked against the specific minter's quota for transparency and security.",
  Freezer:
    'Compliance-focused role. Freezers can lock (freeze) and unlock (thaw) individual token accounts. This is primarily used to satisfy legal requirements or to secure funds during investigations.',
  Pauser:
    'Emergency protocol role. Pausers can stop all transfers and minting operations across the entire stablecoin network simultaneously. Used during critical smart contract upgrades or major security incidents.',
  Burner:
    'Supply management role. Burners can permanently destroy tokens from any account, typically used for redemptions to fiat or clean up of unauthorized supply.',
  Blacklister:
    "Secondary compliance role specific to SSS-2. Blacklisters manage a list of addresses that are strictly prohibited from holding or transferring the stablecoin. Powered by Solana's Transfer Hook extension.",
  Seizer:
    'The most powerful compliance tool. Seizers can unilaterally move tokens from any account to a target destination using permanent delegate authority. This role functions even when the protocol is paused.',
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
    color: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    buttonVariant: 'primary',
  },
  check: {
    id: 'check',
    title: 'Check Role Status',
    description: 'Verify all roles held by an address. Scans all recursive permission levels.',
    icon: ScrollText,
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
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
  const [selectedRoles, setSelectedRoles] = useState<RoleName[]>(['Minter']);
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

      if (selectedRoles.length === 0) return;
      const roleValues = selectedRoles.map((r) => ROLE_DISPLAY_MAP[r]);

      let tx;

      if (operation === 'grant') {
        tx = await client.composeGrantRole(targetPubkey, roleValues);
      } else if (operation === 'revoke') {
        tx = await client.composeRevokeRole(targetPubkey, roleValues);
      }

      if (tx) {
        const sig = await execute(tx);
        if (sig) {
          setAddressInput('');
          setSelectedRoles([]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [canOperate, client, operation, addressInput, selectedRoles, execute, reset]);

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
                      className="w-full justify-between h-14 px-4 bg-background/50 hover:bg-background/80 border-border/40 hover:border-border/80 transition-all duration-200 shadow-sm"
                      onClick={() => setIsOpen(!isOpen)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-md border shadow-sm', activeOp.color)}>
                          <ActiveIcon size={18} />
                        </div>
                        <span className="font-semibold text-sm tracking-tight">
                          {activeOp.title}
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          'ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform duration-300',
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
                                  setSelectedRoles([]);
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
                          <div className="space-y-4">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                              Select Roles to {operation === 'grant' ? 'Grant' : 'Revoke'}
                            </Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {(Object.keys(ROLE_DISPLAY_MAP) as RoleName[]).map((role) => (
                                <div
                                  key={role}
                                  className={cn(
                                    'flex items-center space-x-2 border p-2.5 rounded-lg transition-all cursor-pointer relative group',
                                    selectedRoles.includes(role)
                                      ? 'bg-background/80 border-primary/50 ring-1 ring-primary/20'
                                      : 'bg-background/20 border-border/50 hover:bg-background/40',
                                  )}
                                  onClick={() => {
                                    if (selectedRoles.includes(role)) {
                                      setSelectedRoles(selectedRoles.filter((r) => r !== role));
                                    } else {
                                      setSelectedRoles([...selectedRoles, role]);
                                    }
                                  }}
                                >
                                  <Checkbox
                                    id={`role-${role}`}
                                    checked={selectedRoles.includes(role)}
                                    onCheckedChange={() => {}}
                                  />
                                  <div className="flex items-center justify-between flex-1 min-w-0">
                                    <Label
                                      htmlFor={`role-${role}`}
                                      className="capitalize cursor-pointer font-bold text-sm truncate"
                                    >
                                      {role}
                                    </Label>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Info size={14} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-[350px] text-xs">
                                        <p>{ROLE_DESCRIPTIONS[role]}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              ))}
                            </div>
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
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
                          <Card
                            key={role}
                            className="p-5 border-border/30 hover:border-primary/40 transition-all bg-background/30 shadow-sm"
                          >
                            <span className="text-lg font-bold block mb-2 text-primary">
                              {role}
                            </span>
                            <p className="text-base text-muted-foreground leading-relaxed">
                              {desc}
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
