import React from 'react';
import { Box } from 'ink';
import { Header } from './ui.js';
import { TabBar, TabName } from './TabBar.js';
import { StatusBar } from './StatusBar.js';

interface LayoutProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  refreshRateMs?: number;
  lastRefresh?: Date;
  isInputActive?: boolean;
  children: React.ReactNode;
}

export function Layout({
  activeTab,
  onTabChange,
  refreshRateMs,
  lastRefresh,
  isInputActive,
  children,
}: LayoutProps) {
  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1} width="100%" height="100%">
      <Header />

      <TabBar activeTab={activeTab} onTabChange={onTabChange} isInputActive={isInputActive} />

      <Box flexGrow={1} flexDirection="column" marginTop={1}>
        {children}
      </Box>

      <StatusBar refreshRateMs={refreshRateMs} lastRefresh={lastRefresh} />
    </Box>
  );
}
