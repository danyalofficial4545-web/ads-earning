CREATE TABLE `referralRewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`depositId` int NOT NULL,
	`inviterId` int NOT NULL,
	`invitedUserId` int NOT NULL,
	`amountPkr` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referralRewards_id` PRIMARY KEY(`id`),
	CONSTRAINT `referralRewards_depositId_unique` UNIQUE(`depositId`)
);
