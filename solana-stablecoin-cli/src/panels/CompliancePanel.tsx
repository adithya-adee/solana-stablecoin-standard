import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Theme } from '../utils/theme.js';
import { Err, Spinner } from '../components/ui.js';
import { TextInput } from '../components/TextInput.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { useSss } from '../hooks/useSss.js';
import { useNotifications } from '../hooks/useNotifications.js';
import { PublicKey } from '@solana/web3.js';
import { roleType } from '@stbr/sss-token';
import SelectInput from 'ink-select-input';

interface CompliancePanelProps {
  mint: string | undefined;
  onInputStart: () => void;
  onInputEnd: () => void;
}

type CompType = 'bl-add' | 'bl-rem' | 'bl-chk' | 'rl-grant' | 'rl-revoke' | 'rl-chk';

const OPS: { id: CompType; label: string; destructive?: boolean; group: string }[] = [
  { group: 'Blacklist', id: 'bl-add', label: 'Add to Blacklist', destructive: true },
  { group: 'Blacklist', id: 'bl-rem', label: 'Remove from Blacklist', destructive: true },
  { group: 'Blacklist', id: 'bl-chk', label: 'Check Blacklist Status' },
  { group: 'Roles', id: 'rl-grant', label: 'Grant Role' },
  { group: 'Roles', id: 'rl-revoke', label: 'Revoke Role', destructive: true },
  { group: 'Roles', id: 'rl-chk', label: 'Check Roles for Address' },
];

