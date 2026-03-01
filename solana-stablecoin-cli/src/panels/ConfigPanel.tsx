import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Theme } from '../utils/theme.js';
import { Err, Spinner, Card } from '../components/ui.js';
import { TextInput } from '../components/TextInput.js';
import { useNotifications } from '../hooks/useNotifications.js';
import fs from 'fs';

interface ConfigPanelProps {
  currentMint: string | undefined;
  onMintChange: (mint: string) => void;
}

export function ConfigPanel({ currentMint, onMintChange }: ConfigPanelProps) {
  const { notify } = useNotifications();
  
  const [activeForm, setActiveForm] = useState<'edit' | null>(null);
  const [newMint, setNewMint] = useState('');

  const configPath = process.env.SSS_CONFIG ?? '.sss-config.json';
  let config: any = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {}
  }

  useInput(
    (input, key) => {
      if (!activeForm && key.return) {
        setActiveForm('edit');
        setNewMint(currentMint ?? '');
      } else if (activeForm && key.escape) {
        setActiveForm(null);
      }
    }
  );

  const saveConfig = () => {
    try {
      const updatedConfig = { ...config, mint: newMint };
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      onMintChange(newMint);
      notify('success', 'Config updated successfully.');
      setActiveForm(null);
    } catch (e: any) {
      notify('error', `Failed to save config: ${e.message}`);
    }
  };

  return (
    <Box flexDirection="row" gap={4}>
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} width={40}>
        <Box marginBottom={1}>
          <Text color={Theme.primary as any} bold>Configuration</Text>
        </Box>
        <Card title="Current Settings">
          <Box flexDirection="column" gap={0}>
            <Box>
              <Text color="gray">Config File: </Text>
              <Text color="white">{configPath}</Text>
            </Box>
            <Box>
              <Text color="gray">Active Mint: </Text>
              <Text color="white">{currentMint ?? 'Not set'}</Text>
            </Box>
            <Box>
              <Text color="gray">RPC Endpt:   </Text>
              <Text color="white">{process.env.RPC_URL ?? 'https://api.devnet.solana.com'}</Text>
            </Box>
          </Box>
        </Card>

        {!activeForm && (
            <Box marginTop={1}>
                <Text color="cyanBright">► Set Active Mint</Text>
            </Box>
        )}
        {!activeForm && (
            <Box marginTop={1}>
                <Text color="gray">Press [Enter] to set active mint.</Text>
            </Box>
        )}
      </Box>

      {activeForm === 'edit' && (
        <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="cyanBright" paddingX={2}>
          <Box marginBottom={1}>
            <Text color="cyanBright" bold>Update Active Mint</Text>
          </Box>
          <TextInput label="Stablecoin Mint Address" value={newMint} onChange={setNewMint} onSubmit={saveConfig} />
          <Box marginTop={1}>
              <Text color="gray">Press [Enter] to save, or [Esc] to cancel.</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
