CREATE TABLE `ludoMatches` (
	`id` varchar(64) NOT NULL,
	`stakePkr` int NOT NULL,
	`playerOneId` int NOT NULL,
	`playerTwoId` int,
	`opponentType` enum('player','bot') NOT NULL,
	`status` enum('active','finished','forfeit') NOT NULL DEFAULT 'active',
	`currentTurnPlayerId` int,
	`turnExpiresAt` timestamp,
	`boardState` mediumtext NOT NULL,
	`winnerUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`finishedAt` timestamp,
	CONSTRAINT `ludoMatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ludoQueues` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`stakePkr` int NOT NULL,
	`status` enum('queued','matched','cancelled','expired','forfeit') NOT NULL DEFAULT 'queued',
	`matchId` varchar(64),
	`queuedAt` timestamp NOT NULL DEFAULT (now()),
	`matchedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ludoQueues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sharedGameBets` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`gameKey` enum('aviator','crash','color','lucky') NOT NULL,
	`roundKey` varchar(80) NOT NULL,
	`stakePkr` int NOT NULL,
	`selection` varchar(32),
	`cashOutMultiplierX100` int,
	`payoutPkr` int NOT NULL DEFAULT 0,
	`status` enum('active','cashed_out','won','lost','refunded') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`settledAt` timestamp,
	CONSTRAINT `sharedGameBets_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_game_bets_user_round_slot_unique` UNIQUE(`userId`,`roundKey`,`selection`)
);
--> statement-breakpoint
ALTER TABLE `gameWalletTransactions` MODIFY COLUMN `type` enum('bonus','main_to_game','game_to_main','aviator_bet','aviator_payout','game_bet','game_payout','task_reward','shared_bet','shared_payout','ludo_bet','ludo_payout','admin_adjustment') NOT NULL;--> statement-breakpoint
CREATE INDEX `ludo_matches_player_one_created_idx` ON `ludoMatches` (`playerOneId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ludo_matches_player_two_created_idx` ON `ludoMatches` (`playerTwoId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ludo_matches_status_updated_idx` ON `ludoMatches` (`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `ludo_queues_stake_status_queued_idx` ON `ludoQueues` (`stakePkr`,`status`,`queuedAt`);--> statement-breakpoint
CREATE INDEX `ludo_queues_user_status_idx` ON `ludoQueues` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `shared_game_bets_round_created_idx` ON `sharedGameBets` (`roundKey`,`createdAt`);--> statement-breakpoint
CREATE INDEX `shared_game_bets_user_created_idx` ON `sharedGameBets` (`userId`,`createdAt`);