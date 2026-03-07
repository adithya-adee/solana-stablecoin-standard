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

  const configureAccount = async (tokenAccountStr: string, elGamalSecretKey: Uint8Array, aeKey?: Uint8Array) => {
    if (!client) throw new Error('Stablecoin client not loaded');
    setLocalLoading(true);
    reset();
    try {
      const tokenAccount = new PublicKey(tokenAccountStr);
      return await client.confidential.configureAccount(tokenAccount, elGamalSecretKey, aeKey);
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
      return await client.confidential.deposit(tokenAccount, amount, decimals);
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
      return await client.confidential.applyPending(tokenAccount);
    } catch (err) {
      console.error('Failed to apply pending balance:', err);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  };

  const transfer = async (
    sourceTokenAccountStr: string,
    destinationTokenAccountStr: string,
    amount: bigint,
    sourceElGamalSecretKey: Uint8Array,
    sourceAvailableBalanceCiphertext: Uint8Array,
    sourceCurrentBalance: bigint,
    destinationElGamalPubkey: Uint8Array,
    auditorElGamalPubkey?: Uint8Array,
    aeKey?: Uint8Array,
  ) => {
    if (!client) throw new Error('Stablecoin client not loaded');
    setLocalLoading(true);
    reset();
    try {
      return await client.confidential.transfer(
        new PublicKey(sourceTokenAccountStr),
        new PublicKey(destinationTokenAccountStr),
        amount,
        sourceElGamalSecretKey,
        sourceAvailableBalanceCiphertext,
        sourceCurrentBalance,
        destinationElGamalPubkey,
        auditorElGamalPubkey,
        aeKey,
      );
    } catch (err) {
      console.error('Failed to transfer:', err);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  };

  const withdraw = async (
    tokenAccountStr: string,
    amount: bigint,
    decimals: number,
    sourceElGamalSecretKey: Uint8Array,
    sourceAvailableBalanceCiphertext: Uint8Array,
    sourceCurrentBalance: bigint,
    aeKey?: Uint8Array,
  ) => {
    if (!client) throw new Error('Stablecoin client not loaded');
    setLocalLoading(true);
    reset();
    try {
      return await client.confidential.withdraw(
        new PublicKey(tokenAccountStr),
        amount,
        decimals,
        sourceElGamalSecretKey,
        sourceAvailableBalanceCiphertext,
        sourceCurrentBalance,
        aeKey,
      );
    } catch (err) {
      console.error('Failed to withdraw:', err);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  };

  return {
    configureAccount,
    deposit,
    applyPending,
    transfer,
    withdraw,
    loading,
    error,
    signature,
    reset,
  };
}
