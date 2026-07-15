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
  await db.execute(sql`SET session_replication_role = 'replica'`)

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
  await db.execute(sql`SET session_replication_role = 'origin'`)
})
