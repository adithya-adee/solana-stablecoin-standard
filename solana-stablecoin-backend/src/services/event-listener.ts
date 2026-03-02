import { Connection, PublicKey, Logs } from '@solana/web3.js';
import { appLogger } from './logger';
import { dispatchWebhookNotification } from './webhook';

export interface ChainEvent {
  program: 'sss-core' | 'sss-transfer-hook';
  type: string;
  signature: string;
  data: Record<string, string>;
  timestamp: number;
}

// Known event prefixes emitted by the programs
const LEDGER_EVENT_TAGS = [
  'Initialized',
  'TokensMinted',
  'TokensBurned',
  'AccountFrozen',
  'AccountThawed',
  'Paused',
  'Unpaused',
  'Seized',
  'RoleGranted',
  'RoleRevoked',
  'SupplyCapUpdated',
];

const HOOK_EVENT_TAGS = ['BlacklistAdded', 'BlacklistRemoved', 'TransferChecked'];

/**
 * WebSocket event listener for on-chain SSS program events.
 * Subscribes to program log events and parses known event types.
 */
export class ProgramEventMonitor {
  private connection: Connection;
  private coreProgramId: PublicKey;
  private hookProgramId: PublicKey;
  private ledgerSubId: number | null = null;
  private guardSubId: number | null = null;

  constructor(connection: Connection, coreProgramId: PublicKey, hookProgramId: PublicKey) {
    this.connection = connection;
    this.coreProgramId = coreProgramId;
    this.hookProgramId = hookProgramId;
  }

  /**
   * Start listening for program log events via WebSocket.
   */
  activate(): void {
    this.ledgerSubId = this.connection.onLogs(
      this.coreProgramId,
      (logs) => this.processLogEntry(logs, 'sss-core', LEDGER_EVENT_TAGS),
      'confirmed',
    );

    this.guardSubId = this.connection.onLogs(
      this.hookProgramId,
      (logs) => this.processLogEntry(logs, 'sss-transfer-hook', HOOK_EVENT_TAGS),
      'confirmed',
    );

    appLogger.info('Event listener subscriptions active', {
      core: this.coreProgramId.toBase58(),
      hook: this.hookProgramId.toBase58(),
    });
  }

  /**
   * Stop listening for events and remove WebSocket subscriptions.
   */
  async deactivate(): Promise<void> {
    if (this.ledgerSubId !== null) {
      await this.connection.removeOnLogsListener(this.ledgerSubId);
      this.ledgerSubId = null;
    }
    if (this.guardSubId !== null) {
      await this.connection.removeOnLogsListener(this.guardSubId);
      this.guardSubId = null;
    }
    appLogger.info('Event listener subscriptions removed');
  }

  /**
   * Parse program logs for known event patterns.
   */
  private processLogEntry(
    logs: Logs,
    source: 'sss-core' | 'sss-transfer-hook',
    tags: string[],
  ): void {
    if (logs.err) {
      appLogger.debug('Transaction with error, skipping event parse', {
        signature: logs.signature,
        error: JSON.stringify(logs.err),
      });
      return;
    }

    for (const log of logs.logs) {
      // Anchor events are emitted as "Program data: <base64>"
      // Program log messages use "Program log: <message>"
      if (!log.startsWith('Program log:') && !log.startsWith('Program data:')) {
        continue;
      }

      const message = log.replace(/^Program (log|data): /, '');

      for (const tag of tags) {
        if (message.includes(tag)) {
          const event: ChainEvent = {
            program: source,
            type: tag,
            signature: logs.signature,
            data: this.parseEventPayload(message),
            timestamp: Date.now(),
          };

          appLogger.info('On-chain event detected', {
            program: event.program,
            type: event.type,
            signature: event.signature,
          });

          // Fire-and-forget webhook notification
          dispatchWebhookNotification(event).catch((err) => {
            appLogger.warn('Webhook dispatch failed', {
              error: err instanceof Error ? err.message : String(err),
            });
          });

          break;
        }
      }
    }
  }

  /**
   * Best-effort extraction of key-value pairs from event log messages.
   * Anchor events are base64-encoded, but program log messages may contain
   * human-readable data. This handles both gracefully.
   */
  private parseEventPayload(message: string): Record<string, string> {
    const data: Record<string, string> = {};

    // Try to parse as key=value pairs (common in program log messages)
    const kvPairs = message.match(/(\w+)=([^\s,]+)/g);
    if (kvPairs) {
      for (const pair of kvPairs) {
        const eqIndex = pair.indexOf('=');
        if (eqIndex > 0) {
          data[pair.substring(0, eqIndex)] = pair.substring(eqIndex + 1);
        }
      }
    }

    // If no key-value pairs found, store the raw message
    if (Object.keys(data).length === 0) {
      data.raw = message;
    }

    return data;
  }
}
