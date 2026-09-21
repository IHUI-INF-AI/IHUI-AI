-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- ============================================================================
-- 20260913120000_unify_model_names.sql
-- 模型名官方归一化(遗留项 1 彻底治理,2026-09-13 立):
--   背景:上游各来源(token6688/swiftapi/openrouter/seed 脚本)对同一模型使用
--   不同大小写写法(如 minimax-m3 与 MiniMax-M3 并存),导致:
--     1. 公开目录(/v1/models、/api/relay/models/public)同一模型出现两条;
--     2. 计费按 model_id 精确 eq 匹配,大小写不符时静默查不到 → 成本算 0(计费漏损);
--     3. 现有 unique (config_id, model_id) 大小写敏感,挡不住再犯。
--   动作:
--     A. ai_model_config_models 存量重复合并(每组只留一条,优先保留官方驼峰名行);
--     B. 三表 model 名归一:已知厂商家族 → 官方书写形式,其余 → 统一小写
--        (同源规则:packages/shared/src/constants/model-names.ts
--                   apps/ai-service/app/core/model_naming.py);
--     C. LOWER 表达式唯一索引,从数据库层面杜绝同组再出现两条。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. ai_model_config_models:大小写重复组合并(只留一条)
--    keeper 选择:官方驼峰名行优先 → updated_at 新者优先 → id 大者优先
-- ---------------------------------------------------------------------------
WITH grouped AS (
  SELECT config_id, LOWER(model_id) AS lkey
  FROM ai_model_config_models
  GROUP BY config_id, LOWER(model_id)
  HAVING COUNT(*) > 1
),
keeper AS (
  SELECT DISTINCT ON (m.config_id, LOWER(m.model_id))
         m.config_id, LOWER(m.model_id) AS lkey, m.id AS kid
  FROM ai_model_config_models m
  JOIN grouped g ON g.config_id = m.config_id AND g.lkey = LOWER(m.model_id)
  ORDER BY m.config_id, LOWER(m.model_id),
           (m.model_id <> LOWER(m.model_id)) DESC, m.updated_at DESC, m.id DESC
),
merged AS (
  SELECT kp.id AS kid,
         BOOL_OR(s.is_relay_public) AS any_public,
         MAX(s.relay_display_name) AS rdn
  FROM ai_model_config_models kp
  JOIN ai_model_config_models s
    ON s.config_id = kp.config_id
   AND LOWER(s.model_id) = LOWER(kp.model_id)
   AND s.id <> kp.id
  WHERE kp.id IN (SELECT kid FROM keeper)
  GROUP BY kp.id
)
UPDATE ai_model_config_models k
SET is_relay_public = k.is_relay_public OR s.any_public,
    relay_display_name = COALESCE(NULLIF(k.relay_display_name, ''), s.rdn),
    updated_at = now()
FROM merged s
WHERE k.id = s.kid;

-- 注意:CTE 作用域仅限单条语句,DELETE 必须自带完整 CTE,不可引用上一条 UPDATE 的 CTE
WITH grouped AS (
  SELECT config_id, LOWER(model_id) AS lkey
  FROM ai_model_config_models
  GROUP BY config_id, LOWER(model_id)
  HAVING COUNT(*) > 1
),
keeper AS (
  SELECT DISTINCT ON (m.config_id, LOWER(m.model_id))
         m.config_id, LOWER(m.model_id) AS lkey, m.id AS kid
  FROM ai_model_config_models m
  JOIN grouped g ON g.config_id = m.config_id AND g.lkey = LOWER(m.model_id)
  ORDER BY m.config_id, LOWER(m.model_id),
           (m.model_id <> LOWER(m.model_id)) DESC, m.updated_at DESC, m.id DESC
)
DELETE FROM ai_model_config_models m
USING keeper k
WHERE m.config_id = k.config_id
  AND LOWER(m.model_id) = k.lkey
  AND m.id <> k.kid;

