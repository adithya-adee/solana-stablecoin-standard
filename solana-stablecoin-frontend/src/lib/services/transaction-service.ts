import { AnchorProvider } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import { StablecoinClient, asTier } from '@stbr/sss-token';

export interface CreateStablecoinParams {
  preset: string;
  name: string;
  symbol: string;
  uri?: string;
  decimals: number;
  supplyCap?: string;
  initialRoles?: string[];
}

/**
 * Service for coordinating blockchain transactions.
 */
export class TransactionService {
  /**
   * Deploys a new stablecoin and initializes its configuration on-chain.
   *
   * This method uses the SDK's StablecoinClient.create which bundles mint creation,
   * metadata initialization, and initial role grants into the setup process.
   *
   * @param provider - The AnchorProvider (must have a valid wallet).
   * @param params - Configuration parameters for the new stablecoin.
   * @param mintKeypair - Keypair for the new mint account.
   * @returns The base58 address of the newly created stablecoin mint.
   */
  static async deployStablecoin(
    provider: AnchorProvider,
    params: CreateStablecoinParams,
    mintKeypair: Keypair,
  ): Promise<string> {
    const { preset, name, symbol, uri, decimals, supplyCap, initialRoles } = params;

    const options = {
      preset: asTier(preset as any),
      name,
      symbol,
      uri: uri || '',
      decimals,
      supplyCap: supplyCap ? BigInt(supplyCap) : undefined,
      initialRoles,
    };

    const client = await StablecoinClient.create(provider, options, mintKeypair);
    return client.mintAddress.toBase58();
  }
}
