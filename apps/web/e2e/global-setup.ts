// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Playwright globalSetup:在所有测试开始前自动 seed test@aizhs.top 用户。
 *
 * 触发时机:Playwright 启动时(globalSetup 阶段),早于 webServer 就绪后跑第一个 spec。
 * 与 global-teardown.ts 配对:setup seed → 测试运行 → teardown cleanup,保证数据库
 * 默认只有 admin,跑 E2E 时自动 seed + cleanup,无需手动干预,CI 也能跑通。
 *
 * 环境变量开关:
 * - E2E_SKIP_SEED=1:跳过 seed(本地开发可复用已 seed 的数据库,加快迭代)
 * - E2E_DATABASE_URL:seed 定向到隔离库(如 ihui_e2e)。设置后覆盖传给 seed 脚本的
 *   DATABASE_URL,不再兜底读 apps/api/.env 的默认库;与 web/api 侧
 *   IHUI_API_PROXY_TARGET 隔离反代配套,让 e2e 全栈走独立库不碰他席开发库。
 *
 * 失败策略:只 warn 不 throw,与 fixtures.ts 的 ensureStorageState 兜底逻辑兼容
 * (seed 失败时 E2E 以 graceful skip 模式运行,不会阻塞测试报告生成)。
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 本机 e2e 供给面里的 E2E_DATABASE_URL(gitignored,由
 * `scripts/e2e-local-supply.mjs --provision-admin` 维护)。
 *
 * 只取这一键、不做任何库名判定(判定唯一真相源仍是 seed 脚本):显式
 * process.env.E2E_DATABASE_URL 优先;未设时才用它把 seed 定向到隔离库
 * (本机默认 DSN 指向的 ihui/ihui_dev 是各席共用的开发库,seed 写进去是跨会话副作用)。
 * 文件不存在 / 读不到 / 无此键 ⇒ 返回 undefined,完全沿用原默认行为(不猜)。
 */
function readLocalE2eDatabaseUrl(): string | undefined {
  try {
    const file = path.join(__dirname, '.env.e2e.local')
    if (!existsSync(file)) return undefined
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*E2E_DATABASE_URL\s*=\s*(.+?)\s*$/.exec(line)
      if (m) return m[1]
    }
  } catch {
    /* 读不到 = 不改默认 */
  }
  return undefined
}

/** 只报库名(DSN 的口令段永不回显) */
function dbNameOf(dsn: string): string {
  try {
    return new URL(dsn).pathname.replace(/^\//, '') || '<empty>'
  } catch {
    return '<unparsable>'
  }
}

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_SKIP_SEED === '1') {
    console.log('[e2e:global-setup] E2E_SKIP_SEED=1,跳过 seed')
    return
  }

  const repoRoot = path.resolve(__dirname, '../../..')
  // E2E_DATABASE_URL ⇒ seed 一律写隔离库;未设且本机供给面也没有 ⇒ 沿用 seed 脚本自身
  // dotenv 兜底(默认行为不变)。来源优先级:process.env > e2e/.env.e2e.local。
  const seedEnv: NodeJS.ProcessEnv = { ...process.env }
  const e2eDatabaseUrl = process.env.E2E_DATABASE_URL || readLocalE2eDatabaseUrl()
  if (e2eDatabaseUrl) {
    seedEnv.DATABASE_URL = e2eDatabaseUrl
    const from = process.env.E2E_DATABASE_URL ? 'process.env' : 'e2e/.env.e2e.local'
    console.log(
      `[e2e:global-setup] seed 目标库=${dbNameOf(e2eDatabaseUrl)}(来源:${from})⇒ 不写 apps/api/.env 默认库`,
    )
  }
  console.log('[e2e:global-setup] 开始 seed test@aizhs.top 用户...')

  try {
    execSync('pnpm --filter @ihui/api run seed:test-users', {
      cwd: repoRoot,
      stdio: 'inherit',
      env: seedEnv,
      timeout: 30000,
      windowsHide: true,
    })
    console.log('[e2e:global-setup] seed 完成')
  } catch (err) {
    console.warn(
      '[e2e:global-setup] seed 失败,E2E 将以 graceful skip 模式运行:',
      err instanceof Error ? err.message : err,
    )
  }

  // knowledge-base.spec 依赖 /api/knowledge 非空列表,隔离库重建后 knowledge_base 为空,
  // 同机制 seed 公开知识条目(幂等,失败只 warn 不阻塞)
  try {
    execSync('pnpm --filter @ihui/api run seed:e2e-knowledge', {
      cwd: repoRoot,
      stdio: 'inherit',
      env: seedEnv,
      timeout: 30000,
      windowsHide: true,
    })
    console.log('[e2e:global-setup] knowledge seed 完成')
  } catch (err) {
    console.warn(
      '[e2e:global-setup] knowledge seed 失败,knowledge-base 相关用例可能失败:',
      err instanceof Error ? err.message : err,
    )
  }

  // notification-archive.spec(D195 真 e2e)需要 test@aizhs.top 名下两条确定形状的通知
  //(active 1 / archived 1),同机制 seed(幂等只重置种子行,失败只 warn 不阻塞)
  try {
    execSync('pnpm --filter @ihui/api run seed:e2e-notifications', {
      cwd: repoRoot,
      stdio: 'inherit',
      env: seedEnv,
      timeout: 30000,
      windowsHide: true,
    })
    console.log('[e2e:global-setup] notifications seed 完成')
  } catch (err) {
    console.warn(
      '[e2e:global-setup] notifications seed 失败,notification-archive 相关用例可能失败:',
      err instanceof Error ? err.message : err,
    )
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
