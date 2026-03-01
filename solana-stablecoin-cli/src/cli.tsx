#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import React from 'react';
import { render, Text } from 'ink';
import fs from 'fs';

import Status from './commands/status.js';
import Supply from './commands/supply.js';
import Init from './commands/init.js';
import Mint from './commands/mint.js';
import Burn from './commands/burn.js';
import Freeze from './commands/freeze.js';
import Thaw from './commands/thaw.js';
import Pause from './commands/pause.js';
import Seize from './commands/seize.js';
import Roles from './commands/roles.js';
import Blacklist from './commands/blacklist.js';
import Minters from './commands/minters.js';
import Holders from './commands/holders.js';
import AuditLog from './commands/audit-log.js';

// Wraps render() so Commander sees a void return (render returns Instance)
const r = (el: React.ReactElement): void => void render(el);

function getMintFromConfig(): string | undefined {
  const configPath = process.env.SSS_CONFIG ?? '.sss-config.json';
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.mint;
    } catch {
      // Ignore parsing errors
    }
  }
  return undefined;
}

const program = new Command();

program.name('sss-token').description('Solana Stablecoin Standard — Admin CLI').version('0.1.0');

// ─── Init ─────────────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Create a new SSS stablecoin (presets: sss-1 | sss-2 | sss-3)')
  .requiredOption('-n, --name <name>', 'Token name')
  .requiredOption('-s, --symbol <symbol>', 'Token symbol')
  .option('-p, --preset <preset>', 'Preset tier (sss-1 | sss-2 | sss-3)', 'sss-1')
  .option('-d, --decimals <decimals>', 'Decimals', '6')
  .option('--supply-cap <amount>', 'Maximum supply (raw, no decimals)')
  .option('--uri <uri>', 'Metadata URI')
  .option('--config <path>', 'JSON config file (overrides flags)')
  .option('--mint-keypair <path>', 'Path to mint keypair JSON (optional)')
  .action((opts) =>
    r(
      <Init
        options={{
          preset: opts.preset,
          name: opts.name,
          symbol: opts.symbol,
          decimals: opts.decimals,
          supplyCap: opts.supplyCap,
          uri: opts.uri,
          config: opts.config,
          mint: opts.mintKeypair,
        }}
      />,
    ),
  );

// ─── Status ───────────────────────────────────────────────────────────────────
program
  .command('status')
  .description('Fetch on-chain stablecoin status')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .action((opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    r(<Status options={{ mint }} />);
  });

// ─── Supply ───────────────────────────────────────────────────────────────────
program
  .command('supply')
  .description('Show circulating supply and cap utilisation')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .action((opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    r(<Supply options={{ mint }} />);
  });

// ─── Mint tokens ──────────────────────────────────────────────────────────────
program
  .command('mint')
  .description('Mint tokens to a recipient (requires minter role)')
  .argument('[recipient]', 'Recipient wallet address')
  .argument('[amount]', 'Human-readable amount (e.g. 100.5)')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-r, --recipient <address>', 'Recipient wallet address')
  .option('-a, --amount <amount>', 'Human-readable amount (e.g. 100.5)')
  .action((recipient, amount, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalRecipient = recipient || opts.recipient;
    if (!finalRecipient) {
      r(<Text color="red">Error: Recipient address is required.</Text>);
      return;
    }
    const finalAmount = amount || opts.amount;
    if (!finalAmount) {
      r(<Text color="red">Error: Amount is required.</Text>);
      return;
    }
    r(<Mint options={{ mint, recipient: finalRecipient, amount: finalAmount }} />);
  });

// ─── Burn ─────────────────────────────────────────────────────────────────────
program
  .command('burn')
  .description('Burn tokens from the signer ATA (requires burner role)')
  .argument('[amount]', 'Amount to burn')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --amount <amount>', 'Amount to burn')
  .action((amount, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAmount = amount || opts.amount;
    if (!finalAmount) {
      r(<Text color="red">Error: Amount is required.</Text>);
      return;
    }
    r(<Burn options={{ mint, amount: finalAmount }} />);
  });

// ─── Freeze ───────────────────────────────────────────────────────────────────
program
  .command('freeze')
  .description('Freeze a token account (requires freezer role)')
  .argument('[address]', 'Wallet to freeze')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Wallet to freeze')
  .action((address, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    r(<Freeze options={{ mint, address: finalAddress }} />);
  });

// ─── Thaw ─────────────────────────────────────────────────────────────────────
program
  .command('thaw')
  .description('Thaw a frozen token account (requires freezer role)')
  .argument('[address]', 'Wallet to thaw')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Wallet to thaw')
  .action((address, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    r(<Thaw options={{ mint, address: finalAddress }} />);
  });

// ─── Pause / Unpause ──────────────────────────────────────────────────────────
program
  .command('pause')
  .description('Pause all transfers (requires pauser role)')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .action((opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    r(<Pause options={{ mint }} />);
  });

program
  .command('unpause')
  .description('Unpause transfers (requires pauser role)')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .action((opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    r(<Pause options={{ mint, unpause: true }} />);
  });

