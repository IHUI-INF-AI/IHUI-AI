/**
 * E2E 测试用户 cleanup 脚本。
 *
 * 清理范围:
 * - username: 'e2e_admin' / 'e2e_user' (历史命名,向后兼容) / 'test_e2e' (当前 seed-test-users.ts 命名)
 * - email:   'test@ihui.ai' (seed-test-users.ts 当前 seed) / 'admin@ihui.ai' (历史残留测试 admin)
 * - phone:   短数字 / 19900000 前缀 / '13133287445' (历史测试数据)
 *
 * 与 seed-test-users.ts 的命名对应关系:
 * - apps/api/scripts/seed-test-users.ts 第 37 行 seed username='test_e2e' / email='test@ihui.ai'
 * - 本脚本必须能清掉 seed 创建的账号,否则 E2E 测试会因账号已存在而失败
 *
 * 保护机制(强制保留):
 * 1. is_system_admin=true 的用户永不删除(包括真实 admin 502319984@qq.com)
 * 2. SET LOCAL app.allow_cleanup='true' 启用清理开关
 * 3. 先删 refresh_tokens 避免 FK 约束
 * 4. 校验剩余用户数 + 打印保留的 system admin
 *
 * DRY_RUN 支持:
 * - DRY_RUN=1 时只打印待清理账号,不执行 DELETE
 * - 用法: DRY_RUN=1 node scripts/cleanup-test-users.mjs
 *
 * 用法:
 *   node scripts/cleanup-test-users.mjs              # 实际清理
 *   DRY_RUN=1 node scripts/cleanup-test-users.mjs    # 预览不删除
 */
import 'dotenv/config'
import postgres from 'postgres'

const DRY_RUN = process.env.DRY_RUN === '1'
const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })
try {
  // 启用清理开关
  await sql`SET LOCAL app.allow_cleanup = 'true'`

  // 先列出要清理的账号
  const targets = await sql`
    SELECT id, username, phone, email, is_system_admin
    FROM users
    WHERE username IN ('e2e_admin', 'e2e_user', 'test_e2e')
       OR email IN ('test@ihui.ai', 'admin@ihui.ai')
       OR phone ~ '^[0-9]{1,4}$'
       OR phone LIKE '19900000%'
       OR phone = '13133287445'
  `
  console.log(`[cleanup] 模式: ${DRY_RUN ? 'DRY_RUN (只打印不删除)' : '实际清理'}`)
  console.log('[cleanup] 即将清理', targets.length, '个测试账号:')
  for (const t of targets) console.log(' -', JSON.stringify(t))

  if (DRY_RUN) {
    console.log('[cleanup] DRY_RUN=1,跳过 DELETE')
  } else if (targets.length > 0) {
    // 清理(保留 system admin),先删 refresh_tokens 避免 FK 约束
    const ids = targets.map((t) => t.id)
    // 用 IN + 拼接 UUID 字符串,避免 sql.array() 类型推断
    const inList = ids.map((i) => `'${i}'`).join(',')
    await sql.unsafe(`DELETE FROM refresh_tokens WHERE user_id IN (${inList})`)
    const deleted = await sql`
      DELETE FROM users
      WHERE id <> ALL(SELECT id FROM users WHERE is_system_admin = true)
        AND (
          username IN ('e2e_admin', 'e2e_user', 'test_e2e')
          OR email IN ('test@ihui.ai', 'admin@ihui.ai')
          OR phone ~ '^[0-9]{1,4}$'
          OR phone LIKE '19900000%'
          OR phone = '13133287445'
        )
      RETURNING id
    `
    console.log('[cleanup] 实际删除', deleted.length, '条 users + 关联 refresh_tokens')
  }

  // 校验
  const remaining = await sql`SELECT count(*)::int AS c FROM users`
  console.log('[cleanup] 清理后总用户数:', remaining[0].c)
  const adminRow = await sql`SELECT username, email, phone, is_system_admin FROM users WHERE is_system_admin = true`
  console.log('[cleanup] 保留的 system admin:', JSON.stringify(adminRow[0], null, 2))
} catch (e) {
  console.error('[cleanup] ERR:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
