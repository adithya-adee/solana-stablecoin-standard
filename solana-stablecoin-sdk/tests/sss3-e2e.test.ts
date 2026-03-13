import { describe, it, expect, vi } from 'vitest';
import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { StablecoinClient } from '../src/client';
import { TokenMintKey } from '../src/types';

// Mock ZK proof generation because it's heavy and requires WASM which might be tricky in some environments
// However, we want to test that the client correctly ORCHESTRATES these calls.

describe('SSS-3 Client Integration (E2E)', () => {
  const connection = new Connection('http://localhost:8899', 'confirmed');
  const payer = Keypair.generate();
  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, {});

  it('can instantiate a confidential client and access its namespace', async () => {
    const mint = Keypair.generate().publicKey as TokenMintKey;
    // Mocking the load function because we don't have a real mint on a real chain here
    vi.spyOn(StablecoinClient, 'load').mockImplementation(async () => {
      return new (StablecoinClient as any)(
        mint,
        PublicKey.default,
        0,
        { programId: PublicKey.default, account: { stablecoinConfig: {} } },
        { programId: PublicKey.default },
        provider,
      );
    });

    const client = await StablecoinClient.load(provider, mint);
    expect(client.confidential).toBeDefined();
    expect(typeof client.confidential.configureAccount).toBe('function');
    expect(typeof client.confidential.transfer).toBe('function');
  });

  it('builds a configureAccount transaction with proofs', async () => {
    const mint = Keypair.generate().publicKey as TokenMintKey;
    const client = new (StablecoinClient as any)(
      mint,
      PublicKey.default,
      0,
      { programId: PublicKey.default, account: { stablecoinConfig: {} } },
      { programId: PublicKey.default },
      provider,
    );

    const elGamalSecret = new Uint8Array(32).fill(1);
    const aeKey = new Uint8Array(16).fill(2);
    const tokenAccount = Keypair.generate().publicKey;

    // Test that configureAccountIxs (low level) returns instructions
    const ixs = await client.confidential.configureAccountIxs(tokenAccount, elGamalSecret, aeKey);

    expect(ixs.length).toBe(2); // VerifyPubKey + ConfigureAccount
    expect(ixs[0].programId.toBase58()).toBe('ZkTokenProof1111111111111111111111111111111');
    expect(ixs[1].data[0]).toBe(27); // ConfidentialTransferExtension
    expect(ixs[1].data[1]).toBe(2); // ConfigureAccount
  });

  it('builds a deposit instruction', async () => {
    const mint = Keypair.generate().publicKey as TokenMintKey;
    const client = new (StablecoinClient as any)(
      mint,
      PublicKey.default,
      0,
      { programId: PublicKey.default, account: { stablecoinConfig: {} } },
      { programId: PublicKey.default },
      provider,
    );

    const tokenAccount = Keypair.generate().publicKey;
    const amount = 1000000n;
    const decimals = 6;

    const ix = client.confidential.depositIx(tokenAccount, amount, decimals);
    expect(ix.data[0]).toBe(27); // ConfidentialTransferExtension
    expect(ix.data[1]).toBe(5); // Deposit
    expect(ix.keys[0].pubkey.toBase58()).toBe(tokenAccount.toBase58());
  });
});
