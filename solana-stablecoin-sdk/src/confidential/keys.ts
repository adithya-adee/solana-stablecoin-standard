import { randomBytes } from 'crypto';

export function generateDummyElgamalKeys(): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  return {
    publicKey: new Uint8Array(randomBytes(32)),
    secretKey: new Uint8Array(randomBytes(32)),
  };
}

export function generateDummyAesKey(): Uint8Array {
  return new Uint8Array(randomBytes(16));
}

export function deriveElGamalKeypair(
  _signer: unknown,
  _tokenAccount: unknown,
): { publicKey: Uint8Array; secretKey: Uint8Array } {
  throw new Error(
    'ElGamal keypair derivation requires the solana-zk-sdk Rust crate. ' +
      'Use generateDummyElgamalKeys() for testing, or call the Rust proof ' +
      'service for production deployments.',
  );
}
