-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 桌面端偏好跨设备漫游(2026-09-28 立):一行一人的 desktop_prefs。
--
-- 记账:journal idx **295**,tag `20260928120000_desktop_prefs`,when 1790568000000。
--
-- 这份 SQL 由仓库自己的生成命令(drizzle-kit)产出,不是手写:
--   直接跑 `pnpm --filter @ihui/database db:generate` 出不来差分 —— meta/ 里只有 64 份快照
--   而 journal 已有 294 条,drizzle-kit 拿最后一份快照(0227)去比全量 schema,
--   会同时看到 59 张"新建"与 123 张"已删",在 promptNamedWithSchemasConflict 处要交互改名
--   (非 TTY 直接崩),即便答完也会把 65 号之后所有人补的表整批重列(含 DROP TABLE)。
--   本仓近几枚迁移(team_knowledge_engine / github_app_tables / point_transactions_...)
--   都是同一处境,登记理由见 20260926120000_team_knowledge_engine.sql 头注。
--   做法 = 两趟 generate,让 drizzle-kit 只看见本表:
--     第 1 趟 schema = HEAD 那份 src/schema/index.ts 的 re-export 清单(不含 desktop-prefs)
--     第 2 趟 schema = 当前工作树那份(含 desktop-prefs),两趟共用同一个临时 out 目录
--     命令:node ./node_modules/drizzle-kit/bin.cjs generate --config ./.tmp-mig/<x>.config.ts
--   第 2 趟产出的 0001_desktop_prefs.sql 就是下面这一段(逐字取回,未做任何语义改写);
--   临时目录与临时 out 跑完即删,不进版本库。
--
-- 列的取舍见 packages/database/src/schema/desktop-prefs.ts;prefs 的形状唯一真相源在
-- packages/types/src/desktop-prefs.ts —— 服务端只搬运 jsonb、不解释其语义。
--
-- 本机验证边界:PG 端口 8810 实测未在跑(开发机无服务监听),所以本文件**未**在库上重放;
-- 一致性靠 schema ↔ SQL 同形 + `node scripts/check-migration-bookkeeping.mjs` 的
-- B1-B5 离线判据兜底,不得把"文件已入库"读成"迁移已验证"。

CREATE TABLE "desktop_prefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"prefs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "desktop_prefs_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "desktop_prefs" ADD CONSTRAINT "desktop_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
