import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Theme, Icons } from '../utils/theme.js';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  useInput((input, key) => {
    if (input.toLowerCase() === 'y' || key.return) {
      onConfirm();
    } else if (input.toLowerCase() === 'n' || key.escape) {
      onCancel();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={Theme.warning}
      paddingX={2}
      paddingY={1}
      width={60}
      alignItems="center"
    >
      <Box marginBottom={1}>
        <Text color={Theme.warning as any} bold>
          {Icons.warning} {title}
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={Theme.text as any}>{message}</Text>
      </Box>
      <Box flexDirection="row" gap={4}>
        <Text color={Theme.success as any}>[Y] Yes</Text>
        <Text color={Theme.dim as any}>[N] Cancel</Text>
      </Box>
    </Box>
  );
}
