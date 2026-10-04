-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- ============================================================================
-- user_browse_history —— 浏览历史(member/history 页此前无表、无端点)
--
-- 背景:`/member/history` 页 GET/DELETE 打的 /api/history 两端点此前都不存在
-- (死按钮)。仓里带 history 的表全是别的东西:对话历史、搜索条件历史、发布历史、
-- 价格历史 —— 语义都不同,不可复用;visit_logs 是 URL/IP 埋点,也没有"目标 id"维度。
--
-- 口径说明(逐条都是刻意选择):
--   ① target_id 用 **varchar(128) 而不是 uuid**:target_type 的取值域是
--      project|file|doc|post,而这几类的对外标识**形态不统一** —— article/post/
--      course 走 uuid(news_articles.id 等),但 doc 走 **slug**
--      (docs.slug / help_articles.slug,feature-center 就是 eq(docs.slug, dbSlug)
--      这样查的)。用 uuid 列会把整个 doc 那一档挡在门外。128 覆盖
--      docs.slug varchar(128) 与 _shared.ts 的 idParamSchema .max(128) 上限。
--      同表结构照抄 resource_likes 的既有形态(resource_id 也是 varchar)。
--   ② target_type varchar(50) 不建 pg enum:与 resource_likes.resource_type 同理,
--      避免加枚举值要改类型 + 全表重写。
--   ③ 复合唯一 (user_id, target_id, target_type) ⇒ 同一用户对同一目标只留一行,
--      重复上报走 ON CONFLICT 改 visited_at,天然幂等(这是 visit 端点幂等的地基)。
--      顺序按 user_id 先行,让 user_id 单列索引与唯一索引都能用上左前缀。
--   ④ ON DELETE CASCADE:浏览历史是**从属数据**,账号注销不该留孤儿行
--      (与 resource_likes.user_id 同口径)。
--   ⑤ visited_at NOT NULL DEFAULT now():没有它就没法排序,而排序是这页唯一的价值。
--   ⑥ 全表幂等:CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS +
--      复合唯一用 CREATE UNIQUE INDEX IF NOT EXISTS(不用裸 UNIQUE 约束,
--      裸约束没有 IF NOT EXISTS,重跑会报 duplicate key)。
-- ============================================================================

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_browse_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"target_id" varchar(128) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"title" varchar(200),
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_browse_history_unique" ON "user_browse_history" USING btree ("user_id","target_id","target_type");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_browse_history_user_id_idx" ON "user_browse_history" USING btree ("user_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_browse_history_visited_at_idx" ON "user_browse_history" USING btree ("user_id","visited_at" DESC);
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
