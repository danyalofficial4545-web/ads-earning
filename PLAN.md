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

## Euro compact UI and functional game suite

The expanded Euro experience uses a compact control strip rather than the existing large wallet panels. The Game Wallet and its add control sit at the upper left; Tasks, Exchange to Main, and Withdraw are compact upper-right controls. The page body is a two-column, four-row game-card grid. Every card routes to a full-screen game view, while navigation back to the grid preserves the separate Game Wallet context.

### Shared security model

Every monetary game action is server-authoritative. The browser can render a result only after receiving the round state from the server; it never selects outcomes, multipliers, bombs, or payouts. A generic `gameRounds` record stores each round’s game type, stake, private server state, visible progress, result multiplier, status, and settlement time. `gameWalletTransactions` records all debits/credits, and the existing package-price daily profit cap is applied to every payout.

The initial game set is Aviator, Slots, Mining/Mines, Ludo Dice, Wheel, Plinko, Color Prediction, and Lucky Number. The Crash card is a direct alternate entry to Aviator. Mining is the only multi-step round: bomb positions remain in server state and each selected tile is verified and revealed server-side. The remaining listed games resolve one server-generated outcome per bet.

### Task reward model

Euro Tasks use `gameTaskClaims` to prevent duplicate credits. The WhatsApp task is only claimable where the existing persisted channel-join state confirms the member has already joined. The Watch Ad task is only claimable after a verified ad reward exists for the current Pakistan day. A successful task claim credits the Game Wallet only, never the Main Wallet or withdrawal limit.

### Risk task: timed Aviator lifecycle

- **Why isolated:** Aviator has a preflight state, a live multiplier, a server-side crash boundary, a 3-second visible crash state, and a new round transition. A stale client query must not permit a late cash-out.
- **Approach:** Continue to store the server-selected multiplier and crash timestamp at round creation. The server settles active bets at or after crash time. The client displays the persisted crash value for three seconds, invalidates Euro state, and then starts a fresh ready state.
- **Verify:** A 1.10x–100x value is always selected from one non-overlapping weighted band; live cash-out is rejected after the persisted crash timestamp; crash copy remains visible for three seconds; the next round becomes bettable after reset.

### Risk task: multi-step Mining round

- **Why isolated:** The browser must never receive hidden bomb locations before selection, and each tile selection must be irreversible.
- **Approach:** Persist private bomb positions and revealed positions as server state. Each protected tile-selection mutation verifies the round, selection uniqueness, and stake; a safe tile increments the multiplier while a bomb settles the loss.
- **Verify:** Five distinct bombs are selected from the 5x5 grid, the client only receives revealed tile state, duplicate tiles are refused, safe cash-out credits the capped payout, and bomb selection produces no credit.

### Main build verification

- Compact top controls remain 28px high and do not overlap at desktop or 375px mobile widths.
- Exactly two game cards appear per row, with eight visible cards in the main grid and no card is a non-interactive placeholder.
- All random game outcomes and Game Wallet credits are created server-side with validated 16–20,000 PKR stakes.
- Task rewards require server-verified completion and cannot be claimed twice.
- Existing Main Wallet, package, withdrawal, referral, deposit, ads, and WhatsApp accounting continue unchanged.

## Verification criteria

- A user can open `/euro`, see a separate game wallet, and request a main-to-game transfer only when the actual main-wallet balance covers it.
- A user without an active package receives the exact game-to-main restriction message and cannot move game funds to the main wallet.
- A new eligible account receives the configured bonus exactly once on its first Euro visit; legacy accounts do not receive a new-user bonus.
- Aviator bets and cash-outs are server-authoritative, use only game-wallet funds, conform to the five non-overlapping crash bands, and obey daily profit/bet limits.
- Existing withdrawal, package, referral, and WhatsApp tests remain green.
