import React from 'react';
import { Box, Text } from 'ink';
import InkTextInput from 'ink-text-input';
import { Theme } from '../utils/theme.js';

interface TextInputProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  isFocused?: boolean;
  mask?: string;
  width?: number;
}

export function TextInput({
  label,
  value,
  placeholder,
  onChange,
  onSubmit,
  isFocused = true,
  mask,
  width = 50,
}: TextInputProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={(isFocused ? Theme.primary : Theme.dim) as any} bold={isFocused}>
        {label}
      </Text>
      <Box
        borderStyle="single"
        borderColor={isFocused ? Theme.primary : Theme.dim}
        paddingX={1}
        width={width}
      >
        <InkTextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
          focus={isFocused}
          mask={mask}
        />
      </Box>
    </Box>
  );
}
