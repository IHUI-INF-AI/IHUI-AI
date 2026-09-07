-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- 国家网信办「算法/模型备案」公开清单表(algorithm_record)。
-- 数据来源:网信办分批发布的官方 docx 清单(算法推荐 19 批 + 深度合成 18 批,2022-08 至 2026-07)。
-- 两套清单统一 8 列,record_no(备案编号) 作为全局去重主键。
CREATE TABLE IF NOT EXISTS "algorithm_record" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" varchar(32) NOT NULL,
  "alg_name" varchar(512) NOT NULL,
  "category" varchar(128),
  "provider" varchar(512) NOT NULL,
  "product" text,
  "purpose" text,
  "record_no" varchar(128) NOT NULL,
  "batch" varchar(32),
  "source_url" varchar(512),
  "row_no" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_algorithm_record_record_no" ON "algorithm_record" ("record_no");
CREATE INDEX IF NOT EXISTS "ix_algorithm_record_alg_name" ON "algorithm_record" ("alg_name");
CREATE INDEX IF NOT EXISTS "ix_algorithm_record_provider" ON "algorithm_record" ("provider");
CREATE INDEX IF NOT EXISTS "ix_algorithm_record_kind" ON "algorithm_record" ("kind");
CREATE INDEX IF NOT EXISTS "ix_algorithm_record_category" ON "algorithm_record" ("category");