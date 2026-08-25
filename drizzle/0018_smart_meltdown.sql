ALTER TABLE `appSettings` MODIFY COLUMN `adTimerSeconds` int NOT NULL DEFAULT 5;--> statement-breakpoint
ALTER TABLE `packages` ADD `adRewardPkr` int DEFAULT 20 NOT NULL;