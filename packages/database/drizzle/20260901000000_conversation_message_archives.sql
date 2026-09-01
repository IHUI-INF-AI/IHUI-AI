-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- 20260901000000_conversation_message_archives.sql
-- 新增压缩归档表 conversation_message_archives(2026-09-01 立,"归档记忆"能力)。
--
-- 背景:自动上下文压缩此前是"黑箱有损"——压缩完成后 ai-chat-stream 调 replaceMessages
-- 原子性删除旧消息并写入压缩结果,被压掉的原始消息彻底消失,用户无法回看。
-- 本表把每次压缩被压掉的原始消息数组(jsonb)整体落库,压缩变成"透明可逆":
-- API 提供 GET /api/chat/conversations/:id/archives 系列端点,前端压缩状态条提供查看入口。
--
-- 设计要点:
-- 1. messages jsonb 存被压缩的原始消息数组,元素结构与 chat_messages 持久化结构一致
--    (role/content/reasoning/tokens/metadata/createdAt),前端按 role 轻量渲染即可。
-- 2. message_count / covered_chars 冗余统计列,列表接口免解析大 jsonb。
-- 3. conversation_id 级联删除(随会话一起清理),并建普通索引支撑按会话查询。
-- 4. 全程幂等(CREATE TABLE IF NOT EXISTS),重复执行安全;无数据迁移(新表从零积累)。

CREATE TABLE IF NOT EXISTS "conversation_message_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
	"messages" jsonb NOT NULL,
	"message_count" integer NOT NULL,
	"covered_chars" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- 按会话查询归档列表(列表接口只取 id/message_count/covered_chars/created_at,不取 messages)
CREATE INDEX IF NOT EXISTS "ix_conversation_message_archives_conversation"
	ON "conversation_message_archives" ("conversation_id");
