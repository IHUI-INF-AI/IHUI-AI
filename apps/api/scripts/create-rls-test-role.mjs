import postgres from 'postgres'

// 用 postgres 超级用户创建测试用非超级用户(用于 RLS 验证)
const url = 'postgresql://postgres:postgres@localhost:5432/ihui_test'
const sql = postgres(url, { max: 1, connect_timeout: 5 })

try {
  // 1) 创建测试用非超级用户
  await sql`DROP ROLE IF EXISTS rls_test_user`
  await sql`CREATE ROLE rls_test_user LOGIN PASSWORD 'rls_test_pwd' NOSUPERUSER NOBYPASSRLS`
  console.log('[OK] role rls_test_user created')

  // 2) 授权(可访问 public schema, 可读写所有表)
  await sql`GRANT CONNECT ON DATABASE ihui_test TO rls_test_user`
  await sql`GRANT USAGE, CREATE ON SCHEMA public TO rls_test_user`
  // 授权所有表(包含未来新增)
  await sql`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rls_test_user`
  await sql`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rls_test_user`
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO rls_test_user`
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO rls_test_user`
  console.log('[OK] grants applied')

  // 3) 验证连接 + RLS 生效
  const testUrl = 'postgresql://rls_test_user:rls_test_pwd@localhost:5432/ihui_test'
  const sql2 = postgres(testUrl, { max: 1, connect_timeout: 5 })
  try {
    const roleInfo = await sql2`SELECT current_user, current_setting('is_superuser') AS is_super`
    console.log('[OK] rls_test_user can connect:', roleInfo)

    // 4) 验证 RLS 真的应用(无 tenant context 时 SELECT 应返回 0 行)
    const r = await sql2`SELECT count(*)::int AS n FROM users`
    console.log('[INFO] rls_test_user SELECT without tenant_id:', r)
  } finally {
    await sql2.end({ timeout: 2 })
  }
} catch (e) {
  console.error('[FAIL]', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 2 })
}
