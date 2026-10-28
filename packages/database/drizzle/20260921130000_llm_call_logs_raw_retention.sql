-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- O5 对外开放面治理(2026-09-21):llm_call_logs 原文留存策略落列。
--
-- 背景:
--   prompt / response 两列存的是**完整原文**(见 packages/database/src/schema/llm-call-logs.ts),
--   而平台对外口径是"只开放功能、不开放数据"。原文无限期留存既撑大表体积,也让"哪把 key
--   调了什么内容"具备可回溯的正文级证据 —— 与开放面的定位冲突。
--
-- 本次落三列(全部新增、全部向后兼容):
--   raw_retention_days  本行原文留存天数;NULL = 用全局默认(环境变量
--                       LLM_CALL_LOG_RAW_RETENTION_DAYS,默认 30);0 = 不留存原文。
--   raw_retained        原文当前是否仍在表内。存量行取 DEFAULT true → 旧数据照旧可读,
--                       读取方无需任何改动。
--   raw_purged_at       原文被清除的时间(NULL = 未清除),用于回答"这条记录的原文何时消失"。
--
-- 默认值取舍(30 天,而非 0):
--   0 天(完全不落原文)最"严格",但会把上游 4xx/5xx 的失败复现能力一起清零 ——
--   中转站的排障路径恰恰依赖看到那次真实请求正文。30 天与既有运维复盘窗口对齐,
--   同时把"永久留存"改成"有期限留存",已消除口径冲突的主因。
--   需要按 key 收紧时:写入口把 raw_retention_days 置 0,或把该 key 的 id 列入
--   LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS(清除器按 0 天处理)。
--
-- 未建索引:清除扫描 WHERE raw_retained = true AND created_at < cutoff 复用既有
--   llm_call_logs_created_at_idx;本表是高频写入的计费流水表,再加索引只换来写放大。
--
-- 幂等:IF NOT EXISTS(可重复执行,不锁已存在数据)。

ALTER TABLE "llm_call_logs" ADD COLUMN IF NOT EXISTS "raw_retention_days" integer;
ALTER TABLE "llm_call_logs" ADD COLUMN IF NOT EXISTS "raw_retained" boolean DEFAULT true NOT NULL;
ALTER TABLE "llm_call_logs" ADD COLUMN IF NOT EXISTS "raw_purged_at" timestamp with time zone;

COMMENT ON COLUMN "llm_call_logs"."raw_retention_days" IS
  '原文(prompt/response)留存天数;NULL=用全局默认(LLM_CALL_LOG_RAW_RETENTION_DAYS,默认 30);0=不留存原文';
COMMENT ON COLUMN "llm_call_logs"."raw_retained" IS
  '原文当前是否仍在表内;false 表示已被留存策略清除(raw_purged_at 记录清除时刻)';
COMMENT ON COLUMN "llm_call_logs"."raw_purged_at" IS
  '原文按留存策略被清除的时间;NULL=尚未清除';
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
