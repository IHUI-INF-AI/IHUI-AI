import 'dotenv/config'
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })
try {
  const residual = await sql`
    SELECT id, username, nickname, phone, email, role_id, status, is_system_admin, created_at
    FROM users
    WHERE phone ~ '^[0-9]{1,4}$' OR phone LIKE '19900000%' OR username IN ('e2e_admin','e2e_user') OR phone = '13133287445'
    ORDER BY created_at
  `
  console.log('残留测试账号:', residual.length, '个')
  for (const u of residual) {
    console.log(JSON.stringify(u, null, 2))
  }

  console.log('\n--- 全部用户列表 ---')
  const all = await sql`
    SELECT id, username, nickname, phone, email, role_id, is_system_admin
    FROM users
    ORDER BY created_at
  `
  console.log('总用户数:', all.length)
  for (const u of all) {
    console.log(JSON.stringify({ username: u.username, phone: u.phone, email: u.email, role_id: u.role_id, isSystemAdmin: u.isSystemAdmin }))
  }

  console.log('\n--- 已应用的 migration (0070+) ---')
  const migrations = await sql`
    SELECT filename FROM (
      SELECT '0070_rls_safe_tenant_id' AS filename, EXISTS(SELECT 1 FROM pg_policies WHERE policyname LIKE '%tenant_iso%') AS applied
      UNION ALL
      SELECT '0071_restore_admin_immutability', EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'users_system_admin_immutable_update')
      UNION ALL
      SELECT '0072_drop_0066_rls_policies', NOT EXISTS(SELECT 1 FROM pg_policies WHERE policyname LIKE '%tenant_iso%')
      UNION ALL
      SELECT '0073_refresh_tokens_cascade', EXISTS(SELECT 1 FROM information_schema.referential_constraints WHERE constraint_name LIKE '%refresh_tokens%')
    ) t
  `
  for (const m of migrations) console.log(m.filename)
} catch (e) {
  console.error('ERR:', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 5 })
}
