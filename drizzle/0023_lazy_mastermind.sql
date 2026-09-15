ALTER TABLE `transactions`
  MODIFY COLUMN `type` varchar(50) NOT NULL;
--> statement-breakpoint
ALTER TABLE `transactions`
  MODIFY COLUMN `referenceType` varchar(50);
--> statement-breakpoint
ALTER TABLE `transactions`
  MODIFY COLUMN `referenceId` varchar(100);
