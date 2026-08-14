CREATE TABLE `adSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userPackageId` int NOT NULL,
	`adId` int NOT NULL,
	`dayKey` varchar(10) NOT NULL,
	`startedAt` timestamp NOT NULL,
	`claimedAt` timestamp,
	`rewardPkr` int NOT NULL DEFAULT 20,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageTier` varchar(24) NOT NULL,
	`title` varchar(128) NOT NULL,
	`contentType` enum('text','image','video','link') NOT NULL DEFAULT 'text',
	`content` text NOT NULL,
	`targetUrl` varchar(1024),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appSettings` (
	`id` int NOT NULL,
	`exchangeRatePkrPerUsd` int NOT NULL DEFAULT 280,
	`minimumWithdrawalPkr` int NOT NULL DEFAULT 100,
	`maximumWithdrawalPkr` int NOT NULL DEFAULT 3000,
	`adTimerSeconds` int NOT NULL DEFAULT 30,
	`referralCommissionPercent` int NOT NULL DEFAULT 50,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `broadcasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(140) NOT NULL,
	`body` text NOT NULL,
	`mediaUrl` varchar(1024),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `broadcasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currency` enum('PKR','USD') NOT NULL,
	`amountPkr` int NOT NULL,
	`method` varchar(64) NOT NULL,
	`proofUrl` varchar(1024) NOT NULL,
	`proofKey` varchar(512) NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNote` varchar(512),
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deposits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tier` varchar(24) NOT NULL,
	`name` varchar(40) NOT NULL,
	`icon` varchar(12) NOT NULL,
	`pricePkr` int NOT NULL,
	`dailyAds` int NOT NULL,
	`durationDays` int NOT NULL DEFAULT 30,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `packages_tier_unique` UNIQUE(`tier`)
);
--> statement-breakpoint
CREATE TABLE `paymentAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`currency` enum('PKR','USD') NOT NULL,
	`provider` varchar(64) NOT NULL,
	`accountName` varchar(128) NOT NULL,
	`accountDetails` varchar(256) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentAccounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(32) NOT NULL,
	`referralCode` varchar(32) NOT NULL,
	`referredByUserId` int,
	`balancePkr` int NOT NULL DEFAULT 0,
	`withdrawalLimitPkr` int NOT NULL DEFAULT 0,
	`preferredCurrency` enum('PKR','USD') NOT NULL DEFAULT 'PKR',
	`isBlocked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `profiles_user_id_unique` UNIQUE(`userId`),
	CONSTRAINT `profiles_username_unique` UNIQUE(`username`),
	CONSTRAINT `profiles_referral_code_unique` UNIQUE(`referralCode`)
);
--> statement-breakpoint
CREATE TABLE `supportTickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subject` varchar(140) NOT NULL,
	`description` text NOT NULL,
	`screenshotUrl` varchar(1024),
	`screenshotKey` varchar(512),
	`status` enum('open','in_review','resolved') NOT NULL DEFAULT 'open',
	`adminResponse` text,
	`respondedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supportTickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','package','ad_reward','withdrawal','referral_limit','adjustment') NOT NULL,
	`direction` enum('credit','debit','neutral') NOT NULL,
	`amountPkr` int NOT NULL,
	`status` enum('pending','approved','rejected','completed') NOT NULL DEFAULT 'completed',
	`note` varchar(256) NOT NULL,
	`referenceType` varchar(64),
	`referenceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userPackages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`packageId` int NOT NULL,
	`purchasedAt` timestamp NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userPackages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `withdrawals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currency` enum('PKR','USD') NOT NULL,
	`amountPkr` int NOT NULL,
	`accountName` varchar(128) NOT NULL,
	`accountDetails` varchar(512) NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNote` varchar(512),
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `withdrawals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ad_sessions_user_day_idx` ON `adSessions` (`userId`,`dayKey`);--> statement-breakpoint
CREATE INDEX `ads_package_active_idx` ON `ads` (`packageTier`,`isActive`);--> statement-breakpoint
CREATE INDEX `deposits_user_status_idx` ON `deposits` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `tickets_user_status_idx` ON `supportTickets` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `transactions_user_created_idx` ON `transactions` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `user_packages_user_expiry_idx` ON `userPackages` (`userId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `withdrawals_user_status_idx` ON `withdrawals` (`userId`,`status`);