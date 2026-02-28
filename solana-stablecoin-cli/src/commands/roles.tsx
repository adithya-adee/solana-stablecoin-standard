import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SSS, roleType, roleId } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { Header, Spinner, Success, Err, Card } from '../components/ui.js';
import { loadProvider } from '../utils/config.js';

type RoleAction = 'grant' | 'revoke' | 'check';
type ValidRole = 'admin' | 'minter' | 'freezer' | 'pauser' | 'burner' | 'blacklister' | 'seizer';
const ALL_ROLES: ValidRole[] = [
  'admin',
  'minter',
  'freezer',
  'pauser',
  'burner',
  'blacklister',
  'seizer',
];

interface RolesOptions {
  mint: string;
  action: RoleAction | 'list';
  address?: string;
  role?: string;
}

export default function Roles({ options }: { options: RolesOptions }) {
  const [phase, setPhase] = useState<'running' | 'done' | 'error'>('running');
  const [sig, setSig] = useState('');
  const [roleInfos, setRoleInfos] = useState<{ address: string; role: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const sss = await SSS.load(provider, mint as any);

        if (options.action === 'list') {
          // SDK has no .list(), so we check all roles for the wallet address as a convenience
          if (!options.address)
            throw new Error(
              '--address is required for roles list (shows roles for a specific wallet)',
            );
          const addr = new PublicKey(options.address);
          const results: { address: string; role: string }[] = [];
          for (const r of ALL_ROLES) {
            const has = await sss.roles.check(addr, roleType(r));
            if (has) results.push({ address: addr.toBase58(), role: r });
          }
          setRoleInfos(results);
        } else {
          if (!options.address || !options.role) {
            throw new Error('--address and --role are required');
          }
          const addr = new PublicKey(options.address);
          const role = roleType(options.role as ValidRole);
          if (options.action === 'grant') {
            setSig(await sss.roles.grant(addr, role));
          } else if (options.action === 'revoke') {
            setSig(await sss.roles.revoke(addr, role));
          } else {
            const has = await sss.roles.check(addr, role);
            setSig(has ? 'Yes — role is active' : 'No — role not found');
          }
        }
        setPhase('done');
      } catch (e: any) {
        setError(e.message ?? String(e));
        setPhase('error');
      }
    })();
  }, []);

  return (
    <Box flexDirection="column">
      <Header />
      {phase === 'running' && <Spinner label={`Roles: ${options.action}...`} />}
      {phase === 'done' && options.action === 'list' && (
        <Card title={`Active roles for ${options.address?.slice(0, 8)}...`}>
          {roleInfos.length === 0 ? (
            <Text color="gray">No active roles found.</Text>
          ) : (
            roleInfos.map((r, i) => (
              <Box key={i}>
                <Text color="cyanBright">{r.role.padEnd(14)}</Text>
                <Text color="gray">{r.address}</Text>
              </Box>
            ))
          )}
        </Card>
      )}
      {phase === 'done' && options.action !== 'list' && (
        <Success label={`Role ${options.action}d`} value={sig} />
      )}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
