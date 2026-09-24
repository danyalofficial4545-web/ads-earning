CREATE TABLE `task_proofs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskId` int NOT NULL,
	`gameUserId` varchar(160) NOT NULL,
	`screenshotUrl` mediumtext NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`rejectReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `task_proofs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`imageUrl` mediumtext,
	`description` text NOT NULL,
	`rewardCoins` int NOT NULL,
	`hiddenProfit` int NOT NULL DEFAULT 0,
	`playstoreLink` varchar(1024) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timewall_postbacks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`coinsReceived` int NOT NULL,
	`coinsGivenToUser` int NOT NULL,
	`transactionId` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timewall_postbacks_id` PRIMARY KEY(`id`),
	CONSTRAINT `timewall_postbacks_transactionId_unique` UNIQUE(`transactionId`)
);
--> statement-breakpoint
CREATE INDEX `task_proofs_user_created_idx` ON `task_proofs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `task_proofs_status_created_idx` ON `task_proofs` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `tasks_active_created_idx` ON `tasks` (`isActive`,`createdAt`);--> statement-breakpoint
CREATE INDEX `timewall_postbacks_user_created_idx` ON `timewall_postbacks` (`userId`,`createdAt`);