-- ---------------------------------------------------------------------------
-- B1. ai_model_config_models:官方名归一
--     已知厂商家族 → 官方 API 文档书写形式;其余 → 统一小写
-- ---------------------------------------------------------------------------
UPDATE ai_model_config_models SET model_id = 'Auto-Model', updated_at = now()
WHERE LOWER(model_id) = 'auto-model' AND model_id <> 'Auto-Model';
UPDATE ai_model_config_models SET model_id = 'MiniMax-M1', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m1' AND model_id <> 'MiniMax-M1';
UPDATE ai_model_config_models SET model_id = 'MiniMax-M2', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2' AND model_id <> 'MiniMax-M2';
UPDATE ai_model_config_models SET model_id = 'MiniMax-M2-highspeed', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2-highspeed' AND model_id <> 'MiniMax-M2-highspeed';
UPDATE ai_model_config_models SET model_id = 'MiniMax-M2.5', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2.5' AND model_id <> 'MiniMax-M2.5';
UPDATE ai_model_config_models SET model_id = 'MiniMax-M2.5-highspeed', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2.5-highspeed' AND model_id <> 'MiniMax-M2.5-highspeed';
UPDATE ai_model_config_models SET model_id = 'MiniMax-M2.7', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2.7' AND model_id <> 'MiniMax-M2.7';
UPDATE ai_model_config_models SET model_id = 'MiniMax-M2.7-highspeed', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2.7-highspeed' AND model_id <> 'MiniMax-M2.7-highspeed';
UPDATE ai_model_config_models SET model_id = 'MiniMax-M3', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m3' AND model_id <> 'MiniMax-M3';
UPDATE ai_model_config_models SET model_id = 'MiniMax-M3-highspeed', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m3-highspeed' AND model_id <> 'MiniMax-M3-highspeed';
UPDATE ai_model_config_models SET model_id = 'MiniMax-Text-01', updated_at = now()
WHERE LOWER(model_id) = 'minimax-text-01' AND model_id <> 'MiniMax-Text-01';
UPDATE ai_model_config_models SET model_id = 'MiniMax-VL-01', updated_at = now()
WHERE LOWER(model_id) = 'minimax-vl-01' AND model_id <> 'MiniMax-VL-01';

UPDATE ai_model_config_models SET model_id = LOWER(model_id), updated_at = now()
WHERE model_id <> LOWER(model_id)
  AND LOWER(model_id) NOT IN (
    'auto-model',
    'minimax-m1', 'minimax-m2', 'minimax-m2-highspeed',
    'minimax-m2.5', 'minimax-m2.5-highspeed',
    'minimax-m2.7', 'minimax-m2.7-highspeed',
    'minimax-m3', 'minimax-m3-highspeed',
    'minimax-text-01', 'minimax-vl-01'
  );

-- ---------------------------------------------------------------------------
-- B2. ai_pricing:同步归一(计费按 model_id 精确匹配,键空间必须一致)
-- ---------------------------------------------------------------------------
UPDATE ai_pricing SET model_id = 'Auto-Model', updated_at = now()
WHERE LOWER(model_id) = 'auto-model' AND model_id <> 'Auto-Model';
UPDATE ai_pricing SET model_id = 'MiniMax-M1', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m1' AND model_id <> 'MiniMax-M1';
UPDATE ai_pricing SET model_id = 'MiniMax-M2', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2' AND model_id <> 'MiniMax-M2';
UPDATE ai_pricing SET model_id = 'MiniMax-M2-highspeed', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2-highspeed' AND model_id <> 'MiniMax-M2-highspeed';
UPDATE ai_pricing SET model_id = 'MiniMax-M2.5', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2.5' AND model_id <> 'MiniMax-M2.5';
UPDATE ai_pricing SET model_id = 'MiniMax-M2.5-highspeed', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2.5-highspeed' AND model_id <> 'MiniMax-M2.5-highspeed';
UPDATE ai_pricing SET model_id = 'MiniMax-M2.7', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2.7' AND model_id <> 'MiniMax-M2.7';
UPDATE ai_pricing SET model_id = 'MiniMax-M2.7-highspeed', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m2.7-highspeed' AND model_id <> 'MiniMax-M2.7-highspeed';
UPDATE ai_pricing SET model_id = 'MiniMax-M3', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m3' AND model_id <> 'MiniMax-M3';
UPDATE ai_pricing SET model_id = 'MiniMax-M3-highspeed', updated_at = now()
WHERE LOWER(model_id) = 'minimax-m3-highspeed' AND model_id <> 'MiniMax-M3-highspeed';
UPDATE ai_pricing SET model_id = 'MiniMax-Text-01', updated_at = now()
WHERE LOWER(model_id) = 'minimax-text-01' AND model_id <> 'MiniMax-Text-01';
UPDATE ai_pricing SET model_id = 'MiniMax-VL-01', updated_at = now()
WHERE LOWER(model_id) = 'minimax-vl-01' AND model_id <> 'MiniMax-VL-01';

