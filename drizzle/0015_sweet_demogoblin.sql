ALTER TABLE `profiles` ADD `whatsappRewardWithdrawn` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `withdrawals` ADD `walletType` varchar(64) DEFAULT 'Other' NOT NULL;