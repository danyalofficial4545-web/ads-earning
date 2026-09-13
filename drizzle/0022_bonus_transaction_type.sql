ALTER TABLE `transactions` MODIFY COLUMN `type` enum('deposit','package','ad_reward','withdrawal','referral_limit','adjustment','bonus') NOT NULL;