UPDATE ai_pricing SET model_id = LOWER(model_id), updated_at = now()
WHERE model_id <> LOWER(model_id)
  AND LOWER(model_id) NOT IN (
    'auto-model',
    'minimax-m1', 'minimax-m2', 'minimax-m2-highspeed',
    'minimax-m2.5', 'minimax-m2.5-highspeed',
    'minimax-m2.7', 'minimax-m2.7-highspeed',
    'minimax-m3', 'minimax-m3-highspeed',
    'minimax-text-01', 'minimax-vl-01'
  );

-- ---------------------------------------------------------------------------
-- B3. ai_model_mappings:同步归一(source/target 与请求侧键空间一致)
--     先合并同作用域内仅大小写不同的 source_model 重复行
-- ---------------------------------------------------------------------------
WITH grouped AS (
  SELECT COALESCE(user_id::text, '') AS uid,
         COALESCE(api_key_id::text, '') AS aid,
         LOWER(source_model) AS lkey
  FROM ai_model_mappings
  GROUP BY 1, 2, 3
  HAVING COUNT(*) > 1
),
keeper AS (
  SELECT DISTINCT ON (COALESCE(m.user_id::text, ''), COALESCE(m.api_key_id::text, ''), LOWER(m.source_model))
         COALESCE(m.user_id::text, '') AS uid,
         COALESCE(m.api_key_id::text, '') AS aid,
         LOWER(m.source_model) AS lkey,
         m.id AS kid
  FROM ai_model_mappings m
  JOIN grouped g
    ON g.uid = COALESCE(m.user_id::text, '')
   AND g.aid = COALESCE(m.api_key_id::text, '')
   AND g.lkey = LOWER(m.source_model)
  ORDER BY COALESCE(m.user_id::text, ''), COALESCE(m.api_key_id::text, ''), LOWER(m.source_model),
           m.priority DESC, m.updated_at DESC, m.id DESC
)
DELETE FROM ai_model_mappings m
USING keeper k
WHERE COALESCE(m.user_id::text, '') = k.uid
  AND COALESCE(m.api_key_id::text, '') = k.aid
  AND LOWER(m.source_model) = k.lkey
  AND m.id <> k.kid;

UPDATE ai_model_mappings SET source_model = 'Auto-Model', updated_at = now()
WHERE LOWER(source_model) = 'auto-model' AND source_model <> 'Auto-Model';
UPDATE ai_model_mappings SET source_model = 'MiniMax-M1', updated_at = now()
WHERE LOWER(source_model) = 'minimax-m1' AND source_model <> 'MiniMax-M1';
UPDATE ai_model_mappings SET source_model = 'MiniMax-M2', updated_at = now()
WHERE LOWER(source_model) = 'minimax-m2' AND source_model <> 'MiniMax-M2';
UPDATE ai_model_mappings SET source_model = 'MiniMax-M2-highspeed', updated_at = now()
WHERE LOWER(source_model) = 'minimax-m2-highspeed' AND source_model <> 'MiniMax-M2-highspeed';
UPDATE ai_model_mappings SET source_model = 'MiniMax-M2.5', updated_at = now()
WHERE LOWER(source_model) = 'minimax-m2.5' AND source_model <> 'MiniMax-M2.5';
UPDATE ai_model_mappings SET source_model = 'MiniMax-M2.5-highspeed', updated_at = now()
WHERE LOWER(source_model) = 'minimax-m2.5-highspeed' AND source_model <> 'MiniMax-M2.5-highspeed';
UPDATE ai_model_mappings SET source_model = 'MiniMax-M2.7', updated_at = now()
WHERE LOWER(source_model) = 'minimax-m2.7' AND source_model <> 'MiniMax-M2.7';
UPDATE ai_model_mappings SET source_model = 'MiniMax-M2.7-highspeed', updated_at = now()
WHERE LOWER(source_model) = 'minimax-m2.7-highspeed' AND source_model <> 'MiniMax-M2.7-highspeed';
UPDATE ai_model_mappings SET source_model = 'MiniMax-M3', updated_at = now()
WHERE LOWER(source_model) = 'minimax-m3' AND source_model <> 'MiniMax-M3';
UPDATE ai_model_mappings SET source_model = 'MiniMax-M3-highspeed', updated_at = now()
WHERE LOWER(source_model) = 'minimax-m3-highspeed' AND source_model <> 'MiniMax-M3-highspeed';
UPDATE ai_model_mappings SET source_model = 'MiniMax-Text-01', updated_at = now()
WHERE LOWER(source_model) = 'minimax-text-01' AND source_model <> 'MiniMax-Text-01';
UPDATE ai_model_mappings SET source_model = 'MiniMax-VL-01', updated_at = now()
WHERE LOWER(source_model) = 'minimax-vl-01' AND source_model <> 'MiniMax-VL-01';