// ─── Seize ────────────────────────────────────────────────────────────────────
program
  .command('seize')
  .description('Seize tokens from an account to treasury (SSS-2, requires seizer role)')
  .argument('[from]', 'Wallet to seize from')
  .argument('[to]', 'Treasury wallet to seize to')
  .argument('[amount]', 'Amount to seize')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-f, --from <address>', 'Wallet to seize from')
  .option('-t, --to <address>', 'Treasury wallet to seize to')
  .option('-a, --amount <amount>', 'Amount to seize')
  .action((from, to, amount, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalFrom = from || opts.from;
    if (!finalFrom) {
      r(<Text color="red">Error: "from" address is required.</Text>);
      return;
    }
    const finalTo = to || opts.to;
    if (!finalTo) {
      r(<Text color="red">Error: "to" address is required.</Text>);
      return;
    }
    const finalAmount = amount || opts.amount;
    if (!finalAmount) {
      r(<Text color="red">Error: Amount is required.</Text>);
      return;
    }
    r(<Seize options={{ mint, from: finalFrom, to: finalTo, amount: finalAmount }} />);
  });

// ─── Roles ────────────────────────────────────────────────────────────────────
const rolesCmd = program.command('roles').description('Role management');

rolesCmd
  .command('list')
  .description('List active roles for an address')
  .argument('[address]', 'Wallet to check')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Wallet to check')
  .action((address, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    r(<Roles options={{ mint, action: 'list', address: finalAddress }} />);
  });

rolesCmd
  .command('grant')
  .description('Grant a role to an address (admin only)')
  .argument('[address]', 'Recipient wallet')
  .argument('[role]', 'admin | minter | freezer | pauser | burner | blacklister | seizer')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Recipient wallet')
  .option('-r, --role <role>', 'admin | minter | freezer | pauser | burner | blacklister | seizer')
  .action((address, role, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    const finalRole = role || opts.role;
    if (!finalRole) {
      r(<Text color="red">Error: Role is required.</Text>);
      return;
    }
    r(<Roles options={{ mint, action: 'grant', address: finalAddress, role: finalRole }} />);
  });

rolesCmd
  .command('revoke')
  .description('Revoke a role from an address (admin only)')
  .argument('[address]', 'Wallet to revoke from')
  .argument('[role]', 'Role to revoke')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Wallet to revoke from')
  .option('-r, --role <role>', 'Role to revoke')
  .action((address, role, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    const finalRole = role || opts.role;
    if (!finalRole) {
      r(<Text color="red">Error: Role is required.</Text>);
      return;
    }
    r(<Roles options={{ mint, action: 'revoke', address: finalAddress, role: finalRole }} />);
  });

// ─── Blacklist (SSS-2 / SSS-3) ────────────────────────────────────────────────
const blCmd = program.command('blacklist').description('Blacklist management (SSS-2 / SSS-3)');

blCmd
  .command('check')
  .description('Check if an address is blacklisted')
  .argument('[address]', 'Address to check')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Address to check')
  .action((address, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    r(<Blacklist options={{ mint, action: 'check', address: finalAddress }} />);
  });

blCmd
  .command('add')
  .description('Add an address to the blacklist (blacklister role required)')
  .argument('[address]', 'Address to blacklist')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Address to blacklist')
  .option('--reason <string>', 'Reason for blacklisting (e.g. "OFAC match")', '')
  .action((address, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    r(<Blacklist options={{ mint, action: 'add', address: finalAddress, reason: opts.reason }} />);
  });

blCmd
  .command('remove')
  .description('Remove an address from the blacklist (blacklister role required)')
  .argument('[address]', 'Address to remove')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Address to remove')
  .action((address, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    r(<Blacklist options={{ mint, action: 'remove', address: finalAddress }} />);
  });

// ─── Minters ────────────────────────────────────────────────────────────────
const mintersCmd = program.command('minters').description('Minter management');

mintersCmd
  .command('check')
  .description('Check if an address has the minter role')
  .argument('[address]', 'Address to check')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Address to check')
  .action((address, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    r(<Minters options={{ mint, action: 'check', address: finalAddress }} />);
  });

mintersCmd
  .command('add')
  .description('Grant the minter role to an address')
  .argument('[address]', 'Recipient wallet')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Recipient wallet')
  .action((address, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    r(<Minters options={{ mint, action: 'add', address: finalAddress }} />);
  });

mintersCmd
  .command('remove')
  .description('Revoke the minter role from an address')
  .argument('[address]', 'Wallet to revoke from')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('-a, --address <address>', 'Wallet to revoke from')
  .action((address, opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    const finalAddress = address || opts.address;
    if (!finalAddress) {
      r(<Text color="red">Error: Address is required.</Text>);
      return;
    }
    r(<Minters options={{ mint, action: 'remove', address: finalAddress }} />);
  });

program
  .command('holders')
  .description('Scan for token holders')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('--min-balance <amount>', 'Minimum balance to include')
  .action((opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    r(<Holders options={{ mint, minBalance: opts.minBalance }} />);
  });

program
  .command('audit-log')
  .description('Parse transaction logs for audit trail')
  .option(
    '-m, --mint <address>',
    'Mint address (falls back to SSS_CONFIG, .sss-config.json or SSS_MINT env var)',
  )
  .option('--limit <limit>', 'Number of transactions to fetch', '20')
  .action((opts) => {
    const mint = opts.mint || getMintFromConfig() || process.env.SSS_MINT;
    if (!mint) {
      r(
        <Text color="red">
          Error: --mint option, SSS_CONFIG, .sss-config.json, or SSS_MINT environment variable must
          be set.
        </Text>,
      );
      return;
    }
    r(<AuditLog options={{ mint, limit: opts.limit }} />);
  });

import Tui from './tui.js';

// ─── TUI ──────────────────────────────────────────────────────────────────────
program
  .command('tui')
  .description('Launch the interactive admin dashboard')
  .action(() => {
    r(<Tui />);
  });

// Launch TUI by default if no args are provided
if (process.argv.length <= 2) {
  r(<Tui />);
} else {
  program.parse(process.argv);
}
