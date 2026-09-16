ALTER TABLE `transactions`
  MODIFY COLUMN `id` int NOT NULL AUTO_INCREMENT,
  MODIFY COLUMN `type` varchar(50) NOT NULL,
  MODIFY COLUMN `referenceType` varchar(50) NULL,
  MODIFY COLUMN `referenceId` varchar(100) NULL;
