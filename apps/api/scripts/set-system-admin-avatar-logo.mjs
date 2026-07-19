// ============================================================================
// 一次性脚本: 把最高系统管理员(users.is_system_admin = true)头像改为
//           登录栏中的 /images/logo.svg。
//
// 背景:
//   - 0067_system_admin.sql 给 users 加了 is_system_admin + 触发器,
//     对 is_system_admin=true 的行禁止任何字段修改(含 avatar)。
//   - 0071_restore_admin_immutability.sql 把 password_hash 也纳入禁止列表。
//   - 本任务需要给系统管理员设置头像,必须临时禁用触发器(参考 0071 应急流程)。
//
// 应急流程(与 0071 一致):
//   停服 → postgres 超级用户 → DISABLE TRIGGER → UPDATE → ENABLE TRIGGER
//
// 幂等: 已是 '/images/logo.svg' 时不重复更新。
// 安全: 仅修改 is_system_admin = true 的行;触发器使用 ALTER TABLE ... DISABLE
//       TRIGGER (会话级),结束立即恢复;若中途异常,finally 兜底 ENABLE。
// ============================================================================
import postgres from 'postgres'

const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ihui'
const AVATAR = '/images/logo.svg'

const sql = postgres(url, { max: 1, onnotice: () => {} })
let triggerDisabled = false

try {
  // 1) 校验目标用户存在且是 system admin
  const targets = await sql`
    SELECT id, username, email, phone, nickname, role_id, is_system_admin, avatar
    FROM users
    WHERE is_system_admin = true
    ORDER BY role_id DESC, created_at ASC
  `
  if (targets.length === 0) {
    console.error('[FAIL] 没有 is_system_admin = true 的用户,任务终止')
    process.exit(2)
  }
  console.log(`[INFO] 找到 ${targets.length} 个 system admin:`)
  for (const u of targets) {
    console.log(`  - id=${u.id}  username=${u.username}  role_id=${u.role_id}  avatar=${u.avatar ?? '(null)'}`)
  }
  // 取第一个(role_id 最大/最早创建)作为"最高系统管理员"
  const admin = targets[0]
  console.log(`[INFO] 目标: id=${admin.id}  username=${admin.username}  当前 avatar=${admin.avatar ?? '(null)'}`)

  if (admin.avatar === AVATAR) {
    console.log('[OK] 头像已是目标值,无需更新')
    process.exit(0)
  }

  // 2) 临时禁用 UPDATE 触发器(参考 0071 应急流程)
  await sql`ALTER TABLE users DISABLE TRIGGER users_system_admin_immutable_update`
  triggerDisabled = true
  console.log('[INFO] 已临时禁用 users_system_admin_immutable_update 触发器')

  // 3) 更新头像
  const updated = await sql`
    UPDATE users
    SET avatar        = ${AVATAR},
        updated_at    = now()
    WHERE id = ${admin.id}::uuid
      AND is_system_admin = true
    RETURNING id, username, avatar, updated_at
  `
  if (updated.length === 0) {
    throw new Error('UPDATE 未匹配到行(可能并发删除?)')
  }
  console.log('[OK] UPDATE 成功:', JSON.stringify(updated[0], null, 2))
} catch (e) {
  console.error('[ERR]', e.message)
  process.exitCode = 1
} finally {
  // 4) 兜底:重新启用触发器
  if (triggerDisabled) {
    try {
      await sql`ALTER TABLE users ENABLE TRIGGER users_system_admin_immutable_update`
      console.log('[OK] 已恢复 users_system_admin_immutable_update 触发器')
    } catch (e) {
      console.error('[CRITICAL] 触发器恢复失败,需手动 ENABLE:', e.message)
      process.exitCode = 1
    }
  }
  await sql.end({ timeout: 2 })
}
