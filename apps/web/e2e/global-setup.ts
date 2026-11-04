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
 * - E2E_SEED_STEP_BUDGET_MS:单条 seed 命令的等待上限(默认 30000)。
 * - E2E_SEED_TOTAL_BUDGET_MS:整轮 seed 的等待上限(默认 60000);耗尽即点名剩余步骤。
 *
 * 失败策略:只 warn 不 throw,与 fixtures.ts 的 ensureStorageState 兜底逻辑兼容
 * (seed 失败时 E2E 以 graceful skip 模式运行,不会阻塞测试报告生成)。
 *
 * 有界等待(2026-11-04 立,治"globalSetup 静默挂死"):
 * - 单步预算 `E2E_SEED_STEP_BUDGET_MS`(默认 30000ms)、总预算 `E2E_SEED_TOTAL_BUDGET_MS`
 *   (默认 60000ms);总预算耗尽时**剩余步骤不再等待**,当场点名"哪几步没跑、为什么"。
 * - 子进程输出用管道捕获而不是 inherit:高负载下 inherit 的三步各吃满预算、期间控制台
 *   一个字都没有(观测者只能看到"挂死"),失败时把捕获到的末行原文打出来才能归因。
 * - 判据是"有界 + 显式失败",绝不删 seed、绝不把超时放大:后端/数据库健康时三步照常跑完。
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

/** 从 env 取正整数预算;取不到/非法一律回落默认值(不猜) */
function budgetFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** execSync 抛出的错误上真正有用的几个键(Node 未给类型,这里只做形状收窄,不用 any) */
type ExecSyncError = {
  status?: number | null
  signal?: string | null
  code?: string
  message?: string
  stdout?: string | Buffer | null
  stderr?: string | Buffer | null
}

/** 捕获到的子进程输出取末 n 行(失败时点名用;成功时不打,免噪声) */
function tailLines(value: string | Buffer | null | undefined, n = 12): string[] {
  if (value === null || value === undefined) return []
  const text = typeof value === 'string' ? value : value.toString('utf8')
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-n)
}

/**
 * 跑一条 seed 命令:有界等待 + 显式失败。
 * 返回 true=这步真的跑完了;false=失败/超时/预算不够没跑(调用方只 warn,不 throw)。
 */
function runSeedStep(opts: {
  label: string
  command: string
  cwd: string
  env: NodeJS.ProcessEnv
  budgetMs: number
  /** 影响后续用例的提示语(失败时随原因一起打印) */
  hint: string
}): boolean {
  const { label, command, cwd, env, budgetMs, hint } = opts
  if (budgetMs < 1000) {
    console.warn(
      `[e2e:global-setup] ✗ ${label} **未执行**:剩余总预算只有 ${budgetMs}ms(<1000ms),不再等待` +
        `(上调 E2E_SEED_TOTAL_BUDGET_MS,或置 E2E_SKIP_SEED=1 复用已 seed 的库)`,
    )
    return false
  }
  console.log(`[e2e:global-setup] ${label} 起跑:预算 ${budgetMs}ms`)
  const t0 = Date.now()
  try {
    execSync(command, {
      cwd,
      // 显式接管 stdio(AGENTS §12g),并用管道捕获:inherit 在负载下会让这一步哑跑满预算
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      timeout: budgetMs,
      killSignal: 'SIGTERM',
      windowsHide: true,
      encoding: 'utf8',
    })
    console.log(`[e2e:global-setup] ${label} 完成 elapsed=${Date.now() - t0}ms`)
    return true
  } catch (err) {
    const e = (err ?? {}) as ExecSyncError
    const timedOut = e.signal != null || e.code === 'ETIMEDOUT'
    console.warn(
      `[e2e:global-setup] ✗ ${label} 失败 elapsed=${Date.now() - t0}ms 预算=${budgetMs}ms ` +
        `${timedOut ? `超时被杀(signal=${e.signal ?? 'ETIMEDOUT'})` : `退出码=${e.status}`}`,
    )
    console.warn(`[e2e:global-setup]   命令:${command}(cwd=${cwd})`)
    const out = [...tailLines(e.stdout), ...tailLines(e.stderr)]
    for (const line of out) console.warn(`[e2e:global-setup]   | ${line}`)
    if (out.length === 0) console.warn('[e2e:global-setup]   | (子进程无任何输出)')
    console.warn(`[e2e:global-setup]   后果:${hint}`)
    return false
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
  // 三条 seed 共用一枚**总预算**(有界等待):单步上限 E2E_SEED_STEP_BUDGET_MS(默认 30s),
  // 整轮上限 E2E_SEED_TOTAL_BUDGET_MS(默认 60s,即旧三档 3×30s 的一半)。总预算耗尽 ⇒ 剩余
  // 步骤当场点名"未执行",绝不继续等(旧写法最坏 90s 全程零输出 = 观测者眼里的静默挂死)。
  const stepBudget = budgetFromEnv('E2E_SEED_STEP_BUDGET_MS', 30_000)
  const totalBudgetMs = budgetFromEnv('E2E_SEED_TOTAL_BUDGET_MS', 60_000)
  const deadline = Date.now() + totalBudgetMs
  console.log(
    `[e2e:global-setup] seed 预算:单步 ${stepBudget}ms / 整轮 ${totalBudgetMs}ms(超出即点名,不再等)`,
  )

  const seedSteps: Array<{ label: string; command: string; hint: string }> = [
    {
      label: 'seed test@aizhs.top 用户',
      command: 'pnpm --filter @ihui/api run seed:test-users',
      hint: 'E2E 将以 graceful skip 模式运行;需要登录态的用例(含 setup project)会失败',
    },
    {
      // knowledge-base.spec 依赖 /api/knowledge 非空列表,隔离库重建后 knowledge_base 为空,
      // 同机制 seed 公开知识条目(幂等,失败只 warn 不阻塞)
      label: 'seed 公开知识条目',
      command: 'pnpm --filter @ihui/api run seed:e2e-knowledge',
      hint: 'knowledge-base 相关用例可能失败',
    },
    {
      // notification-archive.spec(D195 真 e2e)需要 test@aizhs.top 名下两条确定形状的通知
      //(active 1 / archived 1),同机制 seed(幂等只重置种子行,失败只 warn 不阻塞)
      label: 'seed e2e 通知',
      command: 'pnpm --filter @ihui/api run seed:e2e-notifications',
      hint: 'notification-archive 相关用例可能失败',
    },
  ]

  const notRun: string[] = []
  let failed = 0
  for (const [i, step] of seedSteps.entries()) {
    const remaining = deadline - Date.now()
    const budgetMs = Math.min(stepBudget, remaining)
    if (budgetMs < 1_000) {
      notRun.push(...seedSteps.slice(i).map((s) => s.label))
      break
    }
    if (!runSeedStep({ ...step, cwd: repoRoot, env: seedEnv, budgetMs })) failed += 1
  }
  for (const label of notRun) {
    console.warn(
      `[e2e:global-setup] ✗ ${label} **未执行**:整轮 seed 预算 ${totalBudgetMs}ms 已耗尽` +
        `(上调 E2E_SEED_TOTAL_BUDGET_MS,或置 E2E_SKIP_SEED=1 复用已 seed 的库)`,
    )
  }
  if (failed > 0 || notRun.length > 0) {
    console.warn(
      `[e2e:global-setup] seed 汇总:失败 ${failed} 步 / 未执行 ${notRun.length} 步 ` +
        `(graceful skip 模式继续,不阻塞测试报告;本机供给面自检 node scripts/e2e-local-supply.mjs --check)`,
    )
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
