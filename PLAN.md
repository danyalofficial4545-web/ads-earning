# Euro Games Implementation Plan

## Scope of the first release

The first Euro Games release adds a separate authenticated `/euro` destination, a game-only wallet, two-way wallet exchanges, a one-time configurable first-visit bonus for newly eligible accounts, an administrator-controlled Aviator game, and Euro administration settings. The existing main wallet, package purchase, withdrawal limit, withdrawal, referral, deposit, advertising, and WhatsApp reward logic remain separate and unchanged.

## Risk slices

1. **Financial isolation.** Game-wallet debits, credits, bonus grants, and exchanges are committed server-side. Every change is recorded in a game-wallet ledger, while a corresponding main-wallet exchange is recorded without changing the existing withdrawal logic.
2. **Aviator authority.** The server selects the crash band and exact crash point; the browser only animates the active round. The server calculates cash-out eligibility and payout from its timestamp and stored round data.
3. **Limit enforcement.** The server rejects inactive games, bets below 16 PKR or above 20,000 PKR, insufficient game funds, an ineligible game-to-main exchange, and daily profit above three times the active package price.
4. **Navigation and mobile layout.** `/euro` renders through the existing authenticated workspace shell, appears in desktop and mobile navigation, and the main Profile wallet exposes the game-wallet exchange action.
5. **Administration.** Only the designated administrator can configure the bonus, Aviator limits and crash-band weights, enable the game, or manage Euro game tasks.

## Assigned visual asset

The Euro dashboard uses the **Euro Aviator reference** from `ASSETS.md` as its visual QA target and optional low-opacity panel texture. The Aviator curve, aircraft marker, wallet icons, and controls remain programmatic so their values, state, and accessibility remain precise.

## Verification criteria

- A user can open `/euro`, see a separate game wallet, and request a main-to-game transfer only when the actual main-wallet balance covers it.
- A user without an active package receives the exact game-to-main restriction message and cannot move game funds to the main wallet.
- A new eligible account receives the configured bonus exactly once on its first Euro visit; legacy accounts do not receive a new-user bonus.
- Aviator bets and cash-outs are server-authoritative, use only game-wallet funds, conform to the five non-overlapping crash bands, and obey daily profit/bet limits.
- Existing withdrawal, package, referral, and WhatsApp tests remain green.
