import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  decodePythFeed,
  convertUsdToRawAmount,
  convertRawAmountToUsd,
  packOracleMeta,
  PRICE_FEED_REGISTRY,
} from '../src/oracle';
import type { PriceFeedData } from '../src/oracle';

/** Build a fake Pyth v2 price account buffer with given exponent and price. */
function buildPythBuffer(exponent: number, price: bigint): Buffer {
  const buf = Buffer.alloc(224);
  buf.writeInt32LE(exponent, 20);
  buf.writeBigInt64LE(price, 208);
  return buf;
}

describe('Oracle', () => {
  describe('decodePythFeed', () => {
    it('parses valid price account with expo=-8', () => {
      const buf = buildPythBuffer(-8, 100_000_000n);
      const result = decodePythFeed(buf);
      expect(result.price).toBe(100_000_000n);
      expect(result.exponent).toBe(-8);
      expect(result.priceUsd).toBeCloseTo(1.0, 6);
    });

    it('parses price with expo=-6', () => {
      const buf = buildPythBuffer(-6, 1_500_000n);
      const result = decodePythFeed(buf);
      expect(result.priceUsd).toBeCloseTo(1.5, 6);
    });

    it('rejects buffer shorter than 224 bytes', () => {
      const buf = Buffer.alloc(100);
      expect(() => decodePythFeed(buf)).toThrow('expected >= 224 bytes');
    });

    it('rejects zero price', () => {
      const buf = buildPythBuffer(-8, 0n);
      expect(() => decodePythFeed(buf)).toThrow('must be positive');
    });

    it('rejects negative price', () => {
      const buf = buildPythBuffer(-8, -100n);
      expect(() => decodePythFeed(buf)).toThrow('must be positive');
    });
  });

  describe('convertUsdToRawAmount', () => {
    const oneUsdPrice: PriceFeedData = { price: 100_000_000n, exponent: -8, priceUsd: 1.0 };

    it('converts $100 at $1.00 to 100e6 tokens (6 decimals)', () => {
      const result = convertUsdToRawAmount(100n, oneUsdPrice, 6);
      expect(result).toBe(100_000_000n);
    });

    it('converts $1 at $2.00 to 0.5e6 tokens', () => {
      const twoUsdPrice: PriceFeedData = { price: 200_000_000n, exponent: -8, priceUsd: 2.0 };
      const result = convertUsdToRawAmount(1n, twoUsdPrice, 6);
      expect(result).toBe(500_000n);
    });

    it('handles positive exponent', () => {
      const posExpo: PriceFeedData = { price: 1n, exponent: 2, priceUsd: 100 };
      const result = convertUsdToRawAmount(100n, posExpo, 6);
      expect(result).toBe(1_000_000n);
    });
  });

  describe('convertRawAmountToUsd', () => {
    const oneUsdPrice: PriceFeedData = { price: 100_000_000n, exponent: -8, priceUsd: 1.0 };

    it('converts 100e6 tokens back to ~$100', () => {
      const result = convertRawAmountToUsd(100_000_000n, oneUsdPrice, 6);
      expect(result).toBeCloseTo(100.0, 2);
    });

    it('handles positive exponent', () => {
      const posExpo: PriceFeedData = { price: 1n, exponent: 2, priceUsd: 100 };
      const result = convertRawAmountToUsd(1_000_000n, posExpo, 6);
      expect(result).toBeCloseTo(100.0, 2);
    });

    it('round-trips with convertUsdToRawAmount', () => {
      const price: PriceFeedData = { price: 150_000_000n, exponent: -8, priceUsd: 1.5 };
      const tokens = convertUsdToRawAmount(1000n, price, 6);
      const usdBack = convertRawAmountToUsd(tokens, price, 6);
      expect(usdBack).toBeCloseTo(1000.0, 0);
    });
  });

  describe('packOracleMeta', () => {
    it('returns correct AccountMeta shape', () => {
      const key = PublicKey.unique();
      const meta = packOracleMeta(key);
      expect(meta.pubkey.equals(key)).toBe(true);
      expect(meta.isSigner).toBe(false);
      expect(meta.isWritable).toBe(false);
    });
  });

  describe('PRICE_FEED_REGISTRY', () => {
    it('has all four expected feed addresses', () => {
      expect(PRICE_FEED_REGISTRY.SOL_USD_MAINNET).toBeInstanceOf(PublicKey);
      expect(PRICE_FEED_REGISTRY.SOL_USD_DEVNET).toBeInstanceOf(PublicKey);
      expect(PRICE_FEED_REGISTRY.USDC_USD_MAINNET).toBeInstanceOf(PublicKey);
      expect(PRICE_FEED_REGISTRY.USDT_USD_MAINNET).toBeInstanceOf(PublicKey);
    });

    it('has exactly four feeds', () => {
      expect(Object.keys(PRICE_FEED_REGISTRY)).toHaveLength(4);
    });
  });
});
