import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { createReadWriteDb, withTenant, withBypassRls, DEFAULT_TENANT_ID } from '@ihui/database'
import { closeTestDb } from './helpers/test-db'

/**
 * RLS 行级安全 — 真实 DB 集成测试
 *
 * 验证目标(0066 migration):
 * - 启用 RLS 后,不同 tenant_id 的数据互相不可见
 * - INSERT tenant_id 与当前 session 不一致时被 RLS 拒绝
 * - app.bypass_rls = 'true' 可绕过 RLS(系统/迁移任务用)
 * - 未设置 app.tenant_id 时查询默认拒绝(返回 0 行)
 *
 * 连接说明:
 * - 默认 .env.test 用 postgres 超级用户(rolbypassrls=true,直接绕过 RLS)
 * - 本测试用专用非超级用户 rls_test_user(NOSUPERUSER + NOBYPASSRLS)连接
 *   这样 RLS 策略才会真实生效,可验证隔离行为
 * - rls_test_user 角色由 scripts/create-rls-test-role.mjs 预置
 */

// 用非超级用户连接的 DB(RLS 会真正生效)
const RLS_TEST_URL =
  process.env.RLS_TEST_DATABASE_URL ??
  'postgresql://rls_test_user:rls_test_pwd@localhost:5432/ihui_test'

const { dbWriter: rlsDb, writerClient: rlsClient } = createReadWriteDb({
  url: RLS_TEST_URL,
  max: 5,
})

async function closeRlsDb(): Promise<void> {
  await rlsClient.end()
}

