import { PublicKey } from '@solana/web3.js';
import {
  createConfigureAccountInstruction,
  createDepositInstruction,
  createApplyPendingBalanceInstruction,
} from '@solana/spl-token';

const pk = PublicKey.default;

try {
  const deposit = createDepositInstruction(pk, pk, pk, 100n, 6);
  console.log('Deposit bytes:', deposit.data.length, deposit.data);
} catch (e) {
  console.log('Deposit missing or error', e);
}

try {
  const config = createConfigureAccountInstruction(pk, pk, pk, new Uint8Array(36), 65536n);
  console.log('Config bytes:', config.data.length, config.data);
} catch (e) {
  console.log('Config missing or error', e);
}

try {
  const apply = createApplyPendingBalanceInstruction(pk, pk, 0n, new Uint8Array(36));
  console.log('Apply bytes:', apply.data.length, apply.data);
} catch (e) {
  console.log('Apply missing or error', e);
}
