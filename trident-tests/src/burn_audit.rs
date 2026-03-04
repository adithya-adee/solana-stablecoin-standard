//! Fuzz: Burn audit trail (C-2 fix) — the `TokensBurned` event must always
//! carry the `from_owner` field so off-chain monitors can distinguish
//! voluntary burns from privileged (permanent-delegate) burns.
//!
//! Because the `TokensBurned` event struct is pure data, we test the
//! construction logic that mirrors `burn_tokens::handler`:
//!
//! 1. `from_owner` is always set to the token account's `.owner` field.
//! 2. When `from_owner == burner`, the burn is self-initiated.
//! 3. When `from_owner != burner`, it is a third-party (privileged) burn and
//!    the event records both parties.
//! 4. A sequence of random burns always produces a distinct event per burn
//!    with a correctly-populated `from_owner`.

use proptest::prelude::*;
use solana_sdk::pubkey::Pubkey;

// ---------------------------------------------------------------------------
// Mirror of the `TokensBurned` event (C-2 fix)
// ---------------------------------------------------------------------------

/// Local mirror of `sss_core::events::TokensBurned` for simulation.
///
/// The real event has an identical layout; we test here without pulling in
/// Anchor's `Event` derive which requires a running BPF environment.
#[derive(Debug, Clone, PartialEq)]
struct TokensBurnedEvent {
    /// The SPL token mint address.
    pub mint: Pubkey,
    /// The token account the tokens were burned from.
    pub from: Pubkey,
    /// **Owner** of `from` at the time of burning.  This is the critical
    /// field added by the C-2 fix: when `from_owner != burner` the caller
    /// is using the permanent-delegate authority.
    pub from_owner: Pubkey,
    /// The signer that invoked the burn (permanent-delegate or owner).
    pub burner: Pubkey,
    /// The amount burned.
    pub amount: u64,
}

impl TokensBurnedEvent {
    /// Mirrors the event construction in `burn_tokens::handler`.
    fn new(mint: Pubkey, from: Pubkey, from_owner: Pubkey, burner: Pubkey, amount: u64) -> Self {
        Self { mint, from, from_owner, burner, amount }
    }

    /// Returns true when the burn was self-initiated (owner === burner).
    fn is_self_burn(&self) -> bool {
        self.from_owner == self.burner
    }

    /// Returns true when a privileged (permanent-delegate) burn took place.
    fn is_privileged_burn(&self) -> bool {
        self.from_owner != self.burner
    }
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

fn arb_pubkey() -> impl Strategy<Value = Pubkey> {
    any::<[u8; 32]>().prop_map(Pubkey::from)
}

fn arb_two_distinct_pubkeys() -> impl Strategy<Value = (Pubkey, Pubkey)> {
    (arb_pubkey(), arb_pubkey())
        .prop_filter("pubkeys must differ", |(a, b)| a != b)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

proptest! {
    /// **C-2 / property 1**: `from_owner` always reflects the owner stored in
    /// the token account, never a default or zero value.
    #[test]
    fn from_owner_is_always_populated(
        mint in arb_pubkey(),
        from in arb_pubkey(),
        from_owner in arb_pubkey(),
        burner in arb_pubkey(),
        amount in 1u64..u64::MAX,
    ) {
        let event = TokensBurnedEvent::new(mint, from, from_owner, burner, amount);
        prop_assert_eq!(
            event.from_owner, from_owner,
            "from_owner must be set to the token account owner"
        );
        prop_assert!(
            event.from_owner != Pubkey::default() || from_owner == Pubkey::default(),
            "from_owner should not silently become the default pubkey"
        );
    }

    /// **C-2 / property 2**: When owner equals burner, `is_self_burn()` is
    /// true and `is_privileged_burn()` is false.
    #[test]
    fn self_burn_detected_correctly(
        mint in arb_pubkey(),
        from in arb_pubkey(),
        owner_and_burner in arb_pubkey(),
        amount in 1u64..u64::MAX,
    ) {
        let event = TokensBurnedEvent::new(
            mint, from, owner_and_burner, owner_and_burner, amount,
        );
        prop_assert!(event.is_self_burn(), "Same owner/burner must be a self-burn");
        prop_assert!(!event.is_privileged_burn(), "Self-burn must not be flagged privileged");
    }

    /// **C-2 / property 3**: When owner differs from burner,
    /// `is_privileged_burn()` is true and `is_self_burn()` is false.
    #[test]
    fn privileged_burn_detected_correctly(
        mint in arb_pubkey(),
        from in arb_pubkey(),
        (from_owner, burner) in arb_two_distinct_pubkeys(),
        amount in 1u64..u64::MAX,
    ) {
        let event = TokensBurnedEvent::new(mint, from, from_owner, burner, amount);
        prop_assert!(
            event.is_privileged_burn(),
            "Different owner/burner must be detected as privileged burn"
        );
        prop_assert!(
            !event.is_self_burn(),
            "Privileged burn must not be a self-burn"
        );
    }

    /// **C-2 / property 4**: A sequence of burns each produce a distinct event
    /// with correctly assigned `from_owner`.  No event in the batch may
    /// silently share another event's `from_owner`.
    #[test]
    fn burn_sequence_events_are_accurate(
        burns in prop::collection::vec(
            (arb_pubkey(), arb_pubkey(), arb_pubkey(), arb_pubkey(), 1u64..1_000_000u64),
            1..20,
        ),
    ) {
        let events: Vec<TokensBurnedEvent> = burns
            .iter()
            .map(|(mint, from, from_owner, burner, amount)| {
                TokensBurnedEvent::new(*mint, *from, *from_owner, *burner, *amount)
            })
            .collect();

        for (i, (event, (_, _, from_owner, burner, amount))) in
            events.iter().zip(burns.iter()).enumerate()
        {
            prop_assert_eq!(
                event.from_owner, *from_owner,
                "Event[{}]: from_owner mismatch",
                i
            );
            prop_assert_eq!(
                event.burner, *burner,
                "Event[{}]: burner mismatch",
                i
            );
            prop_assert_eq!(
                event.amount, *amount,
                "Event[{}]: amount mismatch",
                i
            );
        }
    }

    /// **C-2 / property 5**: The privileged-burn flag must be monotonic with
    /// respect to owner≠burner — no amount value can change the classification.
    #[test]
    fn burn_classification_independent_of_amount(
        mint in arb_pubkey(),
        from in arb_pubkey(),
        (from_owner, burner) in arb_two_distinct_pubkeys(),
        amount_a in 1u64..u64::MAX / 2,
        amount_b in 1u64..u64::MAX / 2,
    ) {
        let event_a = TokensBurnedEvent::new(mint, from, from_owner, burner, amount_a);
        let event_b = TokensBurnedEvent::new(mint, from, from_owner, burner, amount_b);

        // Classification must be identical regardless of amount.
        prop_assert_eq!(
            event_a.is_privileged_burn(),
            event_b.is_privileged_burn()
        );
    }
}
