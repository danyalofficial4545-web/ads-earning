CREATE TABLE `referralTaskRewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerId` int NOT NULL,
	`referredId` int NOT NULL,
	`taskId` int,
	`rewardCoins` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referralTaskRewards_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_task_rewards_task_unique` UNIQUE(`referredId`,`taskId`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerId` int NOT NULL,
	`referredId` int NOT NULL,
	`totalTasksRewarded` int NOT NULL DEFAULT 0,
	`maxTaskReward` int NOT NULL DEFAULT 50,
	`totalTaskEarnings` int NOT NULL DEFAULT 0,
	`totalWithdrawCommission` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_referredId_unique` UNIQUE(`referredId`)
);
--> statement-breakpoint
CREATE INDEX `referral_task_rewards_referrer_idx` ON `referralTaskRewards` (`referrerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `referrals_referrer_idx` ON `referrals` (`referrerId`);