UPDATE ai_model_mappings SET source_model = LOWER(source_model), updated_at = now()
WHERE source_model <> LOWER(source_model)
  AND LOWER(source_model) NOT IN (
    'auto-model',
    'minimax-m1', 'minimax-m2', 'minimax-m2-highspeed',
    'minimax-m2.5', 'minimax-m2.5-highspeed',
    'minimax-m2.7', 'minimax-m2.7-highspeed',
    'minimax-m3', 'minimax-m3-highspeed',
    'minimax-text-01', 'minimax-vl-01'
  );

UPDATE ai_model_mappings SET target_model = 'Auto-Model', updated_at = now()
WHERE LOWER(target_model) = 'auto-model' AND target_model <> 'Auto-Model';
UPDATE ai_model_mappings SET target_model = 'MiniMax-M1', updated_at = now()
WHERE LOWER(target_model) = 'minimax-m1' AND target_model <> 'MiniMax-M1';
UPDATE ai_model_mappings SET target_model = 'MiniMax-M2', updated_at = now()
WHERE LOWER(target_model) = 'minimax-m2' AND target_model <> 'MiniMax-M2';
UPDATE ai_model_mappings SET target_model = 'MiniMax-M2-highspeed', updated_at = now()
WHERE LOWER(target_model) = 'minimax-m2-highspeed' AND target_model <> 'MiniMax-M2-highspeed';
UPDATE ai_model_mappings SET target_model = 'MiniMax-M2.5', updated_at = now()
WHERE LOWER(target_model) = 'minimax-m2.5' AND target_model <> 'MiniMax-M2.5';
UPDATE ai_model_mappings SET target_model = 'MiniMax-M2.5-highspeed', updated_at = now()
WHERE LOWER(target_model) = 'minimax-m2.5-highspeed' AND target_model <> 'MiniMax-M2.5-highspeed';
UPDATE ai_model_mappings SET target_model = 'MiniMax-M2.7', updated_at = now()
WHERE LOWER(target_model) = 'minimax-m2.7' AND target_model <> 'MiniMax-M2.7';
UPDATE ai_model_mappings SET target_model = 'MiniMax-M2.7-highspeed', updated_at = now()
WHERE LOWER(target_model) = 'minimax-m2.7-highspeed' AND target_model <> 'MiniMax-M2.7-highspeed';
UPDATE ai_model_mappings SET target_model = 'MiniMax-M3', updated_at = now()
WHERE LOWER(target_model) = 'minimax-m3' AND target_model <> 'MiniMax-M3';
UPDATE ai_model_mappings SET target_model = 'MiniMax-M3-highspeed', updated_at = now()
WHERE LOWER(target_model) = 'minimax-m3-highspeed' AND target_model <> 'MiniMax-M3-highspeed';
UPDATE ai_model_mappings SET target_model = 'MiniMax-Text-01', updated_at = now()
WHERE LOWER(target_model) = 'minimax-text-01' AND target_model <> 'MiniMax-Text-01';
UPDATE ai_model_mappings SET target_model = 'MiniMax-VL-01', updated_at = now()
WHERE LOWER(target_model) = 'minimax-vl-01' AND target_model <> 'MiniMax-VL-01';

UPDATE ai_model_mappings SET target_model = LOWER(target_model), updated_at = now()
WHERE target_model <> LOWER(target_model)
  AND LOWER(target_model) NOT IN (
    'auto-model',
    'minimax-m1', 'minimax-m2', 'minimax-m2-highspeed',
    'minimax-m2.5', 'minimax-m2.5-highspeed',
    'minimax-m2.7', 'minimax-m2.7-highspeed',
    'minimax-m3', 'minimax-m3-highspeed',
    'minimax-text-01', 'minimax-vl-01'
  );

-- ---------------------------------------------------------------------------
-- C. LOWER 表达式唯一索引:数据库层面杜绝同一模型出现两条(根治)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS ai_model_config_models_cid_model_lower_uniq
  ON ai_model_config_models (config_id, LOWER(model_id));

CREATE UNIQUE INDEX IF NOT EXISTS ai_model_mappings_scope_source_lower_uniq
  ON ai_model_mappings (
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(api_key_id, '00000000-0000-0000-0000-000000000000'::uuid),
    LOWER(source_model)
  );
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
