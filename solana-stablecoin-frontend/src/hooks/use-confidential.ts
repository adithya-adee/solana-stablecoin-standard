'use client';

import { useState } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { generateTestElGamalKeypair, generateDummyAesKey } from '@stbr/sss-token';
import { useStablecoin } from './use-stablecoin';
import { useTransaction } from './use-transaction';

export function useConfidential() {
  const { client } = useStablecoin();
  const { execute, signature, error, loading: txLoading, reset } = useTransaction();
  const [localLoading, setLocalLoading] = useState(false);

  const loading = txLoading || localLoading;

  const configureAccount = async (tokenAccountStr: string) => {
    if (!client) throw new Error('Stablecoin client not loaded');
    setLocalLoading(true);
    reset();

    try {
      const tokenAccount = new PublicKey(tokenAccountStr);
      const { publicKey: elGamalPubkey } = generateTestElGamalKeypair();
      const aesKey = generateDummyAesKey();

      // Get the raw instruction array
      const ops = client.privacyOps;
      // We must build the instruction manually to bypass the built-in sendAndConfirm
      const ix = ops.configureAccountIx(tokenAccount, elGamalPubkey, aesKey);

      const tx = new Transaction().add(ix);
      return await execute(tx);
    } catch (err) {
      console.error('Failed to configure account:', err);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  };

  const deposit = async (tokenAccountStr: string, amount: bigint, decimals: number) => {
    if (!client) throw new Error('Stablecoin client not loaded');
    setLocalLoading(true);
    reset();

    try {
      const tokenAccount = new PublicKey(tokenAccountStr);
      const ix = client.privacyOps.depositIx(tokenAccount, amount, decimals);

      const tx = new Transaction().add(ix);
      return await execute(tx);
    } catch (err) {
      console.error('Failed to deposit:', err);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  };

  const applyPending = async (tokenAccountStr: string) => {
    if (!client) throw new Error('Stablecoin client not loaded');
    setLocalLoading(true);
    reset();

    try {
      const tokenAccount = new PublicKey(tokenAccountStr);
      const ix = client.privacyOps.applyPendingIx(tokenAccount);

      const tx = new Transaction().add(ix);
      return await execute(tx);
    } catch (err) {
      console.error('Failed to apply pending balance:', err);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  };

  return {
    configureAccount,
    deposit,
    applyPending,
    loading,
    error,
    signature,
    reset,
  };
}
