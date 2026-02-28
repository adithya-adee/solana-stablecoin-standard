import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { startAnchor, BankrunProvider } from "anchor-bankrun";
import { SssCore } from "../target/types/sss_core";
import {
  createSss1Mint,
  createTokenAccount,
  grantRole,
  fetchConfig,
  getTokenBalance,
  airdropSol,
  ROLE_MINTER,
  CreateSss1MintResult,
} from "./helpers";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

// Pyth Solana Receiver program — the owner of all PriceUpdateV2 accounts.
// This is the canonical mainnet/devnet address.
// Using Anchor's Account<'info, PriceUpdateV2> automatically verifies
// the account is owned by this program.
const PYTH_RECEIVER_PROGRAM = new PublicKey(
  "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
);

// Anchor discriminator for PriceUpdateV2 (first 8 bytes of sha256("account:PriceUpdateV2"))
// Obtained from: sha256("account:PriceUpdateV2")[0..8]
const PRICE_UPDATE_V2_DISCRIMINATOR = Buffer.from([
  34, 241, 35, 99, 157, 126, 244, 205,
]);

// ─────────────────────────────────────────────────────────────
// Mock Oracle Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Builds a mock Pyth Receiver PriceUpdateV2 account data buffer using Borsh layout.
 *
 * PriceUpdateV2 Borsh layout (total = 8 + 32 + 1 + 84 + 8 = 133 bytes + discriminator = 141):
 *   [0..8]   discriminator
 *   [8..40]  write_authority (Pubkey, 32 bytes)
 *   [40]     verification_level (u8, 0=Partial, 1=Full)
 *   [41..125] price_message (PriceFeedMessage):
 *     [41..73]  feed_id ([u8; 32])
 *     [73..81]  price (i64)
 *     [81..89]  conf (u64)
 *     [89..93]  exponent (i32)
 *     [93..101] publish_time (i64)
 *     [101..109] prev_publish_time (i64)
 *     [109..117] ema_price (i64)
 *     [117..125] ema_conf (u64)
 *   [125..133] posted_slot (u64)
 *
 * @param price - Raw price i64 (e.g. 100_000_000 for $1.00 with exponent -8)
 * @param exponent - Price exponent i32 (typically -8)
 * @param publishTime - Unix timestamp (seconds). Defaults to now if omitted.
 */
function buildPriceUpdateV2Data(
  price: bigint,
  exponent: number,
  publishTime?: bigint,
): Buffer {
  const buf = Buffer.alloc(133);
  let offset = 0;

  // [0..8] Anchor discriminator for PriceUpdateV2
  PRICE_UPDATE_V2_DISCRIMINATOR.copy(buf, offset);
  offset += 8;

  // [8..40] write_authority: all zeros (SystemProgram)
  offset += 32;

  // [40] verification_level: 1 = Full
  buf.writeUInt8(1, offset);
  offset += 1;

  // [41..73] feed_id: all zeros (wildcard — matches [0u8;32] in the program)
  offset += 32;

  // [73..81] price (i64 LE)
  buf.writeBigInt64LE(price, offset);
  offset += 8;

  // [81..89] conf (u64 LE) — confidence interval, use 0
  buf.writeBigUInt64LE(0n, offset);
  offset += 8;

  // [89..93] exponent (i32 LE)
  buf.writeInt32LE(exponent, offset);
  offset += 4;

  // [93..101] publish_time (i64 LE)
  const ts =
    publishTime !== undefined
      ? publishTime
      : BigInt(Math.floor(Date.now() / 1000));
  buf.writeBigInt64LE(ts, offset);
  offset += 8;

  // [101..109] prev_publish_time (i64 LE)
  buf.writeBigInt64LE(ts - 1n, offset);
  offset += 8;

  // [109..117] ema_price (i64 LE)
  buf.writeBigInt64LE(price, offset);
  offset += 8;

  // [117..125] ema_conf (u64 LE)
  buf.writeBigUInt64LE(0n, offset);
  offset += 8;

  // [125..133] posted_slot (u64 LE) — use slot 1
  buf.writeBigUInt64LE(1n, offset);

  return buf;
}

