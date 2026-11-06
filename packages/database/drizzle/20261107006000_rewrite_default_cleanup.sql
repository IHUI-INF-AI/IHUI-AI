-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- 补偿迁移(2026-11-07): 清算 21:05 批为放行重放而临时加的 DEFAULT,存量库撤掉遗留默认值
-- 证据: 0108/0126/20261018160000 在存量库按旧字节应用过(T9 hashDrift),旧版本把 DEFAULT '' / 0
--       写进了列定义;修复版文件已改为"回填后 DROP DEFAULT" / 空表重建不带默认,但存量库不会重跑,
--       故这里补一次幂等清理。幂等:列不存在跳过,列本来没有默认值也是 no-op。
DO $$
DECLARE
  targets text[][] := ARRAY[
    ['oauth_private_keys','client_id'],
    ['oauth_private_keys','private_key'],
    ['ai_world_categories','slug'],
    ['ai_world_items','kind'],
    ['ai_world_items','source'],
    ['agent_working_memory_compression','original_messages'],
    ['agent_working_memory_compression','compressed_to']
  ];
  t text[]; i int;
BEGIN
  FOR i IN 1 .. array_length(targets, 1) LOOP
    t := targets[i];
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t[1] AND column_name = t[2]
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', t[1], t[2]);
    END IF;
  END LOOP;
END $$;
