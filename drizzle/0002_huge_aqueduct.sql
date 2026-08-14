ALTER TABLE `adSessions` ADD `lastHeartbeatAt` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `adSessions` ADD `invalidatedAt` timestamp;