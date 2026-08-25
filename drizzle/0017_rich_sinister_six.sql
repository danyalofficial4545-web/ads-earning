CREATE TABLE `aviatorBets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roundId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`stakePkr` int NOT NULL,
	`cashoutMultiplierX100` int,
	`payoutPkr` int NOT NULL DEFAULT 0,
	`status` enum('active','cashed_out','lost') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`settledAt` timestamp,
	CONSTRAINT `aviatorBets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aviatorRounds` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`crashMultiplierX100` int NOT NULL,
	`startsAt` timestamp NOT NULL,
	`crashesAt` timestamp NOT NULL,
	`status` enum('active','crashed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aviatorRounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gameDailyStats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dayKey` varchar(10) NOT NULL,
	`profitPkr` int NOT NULL DEFAULT 0,
	`lossPkr` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gameDailyStats_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_daily_stats_user_day_unique` UNIQUE(`userId`,`dayKey`)
);
--> statement-breakpoint
CREATE TABLE `gameTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(140) NOT NULL,
	`targetUrl` varchar(1024) NOT NULL,
	`imageData` mediumtext,
	`rewardPkr` int NOT NULL DEFAULT 20,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gameTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gameWalletTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('bonus','main_to_game','game_to_main','aviator_bet','aviator_payout','admin_adjustment') NOT NULL,
	`direction` enum('credit','debit') NOT NULL,
	`amountPkr` int NOT NULL,
	`note` varchar(256) NOT NULL,
	`referenceType` varchar(64),
	`referenceId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gameWalletTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `appSettings` ADD `euroBonusPkr` int DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `euroAviatorEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `euroMinimumBetPkr` int DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `euroMaximumBetPkr` int DEFAULT 20000 NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `euroCrashBandWeights` varchar(64) DEFAULT '50,30,10,5,5' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `gameBalancePkr` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `euroBonusEligible` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `euroBonusClaimed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `aviator_bets_user_created_idx` ON `aviatorBets` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `aviator_bets_round_idx` ON `aviatorBets` (`roundId`);--> statement-breakpoint
CREATE INDEX `aviator_rounds_user_status_idx` ON `aviatorRounds` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `game_wallet_transactions_user_created_idx` ON `gameWalletTransactions` (`userId`,`createdAt`);