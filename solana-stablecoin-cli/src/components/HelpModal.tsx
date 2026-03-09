import React, { useEffect, useState } from 'react';
import { Box, Text, useStdout } from 'ink';
import { Theme } from '../utils/theme.js';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    width: stdout.columns || 80,
    height: stdout.rows || 24,
  });

  useEffect(() => {
    const onResize = () => {
      setDimensions({
        width: stdout.columns || 80,
        height: stdout.rows || 24,
      });
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  const bgLines = Array.from({ length: dimensions.height }).map((_, i) => (
    <Text key={i} backgroundColor="black">
      {' '.repeat(dimensions.width)}
    </Text>
  ));

  return (
    <Box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center">
      {/* Opaque background layer (absolute relative to this wrapper, doesn't affect centering of siblings) */}
      <Box position="absolute" flexDirection="column">
        {bgLines}
      </Box>

      {/* Centered Modal Content */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={Theme.primary as any}
        paddingX={3}
        paddingY={1}
      >
        <Box marginBottom={1} justifyContent="center">
          <Text color={Theme.primary as any} bold underline>
            SSS CLI HELP
          </Text>
        </Box>

        <Box flexDirection="column" gap={0}>
          <Box justifyContent="space-between">
            <Text color="white" bold>
              Global Keys
            </Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">? Toggle Help</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">q Quit Application</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">1 - 6 Switch Tabs</Text>
          </Box>

          <Box marginTop={1}>
            <Text color="white" bold>
              Navigation
            </Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">← / → Switch Tabs (when inactive)</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">↑ / ↓ Navigate List / Fields</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">Tab Next Field</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">Shift+Tab Previous Field</Text>
          </Box>

          <Box marginTop={1}>
            <Text color="white" bold>
              Forms
            </Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">Enter Submit / Next</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">Esc Cancel / Back</Text>
          </Box>
        </Box>

        <Box marginTop={1} justifyContent="center">
          <Text color={Theme.dim as any}>Press </Text>
          <Text color="cyanBright" bold>
            ?
          </Text>
          <Text color={Theme.dim as any}>, </Text>
          <Text color="cyanBright" bold>
            Esc
          </Text>
          <Text color={Theme.dim as any}> or </Text>
          <Text color="cyanBright" bold>
            q
          </Text>
          <Text color={Theme.dim as any}> to close.</Text>
        </Box>
      </Box>
    </Box>
  );
}
