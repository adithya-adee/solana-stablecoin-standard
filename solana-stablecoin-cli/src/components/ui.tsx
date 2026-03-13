import React, { useEffect, useState } from 'react';
import { Box, Text, Newline } from 'ink';
import Link from 'ink-link';
import { formatExplorerUrl } from '../utils/config.js';
import { Theme, Icons } from '../utils/theme.js';

// ─── Brand bar ──────────────────────────────────────────────────────────────

export function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={Theme.highlight as any}>
          {Icons.sparkle} SSS
        </Text>
        <Text color={Theme.dim as any}> · Solana Stablecoin Standard</Text>
      </Box>
      <Box>
        <Text color={Theme.dim as any}>{'─'.repeat(46)}</Text>
      </Box>
    </Box>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface SpinnerProps {
  label: string;
}
export function Spinner({ label }: SpinnerProps) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return (
    <Box>
      <Text color={Theme.primary as any}>{FRAMES[frame]} </Text>
      <Text color={Theme.dim as any}>{label}</Text>
    </Box>
  );
}

// ─── Success / Error ─────────────────────────────────────────────────────────

interface ResultProps {
  label?: string;
  value: string;
}
export function Success({ label = 'Success', value }: ResultProps) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={Theme.success as any} bold>
          {Icons.checkmark} {label}
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={Theme.dim as any}>tx: </Text>
        {/* @ts-ignore ink-link types conflict with react typings in this build setup */}
        <Link url={formatExplorerUrl(value)}>
          <Text color={Theme.text as any}>{value}</Text>
        </Link>
      </Box>
    </Box>
  );
}

export function Err({ message }: { message: string }) {
  return (
    <Box marginTop={1}>
      <Text color={Theme.error as any} bold>
        {Icons.cross} Error:{' '}
      </Text>
      <Text color={Theme.error as any}>{message}</Text>
    </Box>
  );
}

// ─── Info row ────────────────────────────────────────────────────────────────

interface RowProps {
  label: string;
  value: string;
  color?: string;
}
export function Row({ label, value, color = Theme.text }: RowProps) {
  const padded = label.padEnd(16, ' ');
  return (
    <Box>
      <Text color={Theme.dim as any}>{padded}</Text>
      <Text color={color as any} bold>
        {value}
      </Text>
    </Box>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  title: string;
  children: React.ReactNode;
}
export function Card({ title, children }: CardProps) {
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Box marginBottom={0} marginTop={-1} marginLeft={2}>
        <Text color={Theme.primary as any} bold backgroundColor="black">
          {' '}
          {Icons.dot} {title}{' '}
        </Text>
      </Box>
      <Box flexDirection="column" paddingLeft={1} marginBottom={0}>
        {children}
      </Box>
    </Box>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

interface TableProps {
  rows: { key: React.ReactNode; value: React.ReactNode; highlight?: boolean }[];
}
export function Table({ rows }: TableProps) {
  // Rough estimation for padding if key is string, otherwise default
  const maxKeyLen = Math.max(...rows.map((r) => (typeof r.key === 'string' ? r.key.length : 16)));
  return (
    <Box flexDirection="column">
      {rows.map((r, i) => (
        <Box key={i}>
          <Box width={maxKeyLen + 2}>
            {typeof r.key === 'string' ? <Text color={Theme.dim as any}>{r.key}</Text> : r.key}
          </Box>
          {typeof r.value === 'string' ? (
            <Text color={(r.highlight ? Theme.warning : Theme.text) as any}>{r.value}</Text>
          ) : (
            r.value
          )}
        </Box>
      ))}
    </Box>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'confidential';
const BADGE_COLORS: Record<BadgeVariant, string> = {
  success: Theme.success,
  warning: Theme.warning,
  error: Theme.error,
  info: Theme.primary,
  confidential: Theme.highlight,
};

export function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <Text color={BADGE_COLORS[variant] as any} bold>
      {' '}
      [{label}]{' '}
    </Text>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider() {
  return (
    <Box marginY={1}>
      <Text color={Theme.dim as any}>{'─'.repeat(40)}</Text>
    </Box>
  );
}

// ─── Pagination Info ─────────────────────────────────────────────────────────

interface PageInfoProps {
  page: number;
  total?: number;
  pageSize: number;
  hasMore: boolean;
}

export function PageInfo({ page, total, pageSize, hasMore }: PageInfoProps) {
  return (
    <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
      <Box>
        <Text color={Theme.dim as any}>
          Page <Text color="white">{page}</Text>
          {total ? ` of ${Math.ceil(total / pageSize)}` : ''}
        </Text>
      </Box>
      <Box>
        {page > 1 && <Text color="cyanBright">« [p]rev </Text>}
        {hasMore && <Text color="cyanBright"> [n]ext »</Text>}
      </Box>
    </Box>
  );
}
