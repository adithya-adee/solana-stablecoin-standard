use anchor_lang::prelude::*;

pub const MAX_REASON_LEN: usize = 512;
pub const SSS_CORE_PROGRAM_ID: Pubkey = pubkey!("SSSCFmmtaU1oToJ9eMqzTtPbK9EAyoXdivUG4irBHVP");
pub const SSS_CONFIG_SEED: &[u8] = b"sss-config";
pub const SSS_ROLE_SEED: &[u8] = b"sss-role";
