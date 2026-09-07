CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(140) NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supportReplyRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(120) NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supportReplyRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `broadcasts` ADD `type` enum('info','warning') DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE `broadcasts` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `deposits` ADD `rejectionReason` varchar(512);--> statement-breakpoint
ALTER TABLE `withdrawals` ADD `rejectionReason` varchar(512);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`userId`,`isRead`,`createdAt`);