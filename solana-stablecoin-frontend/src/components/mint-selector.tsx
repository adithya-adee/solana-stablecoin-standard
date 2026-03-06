'use client';

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMintHistory } from '@/hooks/use-mint-history';
import { useActiveMint } from '@/hooks/use-active-mint';
import { Compass, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Compact sidebar token picker — shows recently used tokens and links to the
 *  full discovery page. */
export function MintSelector() {
  const { connected } = useWallet();
  const { activeMint, setActiveMint } = useActiveMint();
  const { history, removeMint } = useMintHistory();

  if (!connected) return null;

  return (
    <div className="px-3 py-3 space-y-2">
      {/* Recent mints list */}
      <div className="space-y-1 max-h-[240px] overflow-y-auto scrollbar-none">
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
                        ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]'
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
          <p className="text-[10px] text-muted-foreground/40 italic px-1 py-1">
            No mints selected yet
          </p>
        )}
      </div>

      {/* Discover link */}
      <Link
        href="/tokens"
        className="flex items-center justify-center gap-2 h-8 w-full rounded-md border border-primary/20 bg-primary/5 text-primary text-[11px] font-semibold hover:bg-primary/10 transition-colors"
      >
        <Compass className="w-3.5 h-3.5 shrink-0" />
        Discover Tokens
      </Link>
    </div>
  );
}
