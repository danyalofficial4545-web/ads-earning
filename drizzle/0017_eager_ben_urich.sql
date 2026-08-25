CREATE TABLE `adminAdImpressions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dayKey` varchar(10) NOT NULL,
	`placement` varchar(32) NOT NULL,
	`sequence` int NOT NULL DEFAULT 0,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminAdImpressions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_ad_impressions_user_slot_unique` UNIQUE(`userId`,`dayKey`,`placement`,`sequence`)
);
--> statement-breakpoint
ALTER TABLE `appSettings` ADD `automaticAdsEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `admin_ad_impressions_day_idx` ON `adminAdImpressions` (`dayKey`,`completedAt`);