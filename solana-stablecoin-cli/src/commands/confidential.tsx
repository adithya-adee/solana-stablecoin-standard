import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { SSS, generateRandomConfidentialKeys } from '@stbr/sss-token';
import { PublicKey } from '@solana/web3.js';
import { Header, Spinner, Success, Err, Card, Table } from '../components/ui.js';
import { loadProvider, parseAmount } from '../utils/config.js';

interface ConfidentialOptions {
  mint: string;
  action: 'configure' | 'deposit' | 'transfer' | 'withdraw' | 'apply-pending';
  address: string;
  amount?: string;
  destination?: string;
  sk?: string; // ElGamal Secret Key (base64)
  ciphertext?: string; // Available balance ciphertext (base64)
  balance?: string; // Current balance (raw)
  pubkey?: string; // Destination ElGamal Pubkey (base64)
}

export default function Confidential({ options }: { options: ConfidentialOptions }) {
  const [phase, setPhase] = useState<'running' | 'confirming' | 'done' | 'error'>('running');
  const [sig, setSig] = useState('');
  const [error, setError] = useState('');
  const [extraInfo, setExtraInfo] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const provider = loadProvider();
        const mint = new PublicKey(options.mint);
        const sss = await SSS.load(provider, mint as any);
        const address = new PublicKey(options.address);

        let txSig = '';

        switch (options.action) {
          case 'configure': {
            const { elGamalPublicKey, elGamalSecretKey } = await generateRandomConfidentialKeys();
            txSig = await sss.confidential.configureAccount(address, elGamalSecretKey);
            setExtraInfo({
              'ElGamal Pubkey': Buffer.from(elGamalPublicKey).toString('base64'),
              'ElGamal Secret': Buffer.from(elGamalSecretKey).toString('base64'),
            });
            break;
          }
          case 'deposit': {
            const amount = parseAmount(options.amount!);
            txSig = await sss.confidential.deposit(address, amount, 6);
            break;
          }
          case 'apply-pending': {
            txSig = await sss.confidential.applyPending(address);
            break;
          }
          case 'transfer': {
            if (
              !options.destination ||
              !options.sk ||
              !options.ciphertext ||
              !options.balance ||
              !options.pubkey
            ) {
              throw new Error(
                'Transfer requires: --destination, --sk, --ciphertext, --balance, --pubkey',
              );
            }
            txSig = await sss.confidential.transfer(
              address,
              new PublicKey(options.destination),
              parseAmount(options.amount!),
              Buffer.from(options.sk, 'base64'),
              Buffer.from(options.ciphertext, 'base64'),
              BigInt(options.balance),
              Buffer.from(options.pubkey, 'base64'),
            );
            break;
          }
          case 'withdraw': {
            if (!options.sk || !options.ciphertext || !options.balance) {
              throw new Error('Withdraw requires: --sk, --ciphertext, --balance');
            }
            txSig = await sss.confidential.withdraw(
              address,
              parseAmount(options.amount!),
              6,
              Buffer.from(options.sk, 'base64'),
              Buffer.from(options.ciphertext, 'base64'),
              BigInt(options.balance),
            );
            break;
          }
          default:
            throw new Error(`Unknown action: ${options.action}`);
        }

        setSig(txSig);
        setPhase('confirming');

        const latestBlockHash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: txSig,
        });

        setPhase('done');
      } catch (e: any) {
        setError(e.message ?? String(e));
        setPhase('error');
      }
    })();
  }, []);

  return (
    <Box flexDirection="column">
      <Header />
      {phase === 'running' && (
        <Spinner
          label={`Performing confidential ${options.action} on ${options.address.slice(0, 8)}...`}
        />
      )}
      {phase === 'confirming' && <Spinner label="Confirming transaction..." />}
      {phase === 'done' && (
        <Box flexDirection="column">
          <Success label={options.action.toUpperCase()} value={sig} />
          {extraInfo && (
            <Card title="Extra Credentials (SAVE THESE)">
              <Table
                rows={Object.entries(extraInfo).map(([key, value]) => ({
                  key,
                  value: String(value),
                }))}
              />
            </Card>
          )}
        </Box>
      )}
      {phase === 'error' && <Err message={error} />}
    </Box>
  );
}
