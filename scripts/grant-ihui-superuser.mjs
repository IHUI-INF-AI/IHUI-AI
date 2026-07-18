// 临时脚本: 给 ihui 用户授予 SUPERUSER
import postgres from 'postgres'

const url = process.env.DATABASE_URL ?? 'postgresql://ihui:ihui_dev_d6412937d5e397bc@127.0.0.1:5432/ihui'
const sql = postgres(url, { max: 1, onnotice: () => {} })
try {
  // 尝试改 ihui 为 superuser (已可能成功,需要幂等)
  try {
    await sql.unsafe('ALTER USER ihui WITH SUPERUSER')
    console.log('[OK] ihui -> SUPERUSER')
  } catch (e) {
    console.log('[SKIP] ALTER USER:', e.message)
  }
  const r = await sql`SELECT current_user, current_setting('is_superuser') AS is_superuser`
  console.log('[INFO] current_user =', r[0].current_user, 'is_superuser =', r[0].is_superuser)
} catch (e) {
  console.error('[ERR]', e.message)
  process.exit(1)
} finally {
  await sql.end({ timeout: 1 })
}
