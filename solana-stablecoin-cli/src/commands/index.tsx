import React from 'react';
import { Text, Box } from 'ink';

export default function Index() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="blue" bold>
        Solana Stablecoin Standard CLI
      </Text>
      <Text>
        Use <Text color="green">sss --help</Text> to see available commands.
      </Text>
    </Box>
  );
}
