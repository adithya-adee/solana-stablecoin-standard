import React, { useEffect, useState } from 'react';
import { Box, Text, Newline } from 'ink';

// ─── Brand bar ──────────────────────────────────────────────────────────────

export function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyanBright">
          ◆{' '}
        </Text>
        <Text bold color="white">
          SSS
        </Text>
        <Text color="gray"> · Solana Stablecoin Standard</Text>
      </Box>
      <Box>
        <Text color="gray">{'─'.repeat(46)}</Text>
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
      <Text color="cyanBright">{FRAMES[frame]} </Text>
      <Text color="gray">{label}</Text>
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
        <Text color="greenBright" bold>
          ✓ {label}
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text color="gray">tx: </Text>
        <Text color="white">{value}</Text>
      </Box>
    </Box>
  );
}

export function Err({ message }: { message: string }) {
  return (
    <Box marginTop={1}>
      <Text color="redBright" bold>
        ✗ Error:{' '}
      </Text>
      <Text color="red">{message}</Text>
    </Box>
  );
}

// ─── Info row ────────────────────────────────────────────────────────────────

interface RowProps {
  label: string;
  value: string;
  color?: string;
}
export function Row({ label, value, color = 'white' }: RowProps) {
  const padded = label.padEnd(16, ' ');
  return (
    <Box>
      <Text color="gray">{padded}</Text>
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
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={0}>
        <Text color="cyanBright" bold>
          ┌{' '}
        </Text>
        <Text color="white" bold>
          {title}
        </Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        {children}
      </Box>
    </Box>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

interface TableProps {
  rows: { key: string; value: string; highlight?: boolean }[];
}
export function Table({ rows }: TableProps) {
  const maxKey = Math.max(...rows.map((r) => r.key.length));
  return (
    <Box flexDirection="column">
      {rows.map((r, i) => (
        <Box key={i}>
          <Text color="gray">{r.key.padEnd(maxKey + 2, ' ')}</Text>
          <Text color={r.highlight ? 'yellowBright' : 'white'}>{r.value}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'error' | 'info';
const BADGE_COLORS: Record<BadgeVariant, string> = {
  success: 'greenBright',
  warning: 'yellowBright',
  error: 'redBright',
  info: 'cyanBright',
};

export function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <Text color={BADGE_COLORS[variant] as any} bold>
      {' '}
      [{label}]{' '}
    </Text>
  );
}
