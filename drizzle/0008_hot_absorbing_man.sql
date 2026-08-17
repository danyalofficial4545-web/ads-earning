CREATE TABLE `authChallenges` (
	`id` varchar(64) NOT NULL,
	`purpose` enum('sign_in','sign_up') NOT NULL,
	`prompt` varchar(140) NOT NULL,
	`answerHash` varchar(64) NOT NULL,
	`deviceFingerprintHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authChallenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `appSettings` ADD `websiteName` varchar(80) DEFAULT 'Package Earn Pro' NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `themeName` enum('green','blue','dark','white') DEFAULT 'green' NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `logoUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `appSettings` ADD `logoKey` varchar(512);--> statement-breakpoint
ALTER TABLE `deposits` ADD `senderAccountNumber` varchar(256);--> statement-breakpoint
ALTER TABLE `deposits` ADD `senderAccountName` varchar(128);--> statement-breakpoint
ALTER TABLE `deposits` ADD `transactionId` varchar(128);--> statement-breakpoint
ALTER TABLE `deposits` ADD `requestedPackageId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `deviceFingerprintHash` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `registrationIpHash` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_device_fingerprint_unique` UNIQUE(`deviceFingerprintHash`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_registration_ip_unique` UNIQUE(`registrationIpHash`);--> statement-breakpoint
CREATE INDEX `auth_challenges_device_expiry_idx` ON `authChallenges` (`deviceFingerprintHash`,`expiresAt`);