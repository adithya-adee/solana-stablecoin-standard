import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Theme } from '../utils/theme.js';
import { Err, Spinner } from '../components/ui.js';
import { TextInput } from '../components/TextInput.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { useSss } from '../hooks/useSss.js';
import { useNotifications } from '../hooks/useNotifications.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { parseAmount } from '../utils/config.js';

interface OperationsPanelProps {
  mint: string | undefined;
}

type OpType = 'mint' | 'burn' | 'freeze' | 'thaw' | 'pause' | 'unpause' | 'seize';

const OPS: { id: OpType; label: string; destructive?: boolean }[] = [
  { id: 'mint', label: 'Mint Tokens' },
  { id: 'burn', label: 'Burn Tokens (from Signer)', destructive: true },
  { id: 'freeze', label: 'Freeze Address' },
  { id: 'thaw', label: 'Thaw Address' },
  { id: 'pause', label: 'Pause Transfers' },
  { id: 'unpause', label: 'Unpause Transfers' },
  { id: 'seize', label: 'Seize Tokens', destructive: true },
];

export function OperationsPanel({ mint }: OperationsPanelProps) {
  const { notify } = useNotifications();
  const { sss, provider, loading: sssLoading, error: sssError } = useSss(mint);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeForm, setActiveForm] = useState<OpType | null>(null);

  // Form State
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');

  // Process State
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'executing'>('idle');
  const [error, setError] = useState('');

  useInput(
    (input, key) => {
      if (activeForm) {
        if (key.escape) setActiveForm(null);
        return; // Let TextInput handle the rest, or we handle Esc to cancel
      }

      if (key.upArrow) {
        setSelectedIdx((i) => (i > 0 ? i - 1 : OPS.length - 1));
      } else if (key.downArrow) {
        setSelectedIdx((i) => (i < OPS.length - 1 ? i + 1 : 0));
      } else if (key.return) {
        setActiveForm(OPS[selectedIdx]!.id);
        setError('');
        setPhase('idle');
        // Reset fields
        setRecipient('');
        setAmount('');
        setAddress('');
        setFromAddress('');
        setToAddress('');
      }
    },
    { isActive: phase === 'idle' },
  );

  const executeOp = async () => {
    if (!sss || !provider) return;
    setPhase('executing');
    setError('');

    try {
      let txSig = '';
      const op = activeForm;

      if (op === 'mint') {
        const recip = new PublicKey(recipient);
        const amt = parseAmount(amount);
        const ata = getAssociatedTokenAddressSync(
          sss.mintAddress,
          recip,
          false,
          TOKEN_2022_PROGRAM_ID,
        );
        txSig = await sss.mintTokens(ata, amt);
      } else if (op === 'burn') {
        const amt = parseAmount(amount);
        const ata = getAssociatedTokenAddressSync(
          sss.mintAddress,
          provider.publicKey,
          false,
          TOKEN_2022_PROGRAM_ID,
        );
        txSig = await sss.burn(ata, amt);
      } else if (op === 'freeze') {
        const addr = new PublicKey(address);
        const ata = getAssociatedTokenAddressSync(
          sss.mintAddress,
          addr,
          false,
          TOKEN_2022_PROGRAM_ID,
        );
        txSig = await sss.freeze(ata);
      } else if (op === 'thaw') {
        const addr = new PublicKey(address);
        const ata = getAssociatedTokenAddressSync(
          sss.mintAddress,
          addr,
          false,
          TOKEN_2022_PROGRAM_ID,
        );
        txSig = await sss.thaw(ata);
      } else if (op === 'pause') {
        txSig = await sss.pause();
      } else if (op === 'unpause') {
        txSig = await sss.unpause();
      } else if (op === 'seize') {
        const from = new PublicKey(fromAddress);
        const to = new PublicKey(toAddress);
        const amt = parseAmount(amount);
        const fromAta = getAssociatedTokenAddressSync(
          sss.mintAddress,
          from,
          false,
          TOKEN_2022_PROGRAM_ID,
        );
        const toAta = getAssociatedTokenAddressSync(
          sss.mintAddress,
          to,
          false,
          TOKEN_2022_PROGRAM_ID,
        );
        txSig = await sss.seize(fromAta, toAta, amt);
      }

      const latestBlockHash = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: txSig,
      });

      notify('success', `Operation ${activeForm} successful!`);
      setActiveForm(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
      notify('error', `Operation failed: ${e.message}`);
    } finally {
      setPhase('idle');
    }
  };

  const attemptOp = () => {
    const opDef = OPS.find((o) => o.id === activeForm);
    if (opDef?.destructive || activeForm === 'pause') {
      setPhase('confirming');
    } else {
      void executeOp();
    }
  };

  if (!mint) return <Err message="No mint configured. Go to Config tab to init or set one." />;
  if (sssLoading) return <Spinner label="Loading SDK..." />;
  if (sssError) return <Err message={sssError} />;

  return (
    <Box flexDirection="row" gap={4}>
      {/* Menu List */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} width={30}>
        <Box marginBottom={1}>
          <Text color={Theme.primary as any} bold>
            Operations
          </Text>
        </Box>
        {OPS.map((op, idx) => {
          const isSelected = idx === selectedIdx && !activeForm;
          const isActive = op.id === activeForm;
          return (
            <Box key={op.id}>
              <Text color={isSelected ? 'cyanBright' : isActive ? 'greenBright' : 'gray'}>
                {isSelected ? '► ' : '  '}
              </Text>
              <Text color={(isSelected || isActive ? Theme.text : Theme.dim) as any}>
                {op.label}
              </Text>
            </Box>
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

          {/* Render inputs based on active form */}
          {activeForm === 'mint' && (
            <>
              <TextInput label="Recipient Address" value={recipient} onChange={setRecipient} />
              <TextInput label="Amount" value={amount} onChange={setAmount} onSubmit={attemptOp} />
            </>
          )}

          {activeForm === 'burn' && (
            <TextInput label="Amount" value={amount} onChange={setAmount} onSubmit={attemptOp} />
          )}

          {(activeForm === 'freeze' || activeForm === 'thaw') && (
            <TextInput
              label="Target Address"
              value={address}
              onChange={setAddress}
              onSubmit={attemptOp}
            />
          )}

          {(activeForm === 'pause' || activeForm === 'unpause') && (
            <Box flexDirection="column" marginBottom={1}>
              <Text>Press Enter to confirm and execute.</Text>
              <TextInput
                label="Type 'yes' to proceed (optional safety)"
                value={address}
                onChange={setAddress}
                onSubmit={attemptOp}
              />
            </Box>
          )}

          {activeForm === 'seize' && (
            <>
              <TextInput label="From Address" value={fromAddress} onChange={setFromAddress} />
              <TextInput label="To (Treasury) Address" value={toAddress} onChange={setToAddress} />
              <TextInput label="Amount" value={amount} onChange={setAmount} onSubmit={attemptOp} />
            </>
          )}

          {error && <Err message={error} />}

          {phase === 'executing' && <Spinner label="Executing transaction..." />}

          {phase === 'confirming' && (
            <Box marginTop={1}>
              <ConfirmDialog
                title="Confirm Operation"
                message={`Are you sure you want to execute ${activeForm}?`}
                onConfirm={executeOp}
                onCancel={() => setPhase('idle')}
              />
            </Box>
          )}

          {phase === 'idle' && (
            <Box marginTop={1}>
              <Text color="gray">
                Press [Enter] on the last field to execute, or [Esc] to cancel.
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