describe('rls-isolation — RLS 行级安全真实 DB 集成测试', () => {
  // 两个非默认租户 UUID,用于验证跨租户隔离
  const TENANT_A = '11111111-1111-1111-1111-111111111111'
  const TENANT_B = '22222222-2222-2222-2222-222222222222'

  beforeEach(async () => {
    // RLS 已启用,必须用 withBypassRls 才能跨租户清理
    //
    // 已知细节(与 RLS 0066 策略设计相关):
    // - 策略 USING 表达式含 `current_setting('app.tenant_id', true)::uuid`
    // - 上一次事务 SET LOCAL 后,连接回到池里时该 setting 被还原为 ''(空串,非 NULL)
    // - 即使 bypass_rls=true 短路了 OR 第一支,PostgreSQL 仍会评估第二支的 cast
    //   `''::uuid` 会抛 "invalid input syntax for type uuid"
    // - 因此 withBypassRls 前必须确保 session 级 tenant_id 是合法 UUID(默认租户即可)
    await rlsDb.execute(`SET app.tenant_id = '${DEFAULT_TENANT_ID}'`)
    await withBypassRls(rlsDb, 'test-cleanup', async (tx) => {
      await tx.execute(`DELETE FROM users WHERE phone LIKE 'rls-%'`)
    })
  })

  afterAll(async () => {
    await withBypassRls(rlsDb, 'test-cleanup', async (tx) => {
      await tx.execute(sql`DELETE FROM users WHERE phone LIKE 'rls-%'`)
    })
    await closeRlsDb()
    await closeTestDb()
  })

  // 辅助:在指定 tenant 上下文中插入用户(raw SQL,显式 tenant_id)
  async function insertUserAsTenant(tenantId: string, phone: string, nickname: string) {
    return withTenant(rlsDb, tenantId, async (tx) => {
      return tx.execute(
        sql`INSERT INTO users (phone, nickname, tenant_id) VALUES (${phone}, ${nickname}, ${tenantId}::uuid) RETURNING id, phone, tenant_id::text AS tenant_id`,
      ) as unknown as Array<{ id: string; phone: string; tenant_id: string }>
    })
  }

  // =====================================================================
  // 测试 1:同一表,A tenant 创建用户,B tenant 看不到(SELECT 返回 0 行)
  // =====================================================================

  it('测试 1 — tenant A 写入后,tenant B 的 SELECT 返回 0 行', async () => {
    // 1) 切换到 tenant A,插入一个用户
    const inserted = await insertUserAsTenant(TENANT_A, 'rls-0001-A', 'A的用户')
    expect(inserted).toHaveLength(1)
    const userId = inserted[0]!.id
    expect(inserted[0]!.tenant_id).toBe(TENANT_A)

    // 2) tenant A 视角:能看见自己刚插入的数据
    const seenByA = await withTenant(rlsDb, TENANT_A, async (tx) => {
      return tx.execute(sql`SELECT id::text AS id FROM users WHERE phone = 'rls-0001-A'`)
    }) as unknown as Array<{ id: string }>
    expect(seenByA).toHaveLength(1)
    expect(seenByA[0]!.id).toBe(userId)

    // 3) tenant B 视角:看不到 A 的数据(SELECT 返回 0 行)
    const seenByB = await withTenant(rlsDb, TENANT_B, async (tx) => {
      return tx.execute(sql`SELECT id::text AS id FROM users WHERE phone = 'rls-0001-A'`)
    }) as unknown as Array<{ id: string }>
    expect(seenByB).toHaveLength(0)
  })

  // =====================================================================
  // 测试 2:同一表,A tenant 尝试 INSERT tenant_id=B 的数据,被 RLS 拒绝
  // =====================================================================

  it('测试 2 — tenant A 尝试 INSERT tenant_id=B 的数据,被 RLS WITH CHECK 拒绝', async () => {
    // 在 tenant A 上下文中,显式插入 tenant_id = B 的数据
    // WITH CHECK: tenant_id = current_setting('app.tenant_id', true)::uuid
    // A 上下文 + tenant_id = B → 不匹配 → INSERT 违反 policy
    await expect(
      withTenant(rlsDb, TENANT_A, async (tx) => {
        return tx.execute(
          sql`INSERT INTO users (phone, nickname, tenant_id) VALUES (${'rls-0002-X'}, ${'越权插入'}, ${TENANT_B}::uuid)`,
        )
      }),
    ).rejects.toThrow(/row-level security|policy|violates|行级安全/i)
  })

  // =====================================================================
  // 测试 3:使用 app.bypass_rls = 'true' 可以访问所有数据
  // =====================================================================

  it('测试 3 — withBypassRls 绕过 RLS,可见所有租户的数据', async () => {
    // 1) 在 tenant A 插入
    await insertUserAsTenant(TENANT_A, 'rls-0003-A', 'A')
    // 2) 在 tenant B 插入
    await insertUserAsTenant(TENANT_B, 'rls-0003-B', 'B')

    // 3) 用 withBypassRls:应同时看到 A 和 B 的两行
    const all = await withBypassRls(rlsDb, 'test-cleanup', async (tx) => {
      return tx.execute(
        sql`SELECT phone, tenant_id::text AS t FROM users WHERE phone LIKE 'rls-0003-%' ORDER BY phone`,
      )
    }) as unknown as Array<{ phone: string; t: string }>
    expect(all).toHaveLength(2)
    expect(all[0]!.phone).toBe('rls-0003-A')
    expect(all[0]!.t).toBe(TENANT_A)
    expect(all[1]!.phone).toBe('rls-0003-B')
    expect(all[1]!.t).toBe(TENANT_B)

    // 4) 同一 DB 实例上,无 tenant context 的 raw query 应被 RLS 拒
    //    rls_test_user 是 NOSUPERUSER + NOBYPASSRLS,无 tenant context 时 RLS 拒绝
    const rawQuery = await rlsDb.execute(
      sql`SELECT count(*)::int AS n FROM users WHERE phone LIKE 'rls-0003-%'`,
    ) as unknown as Array<{ n: number }>
    expect(rawQuery[0]!.n).toBe(0)
  })

  // =====================================================================
  // 测试 4:不设置 tenant_id 时查询返回 0 行(默认拒绝)
  // =====================================================================

  /**
   * 测试 4 — 不设置/不匹配 tenant_id 时,SELECT 默认拒绝(返回 0 行)
   *
   * 0066 旧版:策略 USING 含 `''::uuid` cast → 抛 "invalid input syntax" 错误
   * 0068 新版:策略 USING 含 current_setting('app.current_user_id', true)
   *           未设置时 = '' → 不匹配任何 row.id::text → 返回 0 行(软拒绝)
   * 当前 DB 已切到 0068,所以期望是 0 行(而非 reject)。
   */
  it('测试 4 — 不设置/不匹配 tenant_id 时,SELECT 默认拒绝(返回 0 行)', async () => {
    // 1) 先用 bypass 模式塞一条 DEFAULT_TENANT_ID 的数据(模拟遗留单租户数据)
    await withBypassRls(rlsDb, 'test-cleanup', async (tx) => {
      await tx.execute(
        sql`INSERT INTO users (phone, nickname, tenant_id) VALUES (${'rls-0004-default'}, ${'默认租户'}, ${DEFAULT_TENANT_ID}::uuid)`,
      )
    })

    // 2) 显式设 app.tenant_id 为不匹配的 UUID → 0 行(RLS 隔离生效)
    const mismatchRows = await withTenant(rlsDb, TENANT_A, async (tx) => {
      return tx.execute(
        sql`SELECT count(*)::int AS n FROM users WHERE phone = 'rls-0004-default'`,
      )
    }) as unknown as Array<{ n: number }>
    expect(mismatchRows[0]!.n).toBe(0)

    // 3) 显式设 app.tenant_id = DEFAULT_TENANT_ID → 看到 1 行
    const matchRows = await withTenant(rlsDb, DEFAULT_TENANT_ID, async (tx) => {
      return tx.execute(
        sql`SELECT count(*)::int AS n FROM users WHERE phone = 'rls-0004-default'`,
      )
    }) as unknown as Array<{ n: number }>
    expect(matchRows[0]!.n).toBe(1)

    // 4) 在事务内显式把 app.tenant_id 设为空串 → 0068 软拒绝:返回 0 行(不抛错)
    //    注:0066 旧版会因 ''::uuid cast 失败而 reject,本测试已切到 0068 语义
    const emptyRows = await rlsDb.transaction(async (tx) => {
      await tx.execute(`SET LOCAL app.tenant_id = ''`)
      return tx.execute(
        sql`SELECT count(*)::int AS n FROM users WHERE phone = 'rls-0004-default'`,
      )
    }) as unknown as Array<{ n: number }>
    expect(emptyRows[0]!.n).toBe(0)
  })
})
