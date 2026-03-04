'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PageHeader } from '@/components/page-header';
import { MintSelector } from '@/components/mint-selector';
import { useTokenState } from '@/hooks/use-token-state';
import { useMintHistory } from '@/hooks/use-mint-history';
import { useActiveMint } from '@/hooks/use-active-mint';
import { SSS_CORE_PROGRAM_ID } from '@/lib/constants';
import bs58 from 'bs58';

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
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 2);
  const wholeNum = Number(whole);
  const formatted = wholeNum.toLocaleString();
  return Number(fracStr) > 0 ? `${formatted}.${fracStr}` : formatted;
}

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { activeMint, setActiveMint } = useActiveMint();
  const { data, loading, error } = useTokenState(activeMint);
  const { addMint } = useMintHistory();
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const handleDiscover = async () => {
    if (!publicKey) return;
    setIsDiscovering(true);
    setDiscoveryError(null);

    try {
      const accounts = await connection.getProgramAccounts(SSS_CORE_PROGRAM_ID, {
        filters: [{ memcmp: { offset: 8, bytes: publicKey.toBase58() } }],
      });

      if (accounts.length === 0) {
        setDiscoveryError('No mints found for this authority.');
      } else {
        // Collect all mints found
        accounts.forEach((acc) => {
          // StablecoinConfig layout: discriminator (8) + authority (32) + mint (32)
          const mintAddrBytes = acc.account.data.slice(40, 72);
          const encoded = bs58.encode(mintAddrBytes);
          addMint(encoded);
        });

        // Select the first one discovered
        const firstMintBytes = accounts[0].account.data.slice(40, 72);
        const firstEncoded = bs58.encode(firstMintBytes);
        setActiveMint(firstEncoded);
      }
    } catch (e) {
      console.error(e);
      setDiscoveryError('Failed to discover mints. Please check your connection.');
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="p-6 space-y-6">
        <MintSelector
          onSelect={setActiveMint}
          currentMint={activeMint}
          onDiscover={handleDiscover}
          isDiscovering={isDiscovering}
        />

        {discoveryError && (
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
            <p className="text-xs text-warning">{discoveryError}</p>
          </div>
        )}

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
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <span className="text-lg font-bold">{data.symbol[0]}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{data.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {data.symbol} &middot; {data.decimals} decimals
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {data.presetName}
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Current Supply"
                value={formatSupply(data.currentSupply, data.decimals)}
                subtext={
                  data.supplyCap
                    ? `${Number((data.totalMinted * 1000n) / data.supplyCap) / 10}% of supply cap`
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
                    {formatSupply(data.totalMinted, data.decimals)} /{' '}
                    {formatSupply(data.supplyCap, data.decimals)}
                  </p>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-accent transition-all"
                    style={{
                      width: `${Math.min(Number((data.totalMinted * 100n) / data.supplyCap), 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Authority info */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Configuration</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Authority</span>
                  <code className="text-xs text-foreground font-mono">{data.authority}</code>
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
                {data.preset === 3 && (
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
