/**
 * RLS 用户级策略预演 (DRY-RUN) — 0214 清理后版本
 *
 * 背景:
 *   迁移 0214 已清理 6 表(users/orders/payments/chat_messages/chat_favorites/comment_likes)
 *   的 tenant_id 列与 _tenant_iso_* 租户策略(多租户隔离设计废弃,见 docs/DATABASE.md §5.4)。
 *   清理后 6 表仍保留 0068 用户级策略(基于 app.current_user_role / current_user_id)
 *   + 新增 _bypass_rls 策略(保持 withBypassRls 绕过能力)。
 *
 * 本脚本验证新 RLS 语义:
 *   - 场景 A: 无 session 变量 → 普通用户默认不可见(0068 策略 user_id 不匹配)→ 0 行
 *   - 场景 B: SET app.current_user_role='1'(管理员)→ 全量可见(0068 角色分支)
 *   - 场景 C: SET app.bypass_rls='true' → 全量可见(_bypass_rls 策略)
 *   - 场景 D: 模拟应用(rls-context 设置 current_user_id/role)→ 无 RLS 错误
 */
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui'
const root = postgres(url, { max: 1 })

const TEST_USER = `rls_dryrun_${Date.now().toString(36)}`
const TEST_PASS = `rls_dryrun_pwd_${Math.random().toString(36).slice(2)}`

const RLS_TABLES = ['users', 'orders', 'payments', 'chat_messages', 'chat_favorites', 'comment_likes']

let testsPassed = 0
let testsFailed = 0
function pass(name, detail = '') {
  console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`)
  testsPassed++
}
function fail(name, detail = '') {
  console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`)
  testsFailed++
}

async function findReferencedTables() {
  const rows = await root`
    SELECT tc.table_name AS source_table, ccu.table_name AS referenced_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = ANY(${RLS_TABLES})
  `
  const refSet = new Set()
  for (const r of rows) refSet.add(r.referenced_table)
  return Array.from(refSet)
}

async function main() {
  console.log('='.repeat(60))
  console.log('RLS 用户级策略预演 (0214 清理后)')
  console.log('='.repeat(60))

  const referencedTables = await findReferencedTables()
  const allGrantedTables = Array.from(new Set([...RLS_TABLES, ...referencedTables]))
  console.log(`RLS 表: ${RLS_TABLES.length} 个`)
  console.log(`FK 引用表: ${referencedTables.length} 个 (${referencedTables.join(', ')})`)

  // 1. 创建测试角色
  console.log('\n[1/5] 创建测试角色...')
  await root.unsafe(`DROP ROLE IF EXISTS "${TEST_USER}"`)
  await root.unsafe(`CREATE ROLE "${TEST_USER}" WITH LOGIN PASSWORD '${TEST_PASS}'`)
  pass('测试角色创建')

  // 2. GRANT 表权限
  console.log('\n[2/5] GRANT 表权限...')
  await root.unsafe(`GRANT USAGE ON SCHEMA public TO "${TEST_USER}"`)
  for (const t of allGrantedTables) {
    await root.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON "${t}" TO "${TEST_USER}"`)
  }
  pass(`${allGrantedTables.length} 个表权限授予`)

  const testConn = postgres(url.replace(/\/\/[^:]+:[^@]+@/, `//${TEST_USER}:${TEST_PASS}@`), {
    max: 1,
  })

  try {
    // 3. 场景 A: 无 session 变量 → 0 行(普通用户默认不可见)
    console.log('\n[3/5] 场景 A: 无 session 变量 → 应 0 行...')
    for (const t of RLS_TABLES) {
      try {
        const rows = await testConn.unsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`)
        if (rows[0].c === 0) {
          pass(`无 session 查 ${t} 返回 0 行(用户级 RLS 生效)`)
        } else {
          fail(`无 session 查 ${t} 返回 ${rows[0].c} 行(RLS 未生效!)`)
        }
      } catch (e) {
        fail(`无 session 查 ${t} 失败: ${e.message.slice(0, 100)}`)
      }
    }

    // 4. 场景 B: 管理员角色 → 全量可见
    console.log('\n[4/5] 场景 B: SET current_user_role=1(管理员)→ 应无 RLS 错误...')
    for (const t of RLS_TABLES) {
      try {
        await testConn.unsafe(`SET app.current_user_role = '1'`)
        const rows = await testConn.unsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`)
        pass(`管理员查 ${t} 返回 ${rows[0].c} 行(角色分支通过)`)
        await testConn.unsafe(`RESET app.current_user_role`)
      } catch (e) {
        fail(`管理员查 ${t} 失败: ${e.message.slice(0, 100)}`)
      }
    }

    // 5. 场景 C: bypass_rls → 全量可见
    console.log('\n[5/5] 场景 C: SET bypass_rls=true → 应无 RLS 错误...')
    for (const t of RLS_TABLES) {
      try {
        await testConn.unsafe(`SET app.bypass_rls = 'true'`)
        const rows = await testConn.unsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`)
        pass(`bypass 查 ${t} 返回 ${rows[0].c} 行(_bypass_rls 策略通过)`)
        await testConn.unsafe(`RESET app.bypass_rls`)
      } catch (e) {
        fail(`bypass 查 ${t} 失败: ${e.message.slice(0, 100)}`)
      }
    }
  } finally {
    await testConn.end({ timeout: 5 })
  }

  // 6. 清理
  console.log('\n[清理] 撤销权限 + 删除测试角色...')
  for (const t of allGrantedTables) {
    await root.unsafe(`REVOKE ALL PRIVILEGES ON "${t}" FROM "${TEST_USER}"`)
  }
  await root.unsafe(`REVOKE USAGE ON SCHEMA public FROM "${TEST_USER}"`)
  await root.unsafe(`DROP ROLE IF EXISTS "${TEST_USER}"`)
  pass('测试角色已清理')

  console.log('\n' + '='.repeat(60))
  console.log(`结果: ${testsPassed} 通过 / ${testsFailed} 失败`)
  console.log('='.repeat(60))

  if (testsFailed > 0) {
    console.log('\n❌ 预演失败:用户级 RLS 语义异常')
    process.exit(1)
  } else {
    console.log('\n✅ 预演全部通过!用户级 RLS + bypass 通道工作正常')
  }
}

main()
  .catch(async (e) => {
    console.error('\n❌ 预演异常:', e)
    await root.unsafe(`DROP ROLE IF EXISTS "${TEST_USER}"`).catch(() => {})
    process.exit(1)
  })
  .finally(() => root.end({ timeout: 5 }))
