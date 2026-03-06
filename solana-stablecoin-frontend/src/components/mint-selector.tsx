'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useMintHistory } from '@/hooks/use-mint-history';
import { useActiveMint } from '@/hooks/use-active-mint';
import { useLedgerProgram } from '@/hooks/use-ledger-program';
import { TokenService } from '@/lib/services/token-service';
import { Search, History, Compass, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MintSelector() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const program = useLedgerProgram();
  const { activeMint, setActiveMint } = useActiveMint();
  const { history, addMint, removeMint } = useMintHistory();

  const [address, setAddress] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mintAddr = address.trim();
    if (!mintAddr || isSearching) return;

    setIsSearching(true);
    setError(null);

    try {
      // Fetch metadata using TokenService
      const state = await TokenService.fetchTokenState(connection, mintAddr);

      setActiveMint(mintAddr);
      addMint(mintAddr, {
        name: state.name,
        symbol: state.symbol,
        presetName: state.presetName,
      });
      setAddress('');
    } catch (e) {
      console.error('Failed to resolve mint metadata:', e);
      // Still add but without metadata if fetch fails (fallback)
      setActiveMint(mintAddr);
      addMint(mintAddr);
      setAddress('');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDiscover = async () => {
    if (!publicKey || !program || isDiscovering) return;
    setIsDiscovering(true);
    setError(null);

    try {
      // Use Anchor's .all() to fetch and decode all matching configs in one go
      const accounts = await (program.account as any).stablecoinConfig.all([
        { memcmp: { offset: 8, bytes: publicKey.toBase58() } },
      ]);

      if (accounts.length === 0) {
        setError('No mints found for this authority.');
      } else {
        const PRESET_NAMES: Record<number, string> = {
          1: 'SSS-1',
          2: 'SSS-2',
          3: 'SSS-3',
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        accounts.forEach((acc: any) => {
          const data = acc.account;
          addMint(data.mint.toBase58(), {
            name: data.name,
            symbol: data.symbol,
            presetName: PRESET_NAMES[data.preset] ?? `Preset ${data.preset}`,
          });
        });

        const firstMint = accounts[0].account.mint.toBase58();
        setActiveMint(firstMint);
      }
    } catch (e) {
      console.error('Discovery failed:', e);
      setError('Discovery failed.');
    } finally {
      setIsDiscovering(false);
    }
  };

  if (!connected) return null;

  return (
    <div className="px-3 py-4 space-y-4">
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative group">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter mint address..."
          disabled={isSearching}
          className="w-full bg-muted/50 border border-border h-9 pl-9 pr-8 text-[11px] rounded-md focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/60 disabled:opacity-50"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          ) : (
            <Search className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
          )}
        </div>
      </form>

      {/* Discover Button */}
      <button
        onClick={handleDiscover}
        disabled={isDiscovering || !program}
        className="w-full h-9 flex items-center justify-center gap-2 rounded-md border border-accent/20 bg-accent/5 px-3 text-xs font-semibold text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
      >
        {isDiscovering ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Compass className="w-3.5 h-3.5" />
        )}
        <span>{isDiscovering ? 'Searching...' : 'Discover Mints'}</span>
      </button>

      {error && <p className="text-[10px] text-destructive px-1">{error}</p>}

      {/* History / Active Mint List */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <History className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Selection
          </span>
        </div>

        <div className="space-y-1 max-h-[280px] overflow-y-auto scrollbar-none pr-1">
          {history.length > 0 ? (
            history.map((item) => (
              <div
                key={item.address}
                className={cn(
                  'group flex flex-col gap-0.5 rounded-md px-2.5 py-2 cursor-pointer transition-all border border-transparent',
                  activeMint === item.address
                    ? 'bg-primary/5 border-primary/20 text-primary ring-1 ring-primary/10'
                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setActiveMint(item.address)}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0',
                        activeMint === item.address
                          ? 'bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                          : 'bg-muted-foreground/20',
                      )}
                    />
                    <span className="text-xs font-semibold truncate leading-none">
                      {item.name || 'Unknown Token'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMint(item.address);
                      if (activeMint === item.address) setActiveMint(null);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center justify-between px-3.5">
                  <span className="text-[10px] text-muted-foreground/70 font-medium">
                    {item.presetName || 'SSS'}
                  </span>
                  <code className="text-[9px] font-mono text-muted-foreground/50 group-hover:text-muted-foreground/80 transition-colors">
                    {item.address.slice(0, 4)}...{item.address.slice(-4)}
                  </code>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-muted-foreground/40 italic px-1 py-1">No mints loaded</p>
          )}
        </div>
      </div>
    </div>
  );
}
