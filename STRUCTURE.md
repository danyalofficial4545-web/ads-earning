# Euro Games Architecture

## Persistence

`profiles` gains only game-wallet balance and one-time Euro-bonus eligibility/completion fields. Dedicated `gameWalletTransactions`, `aviatorRounds`, `aviatorBets`, `gameDailyStats`, and `gameTasks` tables isolate game activity from the main transaction and withdrawal records. `appSettings` owns safe administrator-configurable Euro defaults.

## Server contracts

The `euro` tRPC router exposes a bootstrap query, a first-visit bonus mutation, protected main-to-game and game-to-main exchange mutations, Aviator round/bet/cash-out mutations, and game history. The `admin` router exposes Euro settings and Euro-task management. All balance mutations re-read current database rows before writing and create an immutable ledger record.

## Client layout

`Home` retains the shared authenticated shell. A real `/euro` route maps to the same shell with the Euro workspace destination selected. The Euro page uses React for wallet cards, dialogs, history, and controls; the Aviator animation uses DOM/CSS in the first release because it is a 2D multiplier game rather than a free-roaming 3D canvas experience.

## Randomness and timing

The server uses cryptographically secure random selection for a weighted, non-overlapping crash band and stores the final crash multiplier before the round begins. Stored timestamps, not browser state, determine current multiplier and cash-out validity.

