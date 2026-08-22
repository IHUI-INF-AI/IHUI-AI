-- feedbacks.file_path 字段补建 (2026-08-22, 反馈问题截图持久化,对齐 Uniapp fankui filePaths)
ALTER TABLE "feedbacks"
  ADD COLUMN IF NOT EXISTS "file_path" text;
