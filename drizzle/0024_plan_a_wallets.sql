ALTER TABLE `packages` ADD `priceCoins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` ADD `dailyTasks` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` ADD `dailyEarningCoins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` ADD `minWithdrawCoins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `deposit_wallet_balance` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `earning_wallet_balance` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `active_package_id` int;--> statement-breakpoint
ALTER TABLE `profiles` ADD `package_expiry_date` timestamp;--> statement-breakpoint
UPDATE `packages` SET `isActive` = false;--> statement-breakpoint
INSERT INTO `packages` (`tier`, `name`, `icon`, `pricePkr`, `priceCoins`, `dailyAds`, `adRewardPkr`, `dailyTasks`, `dailyEarningCoins`, `minWithdrawCoins`, `durationDays`, `isActive`)
VALUES
  ('free', 'FREE', '🆓', 0, 0, 1, 3, 1, 300, 50000, 0, true),
  ('pkr_200', 'Package 200', '🥈', 200, 20000, 2, 25, 2, 2500, 30000, 30, true),
  ('pkr_500', 'Package 500', '🥇', 500, 50000, 5, 70, 5, 7000, 60000, 30, true)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`), `icon` = VALUES(`icon`), `pricePkr` = VALUES(`pricePkr`),
  `priceCoins` = VALUES(`priceCoins`), `dailyAds` = VALUES(`dailyAds`), `adRewardPkr` = VALUES(`adRewardPkr`),
  `dailyTasks` = VALUES(`dailyTasks`), `dailyEarningCoins` = VALUES(`dailyEarningCoins`),
  `minWithdrawCoins` = VALUES(`minWithdrawCoins`), `durationDays` = VALUES(`durationDays`), `isActive` = VALUES(`isActive`);
