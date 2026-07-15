/**
 * RLS 生产启用预演 (DRY-RUN) — 增强版
 *
 * 修复 v1 问题:
 *   - chat_messages 等表的 FK 引用 chat_conversations / users 等非 RLS 表
 *   - 当非超级用户查询时,PG 会做 FK 权限检查 → 42501 insufficient_privilege
 *   - 必须在 GRANT 列表中包含所有 RLS 表的 FK 引用表
 */
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui'
const root = postgres(url, { max: 1 })

const TEST_USER = `rls_dryrun_${Date.now().toString(36)}`
const TEST_PASS = `rls_dryrun_pwd_${Math.random().toString(36).slice(2)}`
const TEST_TENANT = '00000000-0000-0000-0000-000000000001'
const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000000'

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
  // 找出 RLS 表引用的所有外键表(包括非 RLS 表)
  const rows = await root`
    SELECT
      tc.table_name AS source_table,
      ccu.table_name AS referenced_table
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
  console.log('RLS 生产启用预演 v2 (修复 FK 权限)')
  console.log('='.repeat(60))

  // 0. 收集所有需要 GRANT 的表
  const referencedTables = await findReferencedTables()
  const allGrantedTables = Array.from(new Set([...RLS_TABLES, ...referencedTables]))
  console.log(`RLS 表: ${RLS_TABLES.length} 个`)
  console.log(`FK 引用表: ${referencedTables.length} 个 (${referencedTables.join(', ')})`)
  console.log(`需要 GRANT 总计: ${allGrantedTables.length} 个表`)
  console.log('')

  // 1. 创建测试角色
  console.log('[1/7] 创建测试角色...')
  await root.unsafe(`DROP ROLE IF EXISTS "${TEST_USER}"`)
  await root.unsafe(`CREATE ROLE "${TEST_USER}" WITH LOGIN PASSWORD '${TEST_PASS}'`)
  pass('测试角色创建')

  // 2. GRANT 表权限(包含 FK 引用表)
  console.log('\n[2/7] GRANT 表权限(RLS 表 + FK 引用表)...')
  await root.unsafe(`GRANT USAGE ON SCHEMA public TO "${TEST_USER}"`)
  for (const t of allGrantedTables) {
    await root.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON "${t}" TO "${TEST_USER}"`)
  }
  pass(`${allGrantedTables.length} 个表权限授予`)

  // 3. 测试连接
  const testConn = postgres(url.replace(/\/\/[^:]+:[^@]+@/, `//${TEST_USER}:${TEST_PASS}@`), { max: 1 })

  try {
    // 4. 场景 A
    console.log('\n[3/7] 场景 A: 无 tenant_id → 应 0 行...')
    for (const t of RLS_TABLES) {
      try {
        const rows = await testConn.unsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`)
        if (rows[0].c === 0) {
          pass(`无 tenant_id 查 ${t} 返回 0 行`)
        } else {
          fail(`无 tenant_id 查 ${t} 返回 ${rows[0].c} 行(RLS 未生效!)`)
        }
      } catch (e) {
        fail(`无 tenant_id 查 ${t} 失败: ${e.message.slice(0, 100)}`)
      }
    }

    // 5. 场景 B
    console.log('\n[4/7] 场景 B: SET tenant_id=默认 → 应返回数据(空表返回 0 也正确)...')
    for (const t of RLS_TABLES) {
      try {
        await testConn.unsafe(`SET app.tenant_id = '${DEFAULT_TENANT}'`)
        const rows = await testConn.unsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`)
        // 真实行为:有数据表返回 >0,无数据表返回 0(都正确)
        if (rows[0].c >= 0) {
          pass(`默认 tenant_id 查 ${t} 返回 ${rows[0].c} 行(无 RLS 错误)`)
        }
        await testConn.unsafe(`RESET app.tenant_id`)
      } catch (e) {
        fail(`默认 tenant_id 查 ${t} 失败: ${e.message.slice(0, 100)}`)
      }
    }

    // 6. 场景 C
    console.log('\n[5/7] 场景 C: SET tenant_id=其他租户 → 应 0 行...')
    for (const t of RLS_TABLES) {
      try {
        await testConn.unsafe(`SET app.tenant_id = '${TEST_TENANT}'`)
        const rows = await testConn.unsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`)
        if (rows[0].c === 0) {
          pass(`其他 tenant_id 查 ${t} 返回 0 行(隔离生效)`)
        } else {
          fail(`其他 tenant_id 查 ${t} 返回 ${rows[0].c} 行(隔离失效!)`)
        }
        await testConn.unsafe(`RESET app.tenant_id`)
      } catch (e) {
        fail(`其他 tenant_id 查 ${t} 失败: ${e.message.slice(0, 100)}`)
      }
    }

    // 7. 场景 D
    console.log('\n[6/7] 场景 D: SET bypass_rls=true → 应无 RLS 错误(允许 0 行)...')
    for (const t of RLS_TABLES) {
      try {
        await testConn.unsafe(`SET app.bypass_rls = 'true'`)
        const rows = await testConn.unsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`)
        // 关键:必须不抛 "invalid uuid" 错误,行数 >= 0 都正确
        pass(`bypass_rls 查 ${t} 返回 ${rows[0].c} 行(无 RLS 错误)`)
        await testConn.unsafe(`RESET app.bypass_rls`)
      } catch (e) {
        fail(`bypass_rls 查 ${t} 失败: ${e.message.slice(0, 100)}`)
      }
    }

    // 8. 场景 E: 模拟实际应用 — JOIN 查询
    console.log('\n[7/7] 场景 E: 模拟应用 — JOIN 查询(含 FK)...')
    try {
      await testConn.unsafe(`SET app.tenant_id = '${DEFAULT_TENANT}'`)
      const rows = await testConn.unsafe(`
        SELECT u.id, u.nickname, COUNT(o.id)::int AS order_count
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        GROUP BY u.id, u.nickname
        LIMIT 5
      `)
      pass(`users JOIN orders 返回 ${rows.length} 行`)
    } catch (e) {
      fail(`users JOIN orders 失败: ${e.message.slice(0, 150)}`)
    }
  } finally {
    await testConn.end({ timeout: 5 })
  }

  // 9. 清理
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
    console.log('\n❌ 预演失败:生产启用前必须修复')
    process.exit(1)
  } else {
    console.log('\n✅ 预演全部通过!')
    console.log('')
    console.log('生产启用清单(必须在 staging 演练后再执行):')
    console.log('  1. CREATE ROLE app_user WITH LOGIN PASSWORD \'<强密码>\';')
    console.log('  2. GRANT USAGE ON SCHEMA public TO app_user;')
    console.log(`  3. GRANT SELECT, INSERT, UPDATE, DELETE ON ${allGrantedTables.join(', ')} TO app_user;`)
    console.log('  4. ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;')
    console.log('  5. 切换 DATABASE_URL 到 app_user 凭据')
    console.log('  6. 启动服务,确认所有 API 200,无 403 误杀')
    console.log('  7. (回滚)立即切回原 DATABASE_URL,DROP ROLE app_user')
  }
}

main()
  .catch(async (e) => {
    console.error('\n❌ 预演异常:', e)
    await root.unsafe(`DROP ROLE IF EXISTS "${TEST_USER}"`).catch(() => {})
    process.exit(1)
  })
  .finally(() => root.end({ timeout: 5 }))
