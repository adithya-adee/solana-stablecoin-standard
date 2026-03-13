import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Theme } from '../utils/theme.js';
import { Err, Spinner } from '../components/ui.js';
import { TextInput } from '../components/TextInput.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { useSss } from '../hooks/useSss.js';
import { useNotifications } from '../hooks/useNotifications.js';
import { PublicKey } from '@solana/web3.js';
import { parseAmount } from '../utils/config.js';
import { formatSssError } from '../utils/errors.js';
import Link from 'ink-link';
import { formatExplorerUrl } from '../utils/config.js';

interface OperationsPanelProps {
  mint: string | undefined;
  onInputStart: () => void;
  onInputEnd: () => void;
  isPaused?: boolean;
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

export function OperationsPanel({
  mint,
  onInputStart,
  onInputEnd,
  isPaused = false,
}: OperationsPanelProps) {
  const { notify } = useNotifications();
  const { sss, provider, loading: sssLoading, error: sssError } = useSss(mint);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeForm, setActiveForm] = useState<OpType | null>(null);
  const [focusedField, setFocusedField] = useState(0);

  // Form State
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');

  // Process State
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'executing' | 'done'>('idle');
  const [error, setError] = useState('');
  const [txSignature, setTxSignature] = useState('');

  const getFieldCount = (op: OpType | null): number => {
    switch (op) {
      case 'mint':
        return 2;
      case 'seize':
        return 3;
      case 'burn':
      case 'freeze':
      case 'thaw':
      case 'pause':
      case 'unpause':
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
          if (key.tab || key.downArrow) {
            setFocusedField((f) => (f + 1) % fieldCount);
            return;
          }
          if (key.upArrow || (input === '\t' && key.shift)) {
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
        setPhase('idle');
        // Reset fields
        setRecipient('');
        setAmount('');
        setAddress('');
        setFromAddress('');
        setToAddress('');
      }
    },
    { isActive: !isPaused && phase === 'idle' },
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
        txSig = await sss.mintTokens(recip, amt);
      } else if (op === 'burn') {
        const amt = parseAmount(amount);
        txSig = await sss.burn(provider.publicKey, amt);
      } else if (op === 'freeze') {
        const addr = new PublicKey(address);
        txSig = await sss.freeze(addr);
      } else if (op === 'thaw') {
        const addr = new PublicKey(address);
        txSig = await sss.thaw(addr);
      } else if (op === 'pause') {
        txSig = await sss.pause();
      } else if (op === 'unpause') {
        txSig = await sss.unpause();
      } else if (op === 'seize') {
        const from = new PublicKey(fromAddress);
        const to = new PublicKey(toAddress);
        const amt = parseAmount(amount);
        txSig = await sss.seize(from, to, amt);
      }

      const latestBlockHash = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: txSig,
      });

      setTxSignature(txSig);
      setPhase('done');
      notify('success', `Operation ${activeForm} successful!`);
    } catch (e: any) {
      const formatted = formatSssError(e);
      setError(formatted);
      notify('error', `Operation failed: ${formatted}`);
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
              <TextInput
                label="Recipient Address"
                value={recipient}
                onChange={setRecipient}
                isFocused={focusedField === 0}
                onSubmit={() => setFocusedField(1)}
              />
              <TextInput
                label="Amount"
                value={amount}
                onChange={setAmount}
                onSubmit={attemptOp}
                isFocused={focusedField === 1}
              />
            </>
          )}

          {activeForm === 'burn' && (
            <TextInput
              label="Amount"
              value={amount}
              onChange={setAmount}
              onSubmit={attemptOp}
              isFocused={focusedField === 0}
            />
          )}

          {(activeForm === 'freeze' || activeForm === 'thaw') && (
            <TextInput
              label="Target Address"
              value={address}
              onChange={setAddress}
              onSubmit={attemptOp}
              isFocused={focusedField === 0}
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
                isFocused={focusedField === 0}
              />
            </Box>
          )}

          {activeForm === 'seize' && (
            <>
              <TextInput
                label="From Address"
                value={fromAddress}
                onChange={setFromAddress}
                isFocused={focusedField === 0}
                onSubmit={() => setFocusedField(1)}
              />
              <TextInput
                label="To (Treasury) Address"
                value={toAddress}
                onChange={setToAddress}
                isFocused={focusedField === 1}
                onSubmit={() => setFocusedField(2)}
              />
              <TextInput
                label="Amount"
                value={amount}
                onChange={setAmount}
                onSubmit={attemptOp}
                isFocused={focusedField === 2}
              />
            </>
          )}

          {phase === 'done' && txSignature && (
            <Box
              marginTop={1}
              padding={1}
              flexDirection="column"
              borderStyle="round"
              borderColor="greenBright"
            >
              <Text color="greenBright">Operation Successful!</Text>
              <Box>
                <Text color="gray">Tx: </Text>
                {/* @ts-ignore ink-link types */}
                <Link url={formatExplorerUrl(txSignature)}>
                  <Text color="white" underline>
                    {txSignature}
                  </Text>
                </Link>
              </Box>
              <Box marginTop={1}>
                <Text color="gray" dimColor>
                  (Ctrl+Click to open in Solscan)
                </Text>
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

          {phase === 'idle' && (
            <Box marginTop={1} flexDirection="column">
              {getFieldCount(activeForm) > 1 && (
                <Box>
                  <Text color="gray">Use [↑/↓] or [Tab] to navigate between fields.</Text>
                </Box>
              )}
              <Box>
                <Text color="gray">
                  Press [Enter] on the last field to execute, or [Esc] to cancel.
                </Text>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
