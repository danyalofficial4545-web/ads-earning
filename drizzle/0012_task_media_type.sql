ALTER TABLE `tasks`
  ADD COLUMN `mediaType` varchar(32) NOT NULL DEFAULT 'image' AFTER `imageUrl`;
