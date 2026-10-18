-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- D-group 收口:把 compat 单数 group='notification' 的存量行一次性并入权威复数 group='notifications'
--
-- 起因(2026-10-18 收口单/复数分叉):apps/api/src/routes/miniapp-compat-routes.ts 的
-- /settings/notification(单数路径别名)把通知偏好写进 group='notification'(单数),而权威腿
-- apps/api/src/routes/user/settings-routes.ts(/settings/notifications)与本表 schema 词表都是
-- 复数 'notifications'。同一用户的同一份偏好因此被劈成两堆,读写互不可见。代码侧已统一到
-- 复数常量(见 db/user-preferences-queries.ts 的 USER_PREFERENCE_GROUPS);本迁移负责把历史存量行并进复数。
--
-- 冲突规则(必须写明理由):同 (user_id, key) 在两个 group 都有 ⇒ 取 updated_at 较新者胜,败方删除。
--   · 复数那份较新或时间戳持平 ⇒ 保留权威腿(复数)、删单数败方。取"较新者胜"是因为 updated_at 是
--     这条偏好最后一次被写入的时刻,较新的那份才反映用户最新意图;时间戳相等时默认信权威腿(复数),
--     因为单数是本次要淘汰的历史分叉形态,没有理由让它盖掉权威腿。
--   · 单数那份严格较新 ⇒ 删复数那份、把单数行改判为复数(用户的最新值不能丢)。
--   · 该 (user_id, key) 只有单数行 ⇒ 直接把 group 改成复数(无冲突)。
-- 表上 user_preferences_user_group_key_unique 保证同 (user_id, group, key) 至多一行,故每个 (user_id, key)
-- 的单数侧、复数侧各至多一行,上面的逐行裁决无歧义。
--
-- 幂等:跑完后不再有 group='notification' 的行,重跑时游标为空、计数全 0,不产生任何副作用。
-- 不许静默:三条计数(迁入 / 冲突 / 删除败方)以 RAISE NOTICE 现报。
DO $$
DECLARE
  v_migrated integer := 0;
  v_conflicts integer := 0;
  v_dropped integer := 0;
  r record;
  n record;
BEGIN
  FOR r IN
    SELECT id, user_id, key, updated_at
      FROM user_preferences
      WHERE "group" = 'notification'
      ORDER BY user_id, key, updated_at DESC
  LOOP
    SELECT id, updated_at INTO n
      FROM user_preferences
      WHERE user_id = r.user_id AND "group" = 'notifications' AND key = r.key
      LIMIT 1;

    IF FOUND THEN
      v_conflicts := v_conflicts + 1;
      IF r.updated_at > n.updated_at THEN
        -- 单数较新:删复数败方,把单数行改判复数(保住用户最新值)
        DELETE FROM user_preferences WHERE id = n.id;
        UPDATE user_preferences SET "group" = 'notifications' WHERE id = r.id;
        v_migrated := v_migrated + 1;
      ELSE
        -- 复数较新或持平:留权威腿,删单数败方
        DELETE FROM user_preferences WHERE id = r.id;
        v_dropped := v_dropped + 1;
      END IF;
    ELSE
      -- 无复数对照:整行并入复数
      UPDATE user_preferences SET "group" = 'notifications' WHERE id = r.id;
      v_migrated := v_migrated + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'notification->notifications: migrated=% conflicts=% dropped_loser=%',
    v_migrated, v_conflicts, v_dropped;
END $$;
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
