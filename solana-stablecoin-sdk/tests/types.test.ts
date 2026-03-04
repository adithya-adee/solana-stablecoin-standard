import { describe, it, expect } from 'vitest';
import {
  ROLE_ID_MAP,
  TIER_ORDINAL_MAP,
  ORDINAL_TO_TIER_MAP,
  StablecoinTiers,
  asTier,
} from '../src/types';

describe('Type mappings', () => {
  describe('ROLE_ID_MAP', () => {
    it('has correct values matching on-chain Role enum discriminants', () => {
      expect(ROLE_ID_MAP['admin']).toBe(0);
      expect(ROLE_ID_MAP['minter']).toBe(1);
      expect(ROLE_ID_MAP['freezer']).toBe(2);
      expect(ROLE_ID_MAP['pauser']).toBe(3);
      expect(ROLE_ID_MAP['burner']).toBe(4);
      expect(ROLE_ID_MAP['blacklister']).toBe(5);
      expect(ROLE_ID_MAP['seizer']).toBe(6);
    });

    it('has exactly seven roles', () => {
      expect(Object.keys(ROLE_ID_MAP)).toHaveLength(7);
    });
  });

  describe('TIER_ORDINAL_MAP', () => {
    it('has correct values matching on-chain preset u8', () => {
      expect(TIER_ORDINAL_MAP['sss-1']).toBe(1);
      expect(TIER_ORDINAL_MAP['sss-2']).toBe(2);
      expect(TIER_ORDINAL_MAP['sss-3']).toBe(3);
    });

    it('has exactly three presets', () => {
      expect(Object.keys(TIER_ORDINAL_MAP)).toHaveLength(3);
    });
  });

  describe('ORDINAL_TO_TIER_MAP', () => {
    it('maps u8 back to preset string', () => {
      expect(ORDINAL_TO_TIER_MAP[1]).toBe(asTier('sss-1'));
      expect(ORDINAL_TO_TIER_MAP[2]).toBe(asTier('sss-2'));
      expect(ORDINAL_TO_TIER_MAP[3]).toBe(asTier('sss-3'));
    });

    it('is consistent with TIER_ORDINAL_MAP', () => {
      for (const [key, value] of Object.entries(TIER_ORDINAL_MAP)) {
        expect(ORDINAL_TO_TIER_MAP[value]).toBe(asTier(key as 'sss-1' | 'sss-2' | 'sss-3'));
      }
    });
  });

  describe('StablecoinTiers', () => {
    it('has SSS_1, SSS_2, SSS_3 constants', () => {
      expect(StablecoinTiers.SSS_1).toBe(asTier('sss-1'));
      expect(StablecoinTiers.SSS_2).toBe(asTier('sss-2'));
      expect(StablecoinTiers.SSS_3).toBe(asTier('sss-3'));
    });
  });
});
