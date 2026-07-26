/**
 * Playwright globalSetup:在所有测试开始前自动 seed test@ihui.ai 用户。
 *
 * 触发时机:Playwright 启动时(globalSetup 阶段),早于 webServer 就绪后跑第一个 spec。
 * 与 global-teardown.ts 配对:setup seed → 测试运行 → teardown cleanup,保证数据库
 * 默认只有 admin,跑 E2E 时自动 seed + cleanup,无需手动干预,CI 也能跑通。
 *
 * 环境变量开关:
 * - E2E_SKIP_SEED=1:跳过 seed(本地开发可复用已 seed 的数据库,加快迭代)
 *
 * 失败策略:只 warn 不 throw,与 fixtures.ts 的 ensureStorageState 兜底逻辑兼容
 * (seed 失败时 E2E 以 graceful skip 模式运行,不会阻塞测试报告生成)。
 */
import { execSync } from 'node:child_process'
import path from 'node:path'

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_SKIP_SEED === '1') {
    console.log('[e2e:global-setup] E2E_SKIP_SEED=1,跳过 seed')
    return
  }

  const repoRoot = path.resolve(__dirname, '../../..')
  console.log('[e2e:global-setup] 开始 seed test@ihui.ai 用户...')

  try {
    execSync('pnpm --filter @ihui/api run seed:test-users', {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env },
      timeout: 30000,
    })
    console.log('[e2e:global-setup] seed 完成')
  } catch (err) {
    console.warn(
      '[e2e:global-setup] seed 失败,E2E 将以 graceful skip 模式运行:',
      err instanceof Error ? err.message : err,
    )
  }
}
