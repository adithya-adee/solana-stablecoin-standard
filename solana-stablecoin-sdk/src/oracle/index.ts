import { Connection, PublicKey } from '@solana/web3.js';

export interface PriceFeedData {
  price: bigint;
  exponent: number;
  priceUsd: number;
}

export const PRICE_FEED_REGISTRY = {
  SOL_USD_MAINNET: new PublicKey('H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG'),
  SOL_USD_DEVNET: new PublicKey('J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix'),
  USDC_USD_MAINNET: new PublicKey('Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD'),
  USDT_USD_MAINNET: new PublicKey('3vxLXJqLqF3JG5TCbYycbKWRBbCJQLxQmBGCkyqEEefL'),
} as const;

export function decodePythFeed(data: Buffer | Uint8Array): PriceFeedData {
  if (data.length < 224) {
    throw new Error(`Invalid Pyth price account: expected >= 224 bytes, got ${data.length}`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const exponent = view.getInt32(20, true);
  const price = view.getBigInt64(208, true);

  if (price <= 0n) {
    throw new Error(`Invalid oracle price: ${price} (must be positive)`);
  }

  const priceUsd = Number(price) * Math.pow(10, exponent);
  return { price, exponent, priceUsd };
}

export async function loadPythFeed(
  connection: Connection,
  priceFeedAddress: PublicKey,
): Promise<PriceFeedData> {
  const accountInfo = await connection.getAccountInfo(priceFeedAddress);
  if (!accountInfo) {
    throw new Error(`Price feed account not found: ${priceFeedAddress.toBase58()}`);
  }
  return decodePythFeed(accountInfo.data);
}

export function convertUsdToRawAmount(
  usdAmount: bigint,
  price: PriceFeedData,
  tokenDecimals: number,
): bigint {
  const decimalsPow = BigInt(10 ** tokenDecimals);

  if (price.exponent < 0) {
    const absExpo = Math.abs(price.exponent);
    const numerator = usdAmount * decimalsPow * BigInt(10 ** absExpo);
    return numerator / price.price;
  } else {
    const numerator = usdAmount * decimalsPow;
    const denominator = price.price * BigInt(10 ** price.exponent);
    return numerator / denominator;
  }
}

export function convertRawAmountToUsd(
  tokenAmount: bigint,
  price: PriceFeedData,
  tokenDecimals: number,
): number {
  const decimalsPow = BigInt(10 ** tokenDecimals);

  if (price.exponent < 0) {
    const absExpo = Math.abs(price.exponent);
    const numerator = tokenAmount * price.price;
    const denominator = decimalsPow * BigInt(10 ** absExpo);
    return Number(numerator) / Number(denominator);
  } else {
    const numerator = tokenAmount * price.price * BigInt(10 ** price.exponent);
    return Number(numerator) / Number(decimalsPow);
  }
}

export function packOracleMeta(priceFeedAddress: PublicKey): {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
} {
  return {
    pubkey: priceFeedAddress,
    isSigner: false,
    isWritable: false,
  };
}
