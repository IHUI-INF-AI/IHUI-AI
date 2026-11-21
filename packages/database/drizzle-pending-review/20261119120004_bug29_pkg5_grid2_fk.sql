-- BUG-29 入链准备 包 5/5:补格2 唯一真缺 FK —— hr_employee_link_request.user_id。
-- 来源:本机 dev 库现态核查(scripts/data/BUG29-grid24-prodcheck-20261120.md):
--   格2 notNull 14 处中 13 处本机库已建 FK;唯一仍无 FK 者为本表 user_id。
--   该列实测 uuid、is_nullable=NO、表当前 0 行(悬空 0,可安全加)。
-- schema 期望(hr-ai-management.ts:202):userId notNull references users.id onDelete=cascade。
--   此处按 schema 用 cascade 删除语义(与包3 统一 NO ACTION 不同,因 schema 显式声明 cascade)。
-- 执行通道:与包3 同,**事务外 psql** 逐件跑;不进 journal。
-- 幂等:IF NOT EXISTS(pg_constraint 守卫)+ EXCEPTION 吞错,可重复执行。只补齐,不删不改数据。
-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_hr_employee_link_request_user_id_users') THEN
    ALTER TABLE "hr_employee_link_request" ADD CONSTRAINT "fk_hr_employee_link_request_user_id_users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- 包5 实际生成 FK 语句数: 1
