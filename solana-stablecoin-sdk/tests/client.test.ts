import { describe, it, expect } from 'vitest';
import { StablecoinClient, SolanaStablecoin, SSS } from '../src/index';

describe('StablecoinClient class', () => {
  describe('static factories', () => {
    it('StablecoinClient.create is a static function', () => {
      expect(typeof StablecoinClient.create).toBe('function');
    });

    it('StablecoinClient.initFromExtensions is a static function', () => {
      expect(typeof StablecoinClient.initFromExtensions).toBe('function');
    });

    it('StablecoinClient.load is a static function', () => {
      expect(typeof StablecoinClient.load).toBe('function');
    });
  });

  describe('SolanaStablecoin alias', () => {
    it('is the same class as StablecoinClient', () => {
      expect(SolanaStablecoin).toBe(StablecoinClient);
    });

    it('has the same static methods', () => {
      expect(SolanaStablecoin.create).toBe(StablecoinClient.create);
      expect(SolanaStablecoin.initFromExtensions).toBe(StablecoinClient.initFromExtensions);
      expect(SolanaStablecoin.load).toBe(StablecoinClient.load);
    });
  });

  describe('SSS alias', () => {
    it('is the same class as StablecoinClient', () => {
      expect(SSS).toBe(StablecoinClient);
    });

    it('has the same static methods', () => {
      expect(SSS.create).toBe(StablecoinClient.create);
      expect(SSS.initFromExtensions).toBe(StablecoinClient.initFromExtensions);
      expect(SSS.load).toBe(StablecoinClient.load);
    });
  });
});
