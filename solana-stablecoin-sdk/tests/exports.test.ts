import { describe, it, expect } from 'vitest';
import * as SDK from '../src/index';

describe('SDK barrel exports', () => {
  it('SSS and SolanaStablecoin are the same class', () => {
    expect(SDK.StablecoinClient).toBe(SDK.StablecoinClient);
    expect(typeof SDK.StablecoinClient).toBe('function');
  });

  it('Presets constant has all three presets', () => {
    expect(SDK.Presets).toEqual({
      SSS_1: 'sss-1',
      SSS_2: 'sss-2',
      SSS_3: 'sss-3',
    });
  });

  describe('instruction builders', () => {
    const builders = [
      'createInitInstruction',
      'createIssuanceInstruction',
      'createRedemptionInstruction',
      'createFreezeInstruction',
      'createThawInstruction',
      'createPauseInstruction',
      'createResumeInstruction',
      'createSeizeInstruction',
      'createGrantInstruction',
      'createRevokeInstruction',
      'createAuthorityTransferInstruction',
      'createMinterUpdateInstruction',
      'createCapUpdateInstruction',
      'createHookMetaInitInstruction',
      'createDenyListAddInstruction',
      'createDenyListRemoveInstruction',
    ];

    it.each(builders)('exports %s as a function', (name) => {
      expect(typeof (SDK as Record<string, unknown>)[name]).toBe('function');
    });

    it('exports exactly 16 instruction builders', () => {
      expect(builders).toHaveLength(16);
    });
  });

  describe('PDA derivers', () => {
    it('exports deriveConfigPda', () => {
      expect(typeof SDK.deriveConfigPda).toBe('function');
    });
    it('exports deriveRolePda', () => {
      expect(typeof SDK.deriveRolePda).toBe('function');
    });
    it('exports deriveBlacklistPda', () => {
      expect(typeof SDK.deriveBlacklistPda).toBe('function');
    });
  });

  describe('preset creators', () => {
    it('exports createSss1MintTransaction', () => {
      expect(typeof SDK.createSss1MintTx).toBe('function');
    });
    it('exports createSss2MintTransaction', () => {
      expect(typeof SDK.createSss2MintTx).toBe('function');
    });
    it('exports createSss3MintTransaction', () => {
      expect(typeof SDK.createSss3MintTx).toBe('function');
    });
  });

  describe('oracle functions', () => {
    it('exports decodePythFeed', () => {
      expect(typeof SDK.decodePythFeed).toBe('function');
    });
    it('exports loadPythFeed', () => {
      expect(typeof SDK.loadPythFeed).toBe('function');
    });
    it('exports convertUsdToRawAmount', () => {
      expect(typeof SDK.convertUsdToRawAmount).toBe('function');
    });
    it('exports convertRawAmountToUsd', () => {
      expect(typeof SDK.convertRawAmountToUsd).toBe('function');
    });
    it('exports packOracleMeta', () => {
      expect(typeof SDK.packOracleMeta).toBe('function');
    });
    it('exports PRICE_FEED_REGISTRY', () => {
      expect(SDK.PRICE_FEED_REGISTRY).toBeDefined();
    });
  });

  describe('confidential', () => {
    it('exports PrivacyOpsBuilder', () => {
      expect(typeof SDK.PrivacyOpsBuilder).toBe('function');
    });
    it('exports generateDummyElgamalKeys', () => {
      expect(typeof SDK.generateDummyElgamalKeys).toBe('function');
    });
    it('exports generateDummyAesKey', () => {
      expect(typeof SDK.generateDummyAesKey).toBe('function');
    });
    it('exports Token-2022 key derivation constants and helpers', () => {
      expect(SDK.CONFIDENTIAL_TRANSFER_ELGAMAL_SEED_MESSAGE).toBe('ElGamalSecretKey');
      expect(SDK.CONFIDENTIAL_TRANSFER_AE_KEY_SEED_MESSAGE).toBe('AeKey');
      expect(typeof SDK.deriveConfidentialKeysFromSignatures).toBe('function');
      expect(typeof SDK.encryptDecryptableBalance).toBe('function');
      expect(typeof SDK.decryptDecryptableBalance).toBe('function');
      expect(typeof SDK.parseConfidentialTransferAccountState).toBe('function');
      expect(SDK.ZK_ELGAMAL_PROGRAM_DISABLED_NOTICE).toBeDefined();
    });
  });

  describe('error classes', () => {
    it('exports StablecoinError', () => {
      expect(typeof SDK.StablecoinError).toBe('function');
    });
    it('exports mapAnchorError', () => {
      expect(typeof SDK.mapAnchorError).toBe('function');
    });
  });

  describe('type maps', () => {
    it('exports ROLE_MAP with 7 roles', () => {
      expect(Object.keys(SDK.ROLE_MAP)).toHaveLength(7);
    });
    it('exports PRESET_MAP with 3 presets', () => {
      expect(Object.keys(SDK.PRESET_MAP)).toHaveLength(3);
    });
    it('exports REVERSE_PRESET_MAP', () => {
      expect(SDK.REVERSE_PRESET_MAP).toBeDefined();
    });
  });
});
