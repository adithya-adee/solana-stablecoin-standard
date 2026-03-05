'use client';

import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, type Signer } from '@solana/web3.js';

export interface TxResult {
  signature: string | null;
  error: string | null;
  loading: boolean;
}

export function useTransaction() {
  const { connection } = useConnection();
  const { sendTransaction, publicKey } = useWallet();
  const [result, setResult] = useState<TxResult>({
    signature: null,
    error: null,
    loading: false,
  });

  const execute = useCallback(
    async (tx: Transaction, signers?: Signer[]) => {
      setResult({ signature: null, error: null, loading: true });
      try {
        if (!tx.recentBlockhash) {
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
        }
        if (!tx.feePayer && publicKey) {
          tx.feePayer = publicKey;
        }

        // Pre-sign with any additional signers so simulation has all signatures
        if (signers && signers.length > 0) {
          tx.partialSign(...signers);
        }

        // Simulate first to get detailed logs on failure
        try {
          const simResult = await connection.simulateTransaction(tx);
          if (simResult.value.err) {
            console.error('Simulation failed:', simResult.value.err);
            if (simResult.value.logs) {
              console.error('Program logs:', simResult.value.logs);
              // Find the actual program error message from logs
              const errorLog = simResult.value.logs.find(
                (l) => l.includes('Error') || l.includes('failed') || l.includes('error'),
              );
              const errMsg = errorLog
                ? `Simulation failed: ${errorLog}`
                : `Simulation failed: ${JSON.stringify(simResult.value.err)}`;
              setResult({ signature: null, error: errMsg, loading: false });
              return null;
            }
            setResult({
              signature: null,
              error: `Simulation failed: ${JSON.stringify(simResult.value.err)}`,
              loading: false,
            });
            return null;
          }
        } catch (simErr: any) {
          console.error('Simulation threw:', simErr);
          // Don't block — let sendTransaction try anyway
        }

        // Send with skipPreflight since we already simulated
        const signature = await sendTransaction(tx, connection, {
          skipPreflight: true,
          // Don't pass signers again — we already called partialSign
        });
        await connection.confirmTransaction(signature, 'confirmed');
        setResult({ signature, error: null, loading: false });
        return signature;
      } catch (err: any) {
        console.error('Transaction execution failed:', err);
        if (err.logs) {
          console.error('Simulation logs:', err.logs);
        }
        // Try to extract a meaningful message
        let message = err.message || String(err);
        if (message.includes('WalletSendTransactionError') && err.error) {
          message = err.error.message || message;
        }
        setResult({ signature: null, error: message, loading: false });
        return null;
      }
    },
    [sendTransaction, connection, publicKey],
  );

  const reset = useCallback(() => {
    setResult({ signature: null, error: null, loading: false });
  }, []);

  return { ...result, execute, reset };
}
