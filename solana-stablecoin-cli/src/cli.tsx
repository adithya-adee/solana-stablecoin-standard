#!/usr/bin/env node
import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';

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

// Wraps render() so Commander sees a void return (render returns Instance)
const r = (el: React.ReactElement): void => void render(el);

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
  .requiredOption('-m, --mint <address>', 'Mint address')
  .action((opts) => r(<Status options={{ mint: opts.mint }} />));

// ─── Supply ───────────────────────────────────────────────────────────────────
program
  .command('supply')
  .description('Show circulating supply and cap utilisation')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .action((opts) => r(<Supply options={{ mint: opts.mint }} />));

// ─── Mint tokens ──────────────────────────────────────────────────────────────
program
  .command('mint')
  .description('Mint tokens to a recipient (requires minter role)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-r, --recipient <address>', 'Recipient wallet address')
  .requiredOption('-a, --amount <amount>', 'Human-readable amount (e.g. 100.5)')
  .action((opts) =>
    r(<Mint options={{ mint: opts.mint, recipient: opts.recipient, amount: opts.amount }} />),
  );

// ─── Burn ─────────────────────────────────────────────────────────────────────
program
  .command('burn')
  .description('Burn tokens from the signer ATA (requires burner role)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-a, --amount <amount>', 'Amount to burn')
  .action((opts) => r(<Burn options={{ mint: opts.mint, amount: opts.amount }} />));

// ─── Freeze ───────────────────────────────────────────────────────────────────
program
  .command('freeze')
  .description('Freeze a token account (requires freezer role)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-a, --address <address>', 'Wallet to freeze')
  .action((opts) => r(<Freeze options={{ mint: opts.mint, address: opts.address }} />));

// ─── Thaw ─────────────────────────────────────────────────────────────────────
program
  .command('thaw')
  .description('Thaw a frozen token account (requires freezer role)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-a, --address <address>', 'Wallet to thaw')
  .action((opts) => r(<Thaw options={{ mint: opts.mint, address: opts.address }} />));

// ─── Pause / Unpause ──────────────────────────────────────────────────────────
program
  .command('pause')
  .description('Pause all transfers (requires pauser role)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .action((opts) => r(<Pause options={{ mint: opts.mint }} />));

program
  .command('unpause')
  .description('Unpause transfers (requires pauser role)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .action((opts) => r(<Pause options={{ mint: opts.mint, unpause: true }} />));

// ─── Seize ────────────────────────────────────────────────────────────────────
program
  .command('seize')
  .description('Seize tokens from an account to treasury (SSS-2, requires seizer role)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-f, --from <address>', 'Wallet to seize from')
  .requiredOption('-t, --to <address>', 'Treasury wallet to seize to')
  .requiredOption('-a, --amount <amount>', 'Amount to seize')
  .action((opts) =>
    r(<Seize options={{ mint: opts.mint, from: opts.from, to: opts.to, amount: opts.amount }} />),
  );

// ─── Roles ────────────────────────────────────────────────────────────────────
const rolesCmd = program.command('roles').description('Role management');

rolesCmd
  .command('list')
  .description('List active roles for an address')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-a, --address <address>', 'Wallet to check')
  .action((opts) =>
    r(<Roles options={{ mint: opts.mint, action: 'list', address: opts.address }} />),
  );

rolesCmd
  .command('grant')
  .description('Grant a role to an address (admin only)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-a, --address <address>', 'Recipient wallet')
  .requiredOption(
    '-r, --role <role>',
    'admin | minter | freezer | pauser | burner | blacklister | seizer',
  )
  .action((opts) =>
    r(
      <Roles
        options={{ mint: opts.mint, action: 'grant', address: opts.address, role: opts.role }}
      />,
    ),
  );

rolesCmd
  .command('revoke')
  .description('Revoke a role from an address (admin only)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-a, --address <address>', 'Wallet to revoke from')
  .requiredOption('-r, --role <role>', 'Role to revoke')
  .action((opts) =>
    r(
      <Roles
        options={{ mint: opts.mint, action: 'revoke', address: opts.address, role: opts.role }}
      />,
    ),
  );

// ─── Blacklist (SSS-2 / SSS-3) ────────────────────────────────────────────────
const blCmd = program.command('blacklist').description('Blacklist management (SSS-2 / SSS-3)');

blCmd
  .command('check')
  .description('Check if an address is blacklisted')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-a, --address <address>', 'Address to check')
  .action((opts) =>
    r(<Blacklist options={{ mint: opts.mint, action: 'check', address: opts.address }} />),
  );

blCmd
  .command('add')
  .description('Add an address to the blacklist (blacklister role required)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-a, --address <address>', 'Address to blacklist')
  .option('--reason <string>', 'Reason for blacklisting (e.g. "OFAC match")', '')
  .action((opts) =>
    r(
      <Blacklist
        options={{ mint: opts.mint, action: 'add', address: opts.address, reason: opts.reason }}
      />,
    ),
  );

blCmd
  .command('remove')
  .description('Remove an address from the blacklist (blacklister role required)')
  .requiredOption('-m, --mint <address>', 'Mint address')
  .requiredOption('-a, --address <address>', 'Address to remove')
  .action((opts) =>
    r(<Blacklist options={{ mint: opts.mint, action: 'remove', address: opts.address }} />),
  );

program.parse(process.argv);
