import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import fs from 'fs';
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
  const [mint, setMint] = useState<string | undefined>(undefined);
  const [refreshRateMs, setRefreshRateMs] = useState<number | undefined>(undefined);
  const [lastRefresh, setLastRefresh] = useState<Date | undefined>(undefined);
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q') {
      exit();
    }
  });

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
    >
      {activeTab === 'Dashboard' && (
        <DashboardPanel
          mint={mint}
          setRefreshRate={setRefreshRateMs}
          setLastRefresh={setLastRefresh}
        />
      )}
      {activeTab === 'Operations' && <OperationsPanel mint={mint} />}
      {activeTab === 'Compliance' && <CompliancePanel mint={mint} />}
      {activeTab === 'Holders' && <HoldersPanel mint={mint} setRefreshRate={setRefreshRateMs} />}
      {activeTab === 'Audit Log' && <AuditLogPanel mint={mint} setRefreshRate={setRefreshRateMs} />}
      {activeTab === 'Config' && <ConfigPanel currentMint={mint} onMintChange={setMint} />}
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