export function CompliancePanel({ mint, onInputStart, onInputEnd }: CompliancePanelProps) {
  const { notify } = useNotifications();
  const { sss, provider, loading: sssLoading, error: sssError } = useSss(mint);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeForm, setActiveForm] = useState<CompType | null>(null);
  const [focusedField, setFocusedField] = useState(0);

  // Form State
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');
  const [roleInput, setRoleInput] = useState('');

  // Process State
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'executing' | 'done'>('idle');
  const [error, setError] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [roleInfos, setRoleInfos] = useState<{ role: string; has: boolean }[]>([]);

  const getFieldCount = (op: CompType | null): number => {
    switch (op) {
      case 'bl-add':
      case 'rl-grant':
      case 'rl-revoke':
        return 2;
      case 'bl-rem':
      case 'bl-chk':
      case 'rl-chk':
        return 1;
      default:
        return 0;
    }
  };

  useInput(
    (input, key) => {
      if (activeForm) {
        if (key.escape) {
          setActiveForm(null);
          setFocusedField(0);
          onInputEnd();
          return;
        }

        const fieldCount = getFieldCount(activeForm);
        if (fieldCount > 1) {
          const isDropdownActive =
            (activeForm === 'rl-grant' || activeForm === 'rl-revoke') && focusedField === 1;

          if (key.tab || (key.downArrow && !isDropdownActive)) {
            setFocusedField((f) => (f + 1) % fieldCount);
            return;
          }
          if (
            (key.upArrow && !isDropdownActive) ||
            (input === '\t' && key.shift)
          ) {
            setFocusedField((f) => (f - 1 + fieldCount) % fieldCount);
            return;
          }
        }
        return;
      }

      if (key.upArrow) {
        setSelectedIdx((i) => (i > 0 ? i - 1 : OPS.length - 1));
      } else if (key.downArrow) {
        setSelectedIdx((i) => (i < OPS.length - 1 ? i + 1 : 0));
      } else if (key.return) {
        setActiveForm(OPS[selectedIdx]!.id);
        onInputStart();
        setFocusedField(0);
        setError('');
        setResultMsg('');
        setPhase('idle');
        setAddress('');
        setReason('');
        setRoleInput('');
        setRoleInfos([]);
      }
    },
    { isActive: phase === 'idle' || phase === 'done' },
  );

  const executeOp = async () => {
    if (!sss || !provider) return;
    setPhase('executing');
    setError('');

    try {
      const op = activeForm;
      const addr = new PublicKey(address);
      let txSig = '';

      if (op === 'bl-add') {
        txSig = await sss.blacklist.add(addr, reason);
      } else if (op === 'bl-rem') {
        txSig = await sss.blacklist.remove(addr);
      } else if (op === 'bl-chk') {
        const isBl = await sss.blacklist.check(addr);
        setResultMsg(isBl ? 'YES — blacklisted' : 'NO — not blacklisted');
        setPhase('done');
        return;
      } else if (op === 'rl-grant') {
        const hasRole = await sss.roles.check(addr, roleType(roleInput as any));
        if (hasRole) {
          setError(`Address already has the '${roleInput}' role.`);
          setPhase('idle');
          return;
        }
        txSig = await sss.roles.grant(addr, roleType(roleInput as any));
      } else if (op === 'rl-revoke') {
        const hasRole = await sss.roles.check(addr, roleType(roleInput as any));
        if (!hasRole) {
          setError(`Address does not have the '${roleInput}' role.`);
          setPhase('idle');
          return;
        }
        txSig = await sss.roles.revoke(addr, roleType(roleInput as any));
      } else if (op === 'rl-chk') {
        const ALL_ROLES = [
          'admin',
          'minter',
          'freezer',
          'pauser',
          'burner',
          'blacklister',
          'seizer',
        ] as const;
        const results: { role: string; has: boolean }[] = [];
        for (const r of ALL_ROLES) {
          const has = await sss.roles.check(addr, roleType(r));
          results.push({ role: r, has });
        }
        setRoleInfos(results);
        setPhase('done');
        const activeCount = results.filter((r) => r.has).length;
        notify('info', `Check complete: Found ${activeCount} active roles.`);
        return;
      }

      const latestBlockHash = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: txSig,
      });

      notify('success', `Operation ${activeForm} successful!`);
      setActiveForm(null);
      onInputEnd();
    } catch (e: any) {
      setError(e.message ?? String(e));
      notify('error', `Operation failed: ${e.message}`);
    } finally {
      setPhase((curr) => (curr === 'executing' ? 'idle' : curr));
    }
  };

  const attemptOp = () => {
    const opDef = OPS.find((o) => o.id === activeForm);
    if (opDef?.destructive) {
      setPhase('confirming');
    } else {
      void executeOp();
    }
  };

  if (!mint) return <Err message="No mint configured." />;
  if (sssLoading) return <Spinner label="Loading SDK..." />;
  if (sssError) return <Err message={sssError} />;

  return (
    <Box flexDirection="row" gap={4}>
      {/* Menu List */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} width={35}>
        <Box marginBottom={1}>
          <Text color={Theme.primary as any} bold>
            Compliance Ops
          </Text>
        </Box>
        {OPS.map((op, idx) => {
          const isSelected = idx === selectedIdx && !activeForm;
          const isActive = op.id === activeForm;
          const showGroup = idx === 0 || OPS[idx - 1]!.group !== op.group;
          return (
            <React.Fragment key={op.id}>
              {showGroup && (
                <Box marginTop={idx > 0 ? 1 : 0}>
                  <Text color="gray" dimColor>
                    --- {op.group.toUpperCase()} ---
                  </Text>
                </Box>
              )}
              <Box>
                <Text color={isSelected ? 'cyanBright' : isActive ? 'greenBright' : 'gray'}>
                  {isSelected ? '► ' : '  '}
                </Text>
                <Text color={(isSelected || isActive ? Theme.text : Theme.dim) as any}>
                  {op.label}
                </Text>
              </Box>
            </React.Fragment>
          );
        })}
      </Box>

      {/* Active Form Area */}
      {activeForm && (
        <Box
          flexDirection="column"
          flexGrow={1}
          borderStyle="single"
          borderColor="cyanBright"
          paddingX={2}
        >
          <Box marginBottom={1}>
            <Text color="cyanBright" bold>
              Execute: {OPS.find((o) => o.id === activeForm)?.label}
            </Text>
          </Box>


          <TextInput
            label="Target Address"
            value={address}
            onChange={(val) => {
              setAddress(val);
              setRoleInfos([]); // Reset results when address changes
              setResultMsg('');
              setError('');
            }}
            isFocused={focusedField === 0}
            onSubmit={() => {
              const count = getFieldCount(activeForm);
              if (count > 1) setFocusedField(1);
              else attemptOp();
            }}
          />

          {roleInfos.length > 0 && activeForm === 'rl-chk' && (
            <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="cyanBright" paddingX={1}>
              <Box marginBottom={1}>
                <Text bold color="cyanBright">Roles for: </Text>
                <Text color="white" dimColor>{address}</Text>
              </Box>
              <Box flexDirection="column">
                {Array.from({ length: Math.ceil(roleInfos.length / 2) }).map((_, rowIndex) => (
                  <Box key={rowIndex} flexDirection="row" gap={2}>
                    {[0, 1].map((colIndex) => {
                      const r = roleInfos[rowIndex * 2 + colIndex];
                      if (!r) return null;
                      return (
                        <Box key={r.role} width={22}>
                          <Text color={r.has ? 'greenBright' : 'gray'}>
                            {r.has ? '●' : '○'}
                          </Text>
                          <Text color={r.has ? 'white' : 'gray'} dimColor={!r.has}>
                            {' '}{r.role.padEnd(12)}
                          </Text>
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {activeForm === 'bl-add' && (
            <TextInput
              label="Match Reason (Optional)"
              value={reason}
              onChange={setReason}
              onSubmit={attemptOp}
              isFocused={focusedField === 1}
            />
          )}

          {(activeForm === 'rl-grant' || activeForm === 'rl-revoke') && (
            <Box flexDirection="column" marginTop={1}>
              <Text color={(focusedField === 1 ? Theme.primary : Theme.dim) as any} bold={focusedField === 1}>
                Select Role:
              </Text>
              <Box borderStyle="round" borderColor={focusedField === 1 ? Theme.primary : 'gray'} paddingX={1}>
                {focusedField === 1 ? (
                  <SelectInput
                    items={[
                      { label: 'Admin', value: 'admin' },
                      { label: 'Minter', value: 'minter' },
                      { label: 'Freezer', value: 'freezer' },
                      { label: 'Pauser', value: 'pauser' },
                      { label: 'Burner', value: 'burner' },
                      { label: 'Blacklister', value: 'blacklister' },
                      { label: 'Seizer', value: 'seizer' },
                    ]}
                    onSelect={(item) => {
                      setRoleInput(item.value);
                      attemptOp();
                    }}
                  />
                ) : (
                  <Text color="gray">{roleInput || 'None selected (Press Tab to select)'}</Text>
                )}
              </Box>
            </Box>
          )}

          {error && <Err message={error} />}

          {phase === 'executing' && <Spinner label="Executing transaction..." />}

          {phase === 'confirming' && (
            <Box marginTop={1}>
              <ConfirmDialog
                title="Confirm Operation"
                message={`Are you sure you want to execute ${activeForm}?`}
                onConfirm={executeOp}
                onCancel={() => {
                  setPhase('idle');
                  setActiveForm(null);
                  onInputEnd();
                }}
              />
            </Box>
          )}

          {phase === 'done' && resultMsg && (
            <Box marginTop={1} padding={1} borderStyle="round">
              <Text color="greenBright">{resultMsg}</Text>
            </Box>
          )}

          {(phase === 'idle' || phase === 'done') && (
            <Box marginTop={1} flexDirection="column">
              {getFieldCount(activeForm) > 1 && (
                <Box>
                  <Text color="gray">
                    Use [↑/↓] or [Tab] to navigate between fields.
                  </Text>
                </Box>
              )}
              <Box>
                <Text color="gray">
                  Press [Enter] on the last field to navigate or execute, or [Esc] to cancel.
                </Text>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
