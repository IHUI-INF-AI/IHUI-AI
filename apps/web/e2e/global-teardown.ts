// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * 检测同机是否有其他 playwright 进程正在跑测试(即其他 agent 的 e2e)。
 *
 * 原理:Playwright 的 Chromium 可执行文件在 %LOCALAPPDATA%\ms-playwright\ 下,
 * 其 chrome.exe 进程命令行必然含 ms-playwright。globalTeardown 执行时本进程的
 * 浏览器已全部关闭(Playwright 在 teardown 前关 browser/context),因此只要检测到
 * 任意 playwright 浏览器进程,就说明有其他 agent 正在并发跑 e2e。
 *
 * 返回 true(有并发)时跳过删除 test@aizhs.top,避免破坏其他 agent 正在使用的
 * storage 会话(2026-08-26 多 agent 并发"假崩溃"根因之一)。
 * 检测失败(环境无 powershell 等)时保守返回 true(跳过删除更安全,残留用户可手动清)。
 */
function hasConcurrentPlaywright(): boolean {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'chrome.exe\'\\" | Where-Object { $_.CommandLine -match \'ms-playwright|playwright\' } | Measure-Object | Select-Object -ExpandProperty Count"',
      { encoding: 'utf8', timeout: 15000 },
    )
    const count = parseInt(out.trim(), 10)
    return !Number.isNaN(count) && count > 0
  } catch {
    // 检测失败:保守跳过删除,避免误删其他 agent 的测试用户
    return true
  }
}

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_AUTO_CLEANUP === '0') {
    console.log('[e2e:global-teardown] E2E_AUTO_CLEANUP=0,跳过 cleanup(保留 test@aizhs.top)')
    return
  }

  if (hasConcurrentPlaywright()) {
    console.log(
      '[e2e:global-teardown] 检测到其他 playwright 进程在跑测试,跳过删除 test@aizhs.top(避免破坏并发 agent 的 storage)',
    )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
