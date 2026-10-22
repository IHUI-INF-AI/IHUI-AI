// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { beforeAll } from 'vitest'

/**
 * Real DB 测试全局 setup:
 * - beforeAll(全局): 确认 DB 连接可用 + 清理所有业务表数据
 *
 * 解决 21 个 real test 文件共享 users/lessons 等表导致的 ordering-dependent 失败。
 * 用 beforeAll(每文件开始前清理一次)代替 beforeEach(每测试前清理),
 * 避免每个测试都执行全表 TRUNCATE 带来的性能开销。
 *
 * 清理策略:
 * - SET session_replication_role = 'replica' 禁用 RLS + 触发器
 * - 拼接所有业务表名一次性 TRUNCATE ... CASCADE(比逐表循环快 10x+)
 * - users 表单独 DELETE WHERE is_system_admin = false(保留系统管理员)
 * - 恢复 session_replication_role = 'origin'
 */
beforeAll(async () => {
  // 确认 DB 连接可用
  await db.execute(sql`SELECT 1`)

  // 禁用 RLS + 触发器,允许 TRUNCATE 所有表
  // 2026-10-23 实测:这条 GUC 是超级用户专属,而本机 apps/api/.env 用的是库属主角色
  // (`ihui`,usesuper=false)⇒ 整个 *.real.test.ts 桶在标准入口 pnpm test:real 上 beforeAll 即崩
  // (42501 permission denied to set parameter),不是某一枚用例的问题。
  // 出路:取不到该权限时降级 —— TRUNCATE 本身不受 RLS 约束且 CASCADE 会跨 FK 传播,清理仍然发生;
  // 代价是 users 的 DELETE 会受 RLS 过滤,可能残留他人可见行 ⇒ 大声报名,不静默当已清干净。
  let replicaRoleOff = true
  try {
    await db.execute(sql`SET session_replication_role = 'replica'`)
  } catch (e) {
    replicaRoleOff = false
    console.warn(
      '[setup-real-db] 无权 SET session_replication_role(该角色非超级用户),降级为 CASCADE 直切;' +
        'users 的 DELETE 仍受 RLS 过滤,残留风险由这条日志背书:' +
        (e instanceof Error ? e.message : String(e)),
    )
  }

  // 一次性 TRUNCATE 所有业务表(拼接表名比逐表循环快 10x+)
  await db.execute(sql`
    DO $$
    DECLARE
      table_list text;
    BEGIN
      SELECT string_agg(quote_ident(tablename), ', ')
      INTO table_list
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename != 'schema_migrations'
        AND tablename != 'users';

      IF table_list IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || table_list || ' CASCADE';
      END IF;
    END $$;
  `)

  // users 表:删除非系统管理员用户
  await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)

  // 恢复 RLS + 触发器
  if (replicaRoleOff) await db.execute(sql`SET session_replication_role = 'origin'`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
