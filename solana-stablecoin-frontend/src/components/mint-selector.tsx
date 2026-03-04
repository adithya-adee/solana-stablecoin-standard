'use client';

import { useState } from 'react';
import { useMintHistory } from '@/hooks/use-mint-history';

interface MintSelectorProps {
  onSelect: (mintAddress: string) => void;
  currentMint: string | null;
  onDiscover?: () => void;
  isDiscovering?: boolean;
}

export function MintSelector({
  onSelect,
  currentMint,
  onDiscover,
  isDiscovering,
}: MintSelectorProps) {
  const [address, setAddress] = useState('');
  const { history, removeMint } = useMintHistory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      onSelect(address.trim());
      setAddress('');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Active Mint</h3>
      {currentMint ? (
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success" />
          <code className="text-xs text-foreground font-mono truncate">{currentMint}</code>
        </div>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          No mint selected. Enter a mint address below.
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter mint address..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80"
        >
          Load
        </button>
        {onDiscover && (
          <button
            type="button"
            onClick={onDiscover}
            disabled={isDiscovering}
            className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
          >
            {isDiscovering ? 'Searching...' : 'Discover My Mints'}
          </button>
        )}
      </form>

      {history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Recent Mints
          </p>
          <div className="space-y-1">
            {history.map((item) => (
              <div
                key={item.address}
                className="group flex items-center justify-between rounded-md p-2 hover:bg-accent/5 transition-colors"
                onClick={() => onSelect(item.address)}
              >
                <code className="cursor-pointer text-xs text-foreground font-mono truncate flex-1">
                  {item.address}
                </code>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMint(item.address);
                  }}
                  className="hidden group-hover:block text-muted-foreground hover:text-destructive transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
