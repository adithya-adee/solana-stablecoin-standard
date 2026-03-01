import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Box, Text } from 'ink';
import { Theme, Icons } from '../utils/theme.js';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationContextProps {
  notifications: Notification[];
  notify: (type: NotificationType, message: string, durationMs?: number) => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((type: NotificationType, message: string, durationMs = 4000) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, durationMs);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, notify }}>
      <Box flexDirection="column" flexGrow={1}>
        {/* Render visible notifications at the absolute top of the app */}
        {notifications.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            {notifications.map((n) => {
              const color =
                n.type === 'success'
                  ? Theme.success
                  : n.type === 'error'
                    ? Theme.error
                    : Theme.info;
              const icon =
                n.type === 'success'
                  ? Icons.checkmark
                  : n.type === 'error'
                    ? Icons.cross
                    : Icons.info;
              return (
                <Box key={n.id} paddingX={2}>
                  <Text color="black" backgroundColor={color as any} bold>
                    {icon} {n.message}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}
        {children}
      </Box>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
