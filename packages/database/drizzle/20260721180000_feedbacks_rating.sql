-- feedbacks.rating 字段补建 (2026-07-21, 架构迁移完整性 P0 收尾)
-- 用途:补建架构迁移审计遗漏的 feedbacks.rating 字段
-- 来源:packages/database/src/schema/comments.ts L79 (rating: integer('rating').default(0).notNull())
-- 业务:用户对反馈处理结果的评价 (0=未评价, 1-5=评分等级)
-- 关联 API:POST /api/comments/feedbacks/:id/rate (apps/api/src/routes/comments.ts)

ALTER TABLE "feedbacks"
  ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN "feedbacks"."rating" IS '用户对反馈处理结果的评价(0=未评价,1-5=评分等级)';
