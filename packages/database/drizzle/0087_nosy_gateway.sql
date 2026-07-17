-- 0087: exam_papers 新增 cid_list(jsonb 数组,多分类)+ 补齐 learn_topic.is_show_index snapshot 对齐
-- cid_list: 分类 ID(UUID 字符串)数组,与 categoryId(单值)并存,向后兼容
-- learn_topic.is_show_index: 0086 为手动 migration 无 snapshot,此处幂等补齐
ALTER TABLE "exam_papers" ADD COLUMN IF NOT EXISTS "cid_list" jsonb;
ALTER TABLE "learn_topic" ADD COLUMN IF NOT EXISTS "is_show_index" boolean DEFAULT true NOT NULL;
