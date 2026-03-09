import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';
import { StablecoinClient, type TokenMintKey, type TokenStateSnapshot } from '@stbr/sss-token';

export interface TokenStateExtended extends TokenStateSnapshot {
  presetName: string;
  decimals: number;
  name: string;
  symbol: string;
  uri?: string;
}

const PRESET_NAMES: Record<number, string> = {
  1: 'SSS-1 (Minimal)',
  2: 'SSS-2 (Compliant)',
  3: 'SSS-3 (Private)',
};

/**
 * Service for fetching and aggregating stablecoin data from the blockchain.
 */
export class TokenService {
  /**
   * Fetches the complete state for a stablecoin, including configuration and mint details.
   *
   * @param connection - The Solana RPC connection.
   * @param mintAddress - The base58 address of the stablecoin mint.
   * @param provider - An optional AnchorProvider. If omitted, a read-only provider is used.
   * @returns An extended token state object.
   */
  static async fetchTokenState(
    connection: Connection,
    mintAddress: string,
    provider?: AnchorProvider,
  ): Promise<TokenStateExtended> {
    const mint = new PublicKey(mintAddress);

    // Use the provided provider or construct a read-only one for data fetching.
    const effectiveProvider =
      provider ||
      new AnchorProvider(
        connection,
        {
          publicKey: PublicKey.default,
          signTransaction: async (tx) => tx,
          signAllTransactions: async (txs) => txs,
        },
        {
          commitment: 'confirmed',
        },
      );

    // Load the client for the specific mint.
    const client = await StablecoinClient.load(effectiveProvider, mint as TokenMintKey);

    // Fetch the aggregated state snapshot from the SDK.
    const config = await client.fetchConfig();

    /**
     * Fetch the raw account data for metadata fields (name, symbol, etc.)
     * which are not currently included in the standard SDK snapshot.
     */
    interface RawStablecoinConfig {
      preset: number;
      decimals: number;
      name: string;
      symbol: string;
      uri: string;
    }

    const rawConfig = await (
      client.ledgerProgram.account as unknown as {
        stablecoinConfig: { fetch(p: PublicKey): Promise<RawStablecoinConfig> };
      }
    ).stablecoinConfig.fetch(client.configPda);

    return {
      ...config,
      presetName: PRESET_NAMES[rawConfig.preset] ?? `Preset ${rawConfig.preset}`,
      decimals: rawConfig.decimals,
      name: rawConfig.name.replace(/\0/g, '').trim(),
      symbol: rawConfig.symbol.replace(/\0/g, '').trim(),
      uri: rawConfig.uri,
    };
  }
}
