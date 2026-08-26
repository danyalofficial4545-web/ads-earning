CREATE TABLE `supportChatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant','admin') NOT NULL,
	`content` text NOT NULL,
	`aiGenerated` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supportChatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `support_chat_user_created_idx` ON `supportChatMessages` (`userId`,`createdAt`);