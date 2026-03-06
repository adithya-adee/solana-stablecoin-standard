'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useLedgerProgram } from '@/hooks/use-ledger-program';
import { useActiveMint } from '@/hooks/use-active-mint';
import { useMintHistory } from '@/hooks/use-mint-history';
import { PageHeader } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Search, RefreshCw, Wallet, Coins, CheckCircle2, PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESET_NAMES: Record<number, string> = {
  1: 'SSS-1',
  2: 'SSS-2',
  3: 'SSS-3',
};

const PRESET_COLORS: Record<number, string> = {
  1: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  2: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  3: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
};

interface TokenAccount {
  mint: string;
  name: string;
  symbol: string;
  preset: number;
  authority: string;
  paused: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

export default function TokensPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const program = useLedgerProgram();
  const { setActiveMint } = useActiveMint();
  const { addMint } = useMintHistory();

  const [tokens, setTokens] = useState<TokenAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterMint, setFilterMint] = useState('');
  const [filterAuthority, setFilterAuthority] = useState('');

  const fetchTokens = useCallback(async () => {
    if (!program || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all stablecoin configs in one RPC call
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accounts = await (program.account as any).stablecoinConfig.all();

      const mapped: TokenAccount[] = accounts.map((acc: any) => ({
        mint: acc.account.mint.toBase58(),
        name: acc.account.name.replace(/\0/g, '').trim(),
        symbol: acc.account.symbol.replace(/\0/g, '').trim(),
        preset: acc.account.preset,
        authority: acc.account.authority.toBase58(),
        paused: acc.account.paused,
        raw: acc,
      }));

      setTokens(mapped);
      setHasFetched(true);
    } catch (e) {
      console.error('Failed to fetch tokens:', e);
      setError('Failed to fetch tokens from the network.');
    } finally {
      setIsLoading(false);
    }
  }, [program, isLoading]);

  /** Apply all 3 filters client-side */
  const filtered = useMemo(() => {
    return tokens.filter((t) => {
      const nameMatch =
        filterName === '' || t.name.toLowerCase().includes(filterName.toLowerCase());
      const mintMatch =
        filterMint === '' || t.mint.toLowerCase().includes(filterMint.toLowerCase());
      const authorityMatch =
        filterAuthority === '' || t.authority.toLowerCase().includes(filterAuthority.toLowerCase());
      return nameMatch && mintMatch && authorityMatch;
    });
  }, [tokens, filterName, filterMint, filterAuthority]);

  const handleSelect = (token: TokenAccount) => {
    setActiveMint(token.mint);
    addMint(token.mint, {
      name: token.name,
      symbol: token.symbol,
      presetName: PRESET_NAMES[token.preset] ?? `Preset ${token.preset}`,
    });
    router.push('/');
  };

  if (!connected) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Tokens" />
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
          <Wallet className="w-8 h-8 opacity-40" />
          <p className="text-sm">Connect your wallet to view tokens.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Tokens" />

      <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Token Name</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                id="filter-name"
                placeholder="Search by name..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="pl-9 bg-background/50 h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Token Address (Mint)</Label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                id="filter-mint"
                placeholder="Filter by mint address..."
                value={filterMint}
                onChange={(e) => setFilterMint(e.target.value)}
                className="pl-9 bg-background/50 h-10 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Admin / Authority</Label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                id="filter-authority"
                placeholder="Filter by authority wallet..."
                value={filterAuthority}
                onChange={(e) => setFilterAuthority(e.target.value)}
                className="pl-9 bg-background/50 h-10 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Fetch Button */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {hasFetched
              ? `${filtered.length} of ${tokens.length} token${tokens.length !== 1 ? 's' : ''} shown`
              : 'Fetch all on-chain tokens to start browsing.'}
          </p>
          <Button
            onClick={fetchTokens}
            disabled={isLoading || !program}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            {isLoading ? 'Fetching...' : hasFetched ? 'Refresh' : 'Fetch Tokens'}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Token Grid */}
        {hasFetched &&
          (filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((token) => (
                <Card
                  key={token.mint}
                  className="border-border/50 bg-card/50 hover:border-border transition-all duration-200 overflow-hidden"
                >
                  <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">{token.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{token.symbol}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                          PRESET_COLORS[token.preset] ??
                            'bg-muted text-muted-foreground border-border',
                        )}
                      >
                        {PRESET_NAMES[token.preset] ?? `Preset ${token.preset}`}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Mint
                      </p>
                      <code className="text-[10px] font-mono text-foreground/70 break-all">
                        {token.mint}
                      </code>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {token.paused ? (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 text-yellow-500" />
                            <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">
                              Paused
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Active
                            </span>
                          </>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-3"
                        onClick={() => handleSelect(token)}
                      >
                        Select
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Coins className="w-8 h-8 opacity-30" />
              <p className="text-sm">No tokens match your filters.</p>
            </div>
          ))}
      </div>
    </div>
  );
}
