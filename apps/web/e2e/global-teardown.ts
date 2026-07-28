/**
 * Playwright globalTeardown:在所有测试结束后自动 cleanup test@aizhs.top 用户。
 *
 * 触发时机:Playwright 所有测试跑完后(globalTeardown 阶段),即使有测试失败也会执行。
 * 与 global-setup.ts 配对:setup seed → 测试运行 → teardown cleanup,保证数据库
 * 回到"只有 admin"的初始状态,不影响后续本地开发或下一次 CI 运行。
 *
 * 环境变量开关:
 * - E2E_AUTO_CLEANUP=0:跳过 cleanup(默认 1,即默认 cleanup,保留 test@aizhs.top 用于调试)
 *
 * 失败策略:只 warn 不 throw,teardown 失败不应阻塞测试报告生成
 * (残留 test@aizhs.top 时可手动跑 `node apps/api/scripts/cleanup-test-users.mjs` 清理)。
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_AUTO_CLEANUP === '0') {
    console.log('[e2e:global-teardown] E2E_AUTO_CLEANUP=0,跳过 cleanup(保留 test@aizhs.top)')
    return
  }

  const repoRoot = path.resolve(__dirname, '../../..')
  console.log('[e2e:global-teardown] 开始 cleanup test@aizhs.top 用户...')

  try {
    execSync('node apps/api/scripts/cleanup-test-users.mjs', {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env },
      timeout: 30000,
    })
    console.log('[e2e:global-teardown] cleanup 完成,数据库回到只有 admin 状态')
  } catch (err) {
    console.warn(
      '[e2e:global-teardown] cleanup 失败(可能残留 test@aizhs.top,可手动跑 node apps/api/scripts/cleanup-test-users.mjs):',
      err instanceof Error ? err.message : err,
    )
  }
}
