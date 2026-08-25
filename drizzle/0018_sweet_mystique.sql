CREATE TABLE `gameRounds` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`gameKey` enum('slots','mining','ludo','wheel','plinko','color','lucky') NOT NULL,
	`stakePkr` int NOT NULL,
	`selection` varchar(64),
	`privateState` mediumtext,
	`publicState` mediumtext,
	`multiplierX100` int NOT NULL DEFAULT 0,
	`payoutPkr` int NOT NULL DEFAULT 0,
	`status` enum('active','cashed_out','settled','lost') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`settledAt` timestamp,
	CONSTRAINT `gameRounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gameTaskClaims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskKey` varchar(64) NOT NULL,
	`dayKey` varchar(16) NOT NULL,
	`rewardPkr` int NOT NULL,
	`claimedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gameTaskClaims_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_task_claims_user_key_day_unique` UNIQUE(`userId`,`taskKey`,`dayKey`)
);
--> statement-breakpoint
ALTER TABLE `gameWalletTransactions` MODIFY COLUMN `type` enum('bonus','main_to_game','game_to_main','aviator_bet','aviator_payout','game_bet','game_payout','task_reward','admin_adjustment') NOT NULL;--> statement-breakpoint
CREATE INDEX `game_rounds_user_game_created_idx` ON `gameRounds` (`userId`,`gameKey`,`createdAt`);--> statement-breakpoint
CREATE INDEX `game_rounds_user_status_idx` ON `gameRounds` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `game_task_claims_user_claimed_idx` ON `gameTaskClaims` (`userId`,`claimedAt`);