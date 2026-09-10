-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- 20260910030000_create_knowledge_cards.sql
-- 新增 Knowledge Card 知识卡片表 knowledge_cards(2026-09-10 立,2-1 项目知识引擎)。
--
-- 背景:2-1 项目知识引擎的"Knowledge Card + 任务经验沉淀"——
-- Agent 执行任务(或用户手动)后,把可复用的经验提炼为结构化卡片落库,
-- 后续同仓库任务可检索注入(knowledge_lookup / 系统提示)形成经验复用闭环。
--
-- 设计要点:
-- 1. user_id 可空:NULL 表示全局卡片(登录用户均可见),与 repo_wiki_docs 口径一致。
-- 2. kind 区分卡片类型:'experience'(任务经验)/ 'fact'(领域事实)/ 'practices'(最佳实践)/ 'pitfall'(踩坑记录)。
-- 3. source 区分来源:'agent'(Agent 任务沉淀)/ 'manual'(用户手动录入)。
-- 4. use_count / last_used_at 复用统计:被检索命中并注入次数,评估卡片价值。
-- 5. 全程幂等(CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS),重复执行安全;无数据迁移。

CREATE TABLE IF NOT EXISTS "knowledge_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"repo_name" varchar(200) NOT NULL,
	"kind" varchar(20) DEFAULT 'experience' NOT NULL,
	"source" varchar(20) DEFAULT 'manual' NOT NULL,
	"title" varchar(300) NOT NULL,
	"content" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context" jsonb,
	"confidence" integer DEFAULT 100 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ix_knowledge_cards_user_repo" ON "knowledge_cards" ("user_id","repo_name");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ix_knowledge_cards_repo_kind" ON "knowledge_cards" ("repo_name","kind");
