import { appLogger } from './logger';

export interface ScreeningResult {
  approved: boolean;
  reason?: string;
  provider: string;
  checkedAt: Date;
}

export interface RegulatoryGateway {
  screenAddress(address: string): Promise<ScreeningResult>;
  screenTransaction(params: {
    from?: string;
    to: string;
    amount: string;
    action: 'mint' | 'burn' | 'transfer';
  }): Promise<ScreeningResult>;
}

/**
 * Default no-op provider. Replace with Chainalysis, Elliptic, or TRM Labs
 * integration for production use.
 */
class DefaultRegulatoryGateway implements RegulatoryGateway {
  async screenAddress(address: string): Promise<ScreeningResult> {
    appLogger.info('Compliance screening (no-op)', { address });
    return {
      approved: true,
      provider: 'default',
      checkedAt: new Date(),
    };
  }

  async screenTransaction(params: {
    from?: string;
    to: string;
    amount: string;
    action: 'mint' | 'burn' | 'transfer';
  }): Promise<ScreeningResult> {
    appLogger.info('Transaction screening (no-op)', params);
    return {
      approved: true,
      provider: 'default',
      checkedAt: new Date(),
    };
  }
}

let provider: RegulatoryGateway = new DefaultRegulatoryGateway();

appLogger.warn(
  'Using default no-op compliance provider — not suitable for production. ' +
    'Integrate Chainalysis, Elliptic, or TRM Labs via setRegulatoryGateway().',
);

export function setRegulatoryGateway(p: RegulatoryGateway): void {
  provider = p;
}

export function getRegulatoryGateway(): RegulatoryGateway {
  return provider;
}
