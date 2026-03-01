import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Theme } from '../utils/theme.js';

export const TABS = [
  'Dashboard',
  'Operations',
  'Compliance',
  'Holders',
  'Audit Log',
  'Config',
] as const;

export type TabName = (typeof TABS)[number];

interface TabBarProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  useInput((input, key) => {
    if (key.leftArrow) {
      const idx = TABS.indexOf(activeTab);
      onTabChange(TABS[(idx - 1 + TABS.length) % TABS.length]!);
    } else if (key.rightArrow) {
      const idx = TABS.indexOf(activeTab);
      onTabChange(TABS[(idx + 1) % TABS.length]!);
    } else if (input >= '1' && input <= String(TABS.length)) {
      onTabChange(TABS[Number(input) - 1]!);
    }
  });

  return (
    <Box flexDirection="row" marginBottom={1}>
      {TABS.map((tab, idx) => {
        const isActive = tab === activeTab;
        return (
          <Box key={tab} marginRight={2}>
            <Text color={Theme.dim as any}>[</Text>
            <Text color={Theme.text as any}>{idx + 1}</Text>
            <Text color={Theme.dim as any}>] </Text>
            <Text
              color={(isActive ? Theme.primary : Theme.dim) as any}
              bold={isActive}
              underline={isActive}
            >
              {tab}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
