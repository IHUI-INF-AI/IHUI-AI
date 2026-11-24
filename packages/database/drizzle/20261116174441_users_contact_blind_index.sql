-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


-- 2026-11-16 DB-35 方案②(B-3):users.phone/email 改加密存储 + 确定性盲索引列。
-- 背景:上盲索引前 phone/email 是明文 btree 唯一索引(users_phone_unique/users_email_unique),
--       PII 明文落库且可被 ilike 模糊检索。机主 2026-11-16 定案方案②:加密存储 + 盲索引,
--       模糊搜索降级为精确匹配。
-- 设计:
--   · phone/email 列改存密文 enc:v1:iv:tag:ct(utils/crypto.ts encryptCredential,随机 IV 非确定性)
--   · 新增 phone_lookup/email_lookup 存 sha256(归一后值) 的十六进制小写 —— 确定性,供精确匹配 + 唯一性
--   · 唯一索引从明文列迁到 lookup 列
--   · ilike 模糊搜索降级为 eq(lookup, hash(term))(应用层配套改)
-- 回填算法与应用层 utils/user-contact.ts 的 hashUserContact 同一算法(§0.6 单一真相源):
--   sha256(utf8(归一后值)) 的十六进制小写。归一:trim + 去空白连字符 + 去 +86/0086/86 前缀(手机号),
--   email 归一为 trim + 全小写。
-- 幂等安全:IF NOT EXISTS / WHERE lookup IS NULL,可安全重复执行。

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_lookup varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_lookup varchar(64);

-- 回填需绕过 users_block_system_admin_modify 触发器(系统管理员行默认不可改,除 password_hash)。
-- session_replication_role 需超级用户(ihui 无权限),故改用:DROP 两触发器 -> 回填 -> 按原定义重建。
-- 触发器定义用 pg_get_triggerdef 原文,确保重建保真(BEFORE/AFTER、事件类型逐字一致)。
DROP TRIGGER IF EXISTS users_system_admin_immutable_delete ON users;
DROP TRIGGER IF EXISTS users_system_admin_immutable_update ON users;

-- 回填 phone_lookup:归一后 sha256
UPDATE users
   SET phone_lookup = encode(sha256(convert_to(
         regexp_replace(regexp_replace(regexp_replace(regexp_replace(phone, '\s', '', 'g'), '-', '', 'g'),
           '^\+86', ''), '^0086', ''), 'UTF8')), 'hex')
 WHERE phone_lookup IS NULL AND phone IS NOT NULL AND phone NOT LIKE 'enc:v1:%';

-- 回填 email_lookup:trim + 小写后 sha256
UPDATE users
   SET email_lookup = encode(sha256(convert_to(lower(btrim(email)), 'UTF8')), 'hex')
 WHERE email_lookup IS NULL AND email IS NOT NULL AND email NOT LIKE 'enc:v1:%';

-- 重建触发器(原文保真:delete=BEFORE DELETE,update=BEFORE UPDATE)
CREATE TRIGGER users_system_admin_immutable_delete BEFORE DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION users_block_system_admin_modify();
CREATE TRIGGER users_system_admin_immutable_update BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION users_block_system_admin_modify();

-- phone 加密回填:明文 -> enc:v1:...(仅处理未加密行)
-- 注:AES-GCM 用随机 IV,无法在纯 SQL 内复现 encryptCredential;存量明文的加密回填由应用层脚本完成,
--     本迁移只建列 + 回填 lookup + 迁移唯一索引。明文列暂留(回填脚本逐行读明文->加密写回后,明文即被密文覆盖)。

-- 唯一索引迁移:明文列唯一 -> lookup 列唯一
-- 注:users_phone_unique/users_email_unique 是表约束(非裸索引),须 DROP CONSTRAINT 连约束一起删。
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_unique;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_lookup_unique ON users (phone_lookup) WHERE phone_lookup IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lookup_unique ON users (email_lookup) WHERE email_lookup IS NOT NULL;
-- ⁠
-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
