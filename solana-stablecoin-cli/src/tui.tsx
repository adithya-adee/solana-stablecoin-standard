import React, { useState, useEffect } from 'react';
import fs from 'fs';
import { Box, Text, useApp, useInput } from 'ink';
import { Layout } from './components/Layout.js';
import { TabName } from './components/TabBar.js';
import { NotificationProvider } from './hooks/useNotifications.js';

import { DashboardPanel } from './panels/DashboardPanel.js';
import { OperationsPanel } from './panels/OperationsPanel.js';
import { CompliancePanel } from './panels/CompliancePanel.js';
import { HoldersPanel } from './panels/HoldersPanel.js';
import { AuditLogPanel } from './panels/AuditLogPanel.js';
import { ConfigPanel } from './panels/ConfigPanel.js';

function TuiApp() {
  const [activeTab, setActiveTab] = useState<TabName>('Dashboard');
  const [isInputActive, setIsInputActive] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [mint, setMint] = useState<string | undefined>(undefined);
  const [refreshRateMs, setRefreshRateMs] = useState<number | undefined>(undefined);
  const [lastRefresh, setLastRefresh] = useState<Date | undefined>(undefined);
  const { exit } = useApp();

  useInput(
    (input, key) => {
      if (isHelpOpen) {
        if (input === '?' || key.escape || input === 'q') {
          setIsHelpOpen(false);
        }
        return; // Always capture input when help is open
      }

      if (input === 'q') {
        exit();
        return;
      }

      if (input === '?') {
        setIsHelpOpen(true);
        return;
      }
    },
    { isActive: !isInputActive },
  );

  // Enter alternate screen on mount, leave on unmount
  useEffect(() => {
    process.stdout.write('\x1b[?1049h');
    return () => {
      process.stdout.write('\x1b[?1049l');
    };
  }, []);

  // Load default mint from config on mount
  useEffect(() => {
    const configPath = process.env.SSS_CONFIG ?? '.sss-config.json';
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.mint) setMint(config.mint);
      } catch {}
    }
  }, []);

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      refreshRateMs={refreshRateMs}
      lastRefresh={lastRefresh}
      isInputActive={isInputActive}
      isHelpOpen={isHelpOpen}
      onHelpClose={() => setIsHelpOpen(false)}
    >
      {activeTab === 'Dashboard' && (
        <DashboardPanel
          mint={mint}
          setRefreshRate={setRefreshRateMs}
          setLastRefresh={setLastRefresh}
        />
      )}
      {activeTab === 'Operations' && (
        <OperationsPanel
          mint={mint}
          onInputStart={() => setIsInputActive(true)}
          onInputEnd={() => setIsInputActive(false)}
          isPaused={isHelpOpen}
        />
      )}
      {activeTab === 'Compliance' && (
        <CompliancePanel
          mint={mint}
          onInputStart={() => setIsInputActive(true)}
          onInputEnd={() => setIsInputActive(false)}
          isPaused={isHelpOpen}
        />
      )}
      {activeTab === 'Holders' && <HoldersPanel mint={mint} setRefreshRate={setRefreshRateMs} />}
      {activeTab === 'Audit Log' && <AuditLogPanel mint={mint} setRefreshRate={setRefreshRateMs} />}
      {activeTab === 'Config' && (
        <ConfigPanel
          currentMint={mint}
          onMintChange={setMint}
          onInputStart={() => setIsInputActive(true)}
          onInputEnd={() => setIsInputActive(false)}
        />
      )}
    </Layout>
  );
}

export default function Tui() {
  return (
    <NotificationProvider>
      <TuiApp />
    </NotificationProvider>
  );
}
