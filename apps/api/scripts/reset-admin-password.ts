// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号密码重置脚本。
 *
 * 用法: pnpm --filter @ihui/api reset:admin-password --account <name> --generate --yes
 *       完整参数见 --help(USAGE 常量)。
 *
 * 安全护栏(缺一不可):
 *   - 必须 --yes:缺少时打印「用户未确认」并拒绝退出,防误操作;
 *   - NODE_ENV=production 必须显式 --force:否则打印「生产环境」并拒绝退出。
 *
 * 注意: 目标账号由 0067/0071 migration 触发器保护,SQL 直接 UPDATE 会被拒绝,
 *       本脚本通过临时 DISABLE TRIGGER ALL 绕过,更新后立即 ENABLE。
 *
 * 流程:
 * 1. 解析 args → 校验护栏(--help 立即返回,不触库)
 * 2. 取得新密码(--generate 随机生成 或 --password 指定),用 hashPassword(argon2id)生成 hash
 * 3. 先尝试直接 UPDATE,失败(触发器拒绝)走降级路径:
 *    DISABLE TRIGGER ALL → UPDATE → ENABLE TRIGGER ALL
 * 4. 查询目标用户名+邮箱确认,打印结果
 */
import 'dotenv/config'

/**
 * CLI 参数解析。
 *
 * 本脚本直接改写 admin 的密码哈希,属高危运维动作,因此内置两道硬护栏:
 *   1) NODE_ENV=production 时必须额外显式 --force,否则一律拒绝;
 *   2) 必须显式 --yes 确认,否则打印「用户未确认」并拒绝。
 * 护栏判定全部发生在惰性加载数据库/argon2 之前,确保 --help 与拒绝路径
 * 零副作用(CI 冒烟环境无 DATABASE_URL 也能跑通)。
 */
type CliOptions = {
  help: boolean
  account: string
  password?: string
  generate: boolean
  yes: boolean
  force: boolean
}

const USAGE = `用法: pnpm --filter @ihui/api reset:admin-password [选项]

重置指定账号的密码(argon2id 哈希写回 users.password_hash)。

选项:
  --help, -h            打印本用法说明并退出
  --account <name>      目标账号用户名(默认: admin)
  --password <pwd>      指定明文新密码
  --generate, -g        随机生成 24 位强密码并打印(优先于 --password)
  --yes, -y             确认执行(缺少时一律拒绝,防误操作)
  --force, -f           允许在 NODE_ENV=production 下执行

示例:
  pnpm --filter @ihui/api reset:admin-password --account admin --generate --yes
  pnpm --filter @ihui/api reset:admin-password --password 'MyP@ssw0rd' --yes

注意: admin 用户受 0067/0071 migration 触发器保护,SQL 直接 UPDATE 会被拒绝,
      脚本会自动降级为 DISABLE TRIGGER ALL → UPDATE → ENABLE TRIGGER ALL。`

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    help: false,
    account: 'admin',
    generate: false,
    yes: false,
    force: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true
        break
      case '--account':
        opts.account = argv[++i] ?? opts.account
        break
      case '--password':
        opts.password = argv[++i]
        break
      case '--generate':
      case '-g':
        opts.generate = true
        break
      case '--yes':
      case '-y':
        opts.yes = true
        break
      case '--force':
      case '-f':
        opts.force = true
        break
      default:
        // 兼容旧用法:首个位置参数视为明文新密码
        if (arg && !arg.startsWith('-') && opts.password === undefined) {
          opts.password = arg
        }
        break
    }
  }

  return opts
}

/** 生成含大小写/数字/符号的随机强密码(避开易混淆字符) */
function generatePassword(length = 24): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%^&*()-_=+[]{}'
  const all = upper + lower + digits + symbols

  // 先各取一位保证四类字符齐全,再补足长度,最后整体洗牌
  const chars = [
    upper[Math.floor(Math.random() * upper.length)]!,
    lower[Math.floor(Math.random() * lower.length)]!,
    digits[Math.floor(Math.random() * digits.length)]!,
    symbols[Math.floor(Math.random() * symbols.length)]!,
  ]
  while (chars.length < length) {
    chars.push(all[Math.floor(Math.random() * all.length)]!)
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) {
    console.info(USAGE)
    return
  }

  // 护栏 1:生产环境需额外 --force(优先判定 —— 生产环境绝不轻易触碰)
  if (process.env.NODE_ENV === 'production' && !opts.force) {
    console.error('[reset-admin-password] 拒绝执行:检测到生产环境(NODE_ENV=production)。')
    console.error('[reset-admin-password] 生产环境重置密码须显式追加 --force 才允许。')
    process.exit(1)
  }

  // 护栏 2:必须显式 --yes 确认
  if (!opts.yes) {
    console.error('[reset-admin-password] 用户未确认:缺少 --yes。')
    console.error('[reset-admin-password] 该操作会直接改写密码哈希,确认后请追加 --yes 重跑。')
    console.error(USAGE)
    process.exit(1)
  }

  const plain = opts.generate ? generatePassword() : opts.password
  if (!plain) {
    console.error('[reset-admin-password] 缺少新密码:请用 --password <pwd> 或 --generate 指定。')
    process.exit(1)
  }

  // 惰性加载:上面所有早退路径都不加载数据库 / argon2 原生模块
  const [{ hashPassword }, { db }, { users }, { eq, sql }] = await Promise.all([
    import('../src/utils/password-crypto.js'),
    import('../src/db/index.js'),
    import('@ihui/database'),
    import('drizzle-orm'),
  ])

  const target = opts.account
  const updateAdminPassword = (hash: string) =>
    db.update(users).set({ passwordHash: hash }).where(eq(users.username, target))

  console.info(`[reset-admin-password] 开始重置 "${target}" 密码...`)
  if (opts.generate) {
    console.info(`[reset-admin-password] 已生成随机新密码: ${plain}`)
  }

  const hash = await hashPassword(plain)

  try {
    await updateAdminPassword(hash)
    console.info('[reset-admin-password] 直接 UPDATE 成功(触发器未拦截)')
  } catch (e) {
    console.warn(`[reset-admin-password] 直接 UPDATE 失败,走降级路径(禁用触发器): ${errMsg(e)}`)
    await db.execute(sql`ALTER TABLE users DISABLE TRIGGER ALL`)
    try {
      await updateAdminPassword(hash)
      console.info('[reset-admin-password] 降级路径 UPDATE 成功')
    } finally {
      await db.execute(sql`ALTER TABLE users ENABLE TRIGGER ALL`)
      console.info('[reset-admin-password] 已重新 ENABLE TRIGGER ALL')
    }
  }

  const [admin] = await db
    .select({ username: users.username, email: users.email })
    .from(users)
    .where(eq(users.username, target))
    .limit(1)

  if (!admin) {
    console.error(`[reset-admin-password] 失败:未找到 ${target} 用户`)
    process.exit(1)
  }

  console.info(`[reset-admin-password] 成功 ✓`)
  console.info(`  username: ${admin.username}`)
  console.info(`  email:    ${admin.email ?? '(空)'}`)
  process.exit(0)
}

main().catch((e: unknown) => {
  console.error(`[reset-admin-password] 失败: ${errMsg(e)}`)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
