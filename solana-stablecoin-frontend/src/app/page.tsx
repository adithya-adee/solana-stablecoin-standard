'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { PageHeader } from '@/components/page-header';
import { useTokenState } from '@/hooks/use-token-state';
import { useActiveMint } from '@/hooks/use-active-mint';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function StatCard({
  label,
  value,
  subtext,
  variant = 'default',
}: {
  label: string;
  value: string;
  subtext?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const variantStyles = {
    default: 'border-border',
    success: 'border-success/30',
    warning: 'border-warning/30',
    destructive: 'border-destructive/30',
  };

  const dotStyles = {
    default: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
  };

  return (
    <div className={`rounded-xl border bg-card p-5 ${variantStyles[variant]}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-2 w-2 rounded-full ${dotStyles[variant]}`} />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-card-foreground">{value}</p>
      {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
    </div>
  );
}

function QuickAction({
  label,
  description,
  href,
}: {
  label: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent/40 hover:bg-card/80"
    >
      <div>
        <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <svg
        className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </a>
  );
}

function formatSupply(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;

  const wholeStr = Number(whole).toLocaleString();
  if (frac === 0n) return wholeStr;

  // Pad the fraction with leading zeros to match decimal places, then remove trailing zeros
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');

  return fracStr.length > 0 ? `${wholeStr}.${fracStr}` : wholeStr;
}

export default function DashboardPage() {
  const { connected } = useWallet();
  const { activeMint } = useActiveMint();
  const { data, loading, error } = useTokenState(activeMint);

  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="p-6 space-y-6">
        {!connected && (
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-5 text-center">
            <p className="text-sm text-warning">
              Connect your wallet to fetch on-chain stablecoin data.
            </p>
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
              Fetching on-chain data...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
            <p className="text-sm text-destructive">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Make sure the mint address belongs to an SSS stablecoin.
            </p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Token identity */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Avatar className="h-20 w-20 border border-border bg-muted/30 shadow-sm transition-all duration-300 hover:scale-105">
                  <AvatarImage src={data.uri} alt={data.name} className="object-cover" />
                  <AvatarFallback className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-4xl font-semibold">
                    {data.symbol[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                    <h3 className="text-3xl font-bold tracking-tight text-foreground">
                      {data.name}
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/20">
                      {data.presetName}
                    </span>
                  </div>
                  <p className="text-lg text-muted-foreground flex items-center justify-center sm:justify-start gap-3">
                    <span className="font-semibold text-foreground/80">{data.symbol}</span>
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <span>{data.decimals} decimals</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Current Supply"
                value={formatSupply(data.currentSupply, data.decimals)}
                subtext={
                  data.supplyCap
                    ? `${Number((data.currentSupply * 1000n) / data.supplyCap) / 10}% of supply cap`
                    : 'No supply cap'
                }
                variant="success"
              />
              <StatCard
                label="Total Minted"
                value={formatSupply(data.totalMinted, data.decimals)}
                subtext="Lifetime issuance"
              />
              <StatCard
                label="Total Burned"
                value={formatSupply(data.totalBurned, data.decimals)}
                subtext="Lifetime burns"
              />
              <StatCard
                label="Pause Status"
                value={data.paused ? 'Paused' : 'Active'}
                subtext={data.paused ? 'All operations halted' : 'Operations running normally'}
                variant={data.paused ? 'destructive' : 'success'}
              />
            </div>

            {/* Supply cap bar */}
            {data.supplyCap && (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Supply Cap Utilization
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {formatSupply(data.currentSupply, data.decimals)} /{' '}
                    {formatSupply(data.supplyCap, data.decimals)}
                  </p>
                </div>
                <Progress
                  value={Math.min(Number((data.currentSupply * 100n) / data.supplyCap), 100)}
                  className="h-2"
                />
              </div>
            )}

            {/* Authority info */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Configuration</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Authority</span>
                  <code className="text-xs text-foreground font-mono">
                    {data.authority.toBase58()}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Preset</span>
                  <span className="text-sm text-foreground">{data.presetName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mint Address</span>
                  <code className="text-xs text-foreground font-mono">{activeMint}</code>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <QuickAction
                  label="Mint Tokens"
                  description="Issue new tokens to an address"
                  href="/operations"
                />
                <QuickAction
                  label="Manage Roles"
                  description="Grant or revoke operator roles"
                  href="/roles"
                />
                <QuickAction
                  label="Blacklist Management"
                  description="Add or remove addresses from blacklist"
                  href="/blacklist"
                />
                <QuickAction
                  label="Freeze / Thaw"
                  description="Freeze or unfreeze token accounts"
                  href="/operations"
                />
                {data.preset === 'sss-3' && (
                  <QuickAction
                    label="Confidential Transfers"
                    description="Manage private transfer operations"
                    href="/confidential"
                  />
                )}
                <QuickAction
                  label="Transaction History"
                  description="View audit trail of all operations"
                  href="/history"
                />
              </div>
            </div>
          </>
        )}

        {!activeMint && connected && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Enter a mint address above to view stablecoin dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