// ─────────────────────────────────────────────────────────────
// Part 1: Standard validator tests — no-oracle path
//
// With the typed PriceUpdateV2 account, Anchor enforces ownership.
// These tests verify that minting WITHOUT an oracle still works correctly
// (raw token-unit supply cap).
// ─────────────────────────────────────────────────────────────

describe("Oracle — No-Oracle Path (anchor test validator)", () => {
  const provider = anchor.AnchorProvider.env();
  provider.opts.commitment = "confirmed";
  anchor.setProvider(provider);

  const coreProgram = anchor.workspace.SssCore as Program<SssCore>;

  const minter = Keypair.generate();
  const recipient = Keypair.generate();

  let mintResult: CreateSss1MintResult;
  let minterRolePda: PublicKey;
  let recipientAta: PublicKey;

  before(async () => {
    await airdropSol(provider.connection, minter.publicKey, 10);
    await airdropSol(provider.connection, recipient.publicKey, 2);

    mintResult = await createSss1Mint(provider, coreProgram, {
      name: "Oracle Validation USD",
      symbol: "OVUSD",
      uri: "https://example.com/ovusd.json",
      decimals: 6,
      supplyCap: new BN(1_000_000),
    });

    minterRolePda = await grantRole(
      coreProgram,
      mintResult.configPda,
      mintResult.adminRolePda,
      minter.publicKey,
      ROLE_MINTER,
    );

    recipientAta = await createTokenAccount(
      provider,
      mintResult.mint.publicKey,
      recipient.publicKey,
    );
  });

  it("uses raw supply cap when no oracle is provided", async () => {
    await coreProgram.methods
      .mintTokens(new BN(1_000_000))
      .accountsPartial({
        minter: minter.publicKey,
        config: mintResult.configPda,
        minterRole: minterRolePda,
        mint: mintResult.mint.publicKey,
        to: recipientAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        priceUpdate: null,
      })
      .signers([minter])
      .rpc();

    const balance = await getTokenBalance(provider.connection, recipientAta);
    expect(balance.toString()).to.equal("1000000");
  });

  it("rejects minting over raw supply cap without oracle", async () => {
    try {
      await coreProgram.methods
        .mintTokens(new BN(1))
        .accountsPartial({
          minter: minter.publicKey,
          config: mintResult.configPda,
          minterRole: minterRolePda,
          mint: mintResult.mint.publicKey,
          to: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          priceUpdate: null,
        })
        .signers([minter])
        .rpc();
      expect.fail("Should have thrown SupplyCapExceeded");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("SupplyCapExceeded");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Part 2: Bankrun tests — PriceUpdateV2 oracle integration
//
// Uses bankrun's setAccount() to inject PriceUpdateV2 accounts with
// arbitrary data, owned by the Pyth Receiver program.
// Anchor's Account<'info, PriceUpdateV2> verifies the owner automatically.
// ─────────────────────────────────────────────────────────────

describe("Oracle — PriceUpdateV2 (bankrun)", () => {
  let context: Awaited<ReturnType<typeof startAnchor>>;
  let provider: BankrunProvider;
  let coreProgram: Program<SssCore>;

  const minter = Keypair.generate();
  const recipient = Keypair.generate();

  /**
   * Injects a mock PriceUpdateV2 account into the bankrun context.
   * Owned by the Pyth Receiver program so Anchor's Account<PriceUpdateV2>
   * can deserialize it.
   */
  function injectMockPriceUpdate(
    price: bigint,
    exponent: number,
    publishTime?: bigint,
  ): PublicKey {
    const oracle = Keypair.generate();
    const data = buildPriceUpdateV2Data(price, exponent, publishTime);

    context.setAccount(oracle.publicKey, {
      lamports: LAMPORTS_PER_SOL,
      data,
      owner: PYTH_RECEIVER_PROGRAM,
      executable: false,
    });

    return oracle.publicKey;
  }

  before(async () => {
    context = await startAnchor(
      "",
      [],
      [
        {
          address: minter.publicKey,
          info: {
            lamports: 100 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        },
        {
          address: recipient.publicKey,
          info: {
            lamports: 10 * LAMPORTS_PER_SOL,
            data: Buffer.alloc(0),
            owner: SystemProgram.programId,
            executable: false,
          },
        },
      ],
    );

    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    coreProgram = new Program<SssCore>(
      anchor.workspace.SssCore.idl,
      provider,
    );
  });

  describe("oracle-adjusted supply cap at $1.00", () => {
    let mintResult: CreateSss1MintResult;
    let minterRolePda: PublicKey;
    let recipientAta: PublicKey;

    before(async () => {
      // Supply cap = 1000 USD, decimals = 6
      // With oracle price $1.00 (price=100_000_000, expo=-8):
      //   token_cap = 1000 * 10^6 * 10^8 / 100_000_000 = 1_000_000_000
      mintResult = await createSss1Mint(
        provider as any,
        coreProgram,
        {
          name: "Oracle Cap USD",
          symbol: "OCUSD",
          uri: "https://example.com/ocusd.json",
          decimals: 6,
          supplyCap: new BN(1_000),
        },
      );

      minterRolePda = await grantRole(
        coreProgram,
        mintResult.configPda,
        mintResult.adminRolePda,
        minter.publicKey,
        ROLE_MINTER,
      );

      recipientAta = await createTokenAccount(
        provider as any,
        mintResult.mint.publicKey,
        recipient.publicKey,
      );
    });

    it("succeeds minting under oracle-adjusted cap", async () => {
      // Price = $1.00, cap = 1000 USD => token_cap = 1_000_000_000
      const oracleKey = injectMockPriceUpdate(BigInt(100_000_000), -8);

      // Mint 500 tokens = 500_000_000 token units (under cap)
      await coreProgram.methods
        .mintTokens(new BN(500_000_000))
        .accountsPartial({
          minter: minter.publicKey,
          config: mintResult.configPda,
          minterRole: minterRolePda,
          mint: mintResult.mint.publicKey,
          to: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          priceUpdate: oracleKey,
        })
        .signers([minter])
        .rpc();

      const config = await fetchConfig(coreProgram, mintResult.configPda);
      expect(config.totalMinted.toNumber()).to.equal(500_000_000);
    });

    it("fails minting over oracle-adjusted cap", async () => {
      // Already minted 500_000_000. Cap at $1.00 = 1_000_000_000.
      // Try minting 501 tokens = 501_000_000 (total = 1_001_000_000 > cap)
      const oracleKey = injectMockPriceUpdate(BigInt(100_000_000), -8);

      try {
        await coreProgram.methods
          .mintTokens(new BN(501_000_000))
          .accountsPartial({
            minter: minter.publicKey,
            config: mintResult.configPda,
            minterRole: minterRolePda,
            mint: mintResult.mint.publicKey,
            to: recipientAta,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            priceUpdate: oracleKey,
          })
          .signers([minter])
          .rpc();
        expect.fail("Should have thrown SupplyCapExceeded");
      } catch (err: any) {
        expect(err.toString()).to.include("SupplyCapExceeded");
      }
    });

    it("succeeds minting exactly at oracle-adjusted cap", async () => {
      const oracleKey = injectMockPriceUpdate(BigInt(100_000_000), -8);

      await coreProgram.methods
        .mintTokens(new BN(500_000_000))
        .accountsPartial({
          minter: minter.publicKey,
          config: mintResult.configPda,
          minterRole: minterRolePda,
          mint: mintResult.mint.publicKey,
          to: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          priceUpdate: oracleKey,
        })
        .signers([minter])
        .rpc();

      const config = await fetchConfig(coreProgram, mintResult.configPda);
      expect(config.totalMinted.toNumber()).to.equal(1_000_000_000);
    });
  });

  describe("price sensitivity", () => {
    it("higher price ($2.00) reduces token cap", async () => {
      const capMint = await createSss1Mint(provider as any, coreProgram, {
        name: "Price High USD",
        symbol: "PHUSD",
        uri: "https://example.com/phusd.json",
        decimals: 6,
        supplyCap: new BN(100),
      });

      const minterRole = await grantRole(
        coreProgram,
        capMint.configPda,
        capMint.adminRolePda,
        minter.publicKey,
        ROLE_MINTER,
      );

      const ata = await createTokenAccount(
        provider as any,
        capMint.mint.publicKey,
        recipient.publicKey,
      );

      // cap = 100 USD, $2.00 => token_cap = 50_000_000 (50 tokens)
      const oracleKey = injectMockPriceUpdate(BigInt(200_000_000), -8);

      await coreProgram.methods
        .mintTokens(new BN(50_000_000))
        .accountsPartial({
          minter: minter.publicKey,
          config: capMint.configPda,
          minterRole: minterRole,
          mint: capMint.mint.publicKey,
          to: ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          priceUpdate: oracleKey,
        })
        .signers([minter])
        .rpc();

      const config = await fetchConfig(coreProgram, capMint.configPda);
      expect(config.totalMinted.toNumber()).to.equal(50_000_000);

      const oracleKey2 = injectMockPriceUpdate(BigInt(200_000_000), -8);
      try {
        await coreProgram.methods
          .mintTokens(new BN(1))
          .accountsPartial({
            minter: minter.publicKey,
            config: capMint.configPda,
            minterRole: minterRole,
            mint: capMint.mint.publicKey,
            to: ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            priceUpdate: oracleKey2,
          })
          .signers([minter])
          .rpc();
        expect.fail("Should have thrown SupplyCapExceeded");
      } catch (err: any) {
        expect(err.toString()).to.include("SupplyCapExceeded");
      }
    });

    it("lower price ($0.50) increases token cap", async () => {
      const capMint = await createSss1Mint(provider as any, coreProgram, {
        name: "Price Low USD",
        symbol: "PLUSD",
        uri: "https://example.com/plusd.json",
        decimals: 6,
        supplyCap: new BN(100),
      });

      const minterRole = await grantRole(
        coreProgram,
        capMint.configPda,
        capMint.adminRolePda,
        minter.publicKey,
        ROLE_MINTER,
      );

      const ata = await createTokenAccount(
        provider as any,
        capMint.mint.publicKey,
        recipient.publicKey,
      );

      // cap = 100 USD, $0.50 => token_cap = 200_000_000 (200 tokens)
      const oracleKey = injectMockPriceUpdate(BigInt(50_000_000), -8);

      await coreProgram.methods
        .mintTokens(new BN(200_000_000))
        .accountsPartial({
          minter: minter.publicKey,
          config: capMint.configPda,
          minterRole: minterRole,
          mint: capMint.mint.publicKey,
          to: ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          priceUpdate: oracleKey,
        })
        .signers([minter])
        .rpc();

      const config = await fetchConfig(coreProgram, capMint.configPda);
      expect(config.totalMinted.toNumber()).to.equal(200_000_000);

      const oracleKey2 = injectMockPriceUpdate(BigInt(50_000_000), -8);
      try {
        await coreProgram.methods
          .mintTokens(new BN(1))
          .accountsPartial({
            minter: minter.publicKey,
            config: capMint.configPda,
            minterRole: minterRole,
            mint: capMint.mint.publicKey,
            to: ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            priceUpdate: oracleKey2,
          })
          .signers([minter])
          .rpc();
        expect.fail("Should have thrown SupplyCapExceeded");
      } catch (err: any) {
        expect(err.toString()).to.include("SupplyCapExceeded");
      }
    });
  });

  describe("no supply cap with oracle", () => {
    it("ignores oracle when supply cap is None", async () => {
      const mint = await createSss1Mint(provider as any, coreProgram, {
        name: "No Cap USD",
        symbol: "NCUSD",
        uri: "https://example.com/ncusd.json",
        decimals: 6,
        supplyCap: null,
      });

      const minterRole = await grantRole(
        coreProgram,
        mint.configPda,
        mint.adminRolePda,
        minter.publicKey,
        ROLE_MINTER,
      );

      const ata = await createTokenAccount(
        provider as any,
        mint.mint.publicKey,
        recipient.publicKey,
      );

      const oracleKey = injectMockPriceUpdate(BigInt(100_000_000), -8);

      await coreProgram.methods
        .mintTokens(new BN(999_999_999))
        .accountsPartial({
          minter: minter.publicKey,
          config: mint.configPda,
          minterRole: minterRole,
          mint: mint.mint.publicKey,
          to: ata,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          priceUpdate: oracleKey,
        })
        .signers([minter])
        .rpc();

      const config = await fetchConfig(coreProgram, mint.configPda);
      expect(config.totalMinted.toNumber()).to.equal(999_999_999);
    });
  });

  describe("oracle staleness check", () => {
    it("rejects oracle with stale publish_time (> 120 seconds old)", async () => {
      const mint = await createSss1Mint(provider as any, coreProgram, {
        name: "Stale Oracle USD",
        symbol: "STUSD",
        uri: "https://example.com/stusd.json",
        decimals: 6,
        supplyCap: new BN(1_000),
      });

      const minterRole = await grantRole(
        coreProgram,
        mint.configPda,
        mint.adminRolePda,
        minter.publicKey,
        ROLE_MINTER,
      );

      const ata = await createTokenAccount(
        provider as any,
        mint.mint.publicKey,
        recipient.publicKey,
      );

      // Publish time 5 minutes ago — stale
      const staleTime = BigInt(Math.floor(Date.now() / 1000) - 300);
      const oracleKey = injectMockPriceUpdate(BigInt(100_000_000), -8, staleTime);

      try {
        await coreProgram.methods
          .mintTokens(new BN(1_000_000))
          .accountsPartial({
            minter: minter.publicKey,
            config: mint.configPda,
            minterRole: minterRole,
            mint: mint.mint.publicKey,
            to: ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            priceUpdate: oracleKey,
          })
          .signers([minter])
          .rpc();
        expect.fail("Should have thrown OraclePriceStale");
      } catch (err: any) {
        expect(err.toString()).to.include("OraclePriceStale");
      }
    });
  });

  describe("oracle with negative price", () => {
    it("rejects oracle with negative price", async () => {
      const mint = await createSss1Mint(provider as any, coreProgram, {
        name: "Neg Price USD",
        symbol: "NPUSD",
        uri: "https://example.com/npusd.json",
        decimals: 6,
        supplyCap: new BN(1_000),
      });

      const minterRole = await grantRole(
        coreProgram,
        mint.configPda,
        mint.adminRolePda,
        minter.publicKey,
        ROLE_MINTER,
      );

      const ata = await createTokenAccount(
        provider as any,
        mint.mint.publicKey,
        recipient.publicKey,
      );

      const oracleKey = injectMockPriceUpdate(BigInt(-100_000_000), -8);

      try {
        await coreProgram.methods
          .mintTokens(new BN(1_000_000))
          .accountsPartial({
            minter: minter.publicKey,
            config: mint.configPda,
            minterRole: minterRole,
            mint: mint.mint.publicKey,
            to: ata,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            priceUpdate: oracleKey,
          })
          .signers([minter])
          .rpc();
        expect.fail("Should have thrown InvalidOraclePrice");
      } catch (err: any) {
        expect(err.toString()).to.include("InvalidOraclePrice");
      }
    });
  });
});
