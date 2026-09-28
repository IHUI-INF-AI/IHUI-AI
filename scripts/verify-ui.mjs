#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * UI 视觉回归守门脚本
 *
 * 用途:
 *   在 sidebar-chat-history.tsx 等 UI 组件样式改动后, 自动跑 Playwright 视觉回归测试.
 *   作为 pre-commit / pre-push hook 的一部分, 阻止未通过视觉验证的 UI 改动合入.
 *
 * 用法:
 *   node scripts/verify-ui.mjs                    # 跑所有视觉测试
 *   node scripts/verify-ui.mjs --spec sidebar     # 只跑 sidebar-history 相关
 *   node scripts/verify-ui.mjs --check-server     # 仅检查 dev server 是否在跑
 *
 * 退出码:
 *   0 = 全部通过
 *   1 = 有测试失败
 *   2 = dev server 未启动 (需要先 pnpm dev) / 用法错误(--spec 没收到有效值)
 *   3 = Playwright 未安装
 *
 * 触发规则 (参见 user_profile.md "UI 改动交付前自验强制规则"):
 *   任务类型 ∈ {UI 样式修改, 前端组件改动, Tailwind/CSS 类调整} → 必须跑此脚本通过
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')
const webRoot = resolve(projectRoot, 'apps/web')

const args = process.argv.slice(2)
/**
 * 带值旗标的取值(2026-09-28 修 `--spec --staged` 这一型;**口径照抄枚 380431ffc / 636c28f58 /
 * 8832e73a4,不另发明**):紧邻的下一个 token 必须**存在、非空且不以 `-` 开头**,才算该旗标的值。
 * 旧写法 `args[args.indexOf('--spec') + 1]` 无条件取下一个 token,于是 `--spec --staged` 会把
 * `--staged` 当成正则喂给 `pnpm playwright test --grep`,结果 **0 条测试匹配 ⇒ Playwright 报
 * "no tests / all passed" ⇒ 本脚本 exit 0** —— AGENTS §17 的"假验收"形态(它替代的正是人工浏览器自验)。
 * 无效值一律**大声拒绝**(exit 2 + 点名实得 token),绝不退化成"没给过滤条件"去跑全量还报成功。
 * 硬约束:不带 --spec 与 --spec <合法值> 时的默认行为一字未改。
 */
function flagValue(list, flag) {
  if (!Array.isArray(list) || !list.includes(flag)) return { present: false, valid: false, value: null, token: null }
  const raw = list[list.indexOf(flag) + 1]
  const token = typeof raw === 'string' ? raw : null
  const valid = token !== null && token !== '' && !token.startsWith('-')
  return { present: true, valid, value: valid ? token : null, token }
}
const specFlag = flagValue(args, '--spec')
const specFilter = specFlag.value
const checkServerOnly = args.includes('--check-server')

function usageError(lines) {
  for (const line of lines) console.error(line)
  process.exit(2)
}

if (specFlag.present && !specFlag.valid) {
  usageError([
    `❌ [verify-ui] --spec 没有收到有效的过滤串 —— 紧邻的 token 实得:` +
      (specFlag.token === null ? '(其后没有任何参数)' : JSON.stringify(specFlag.token)),
    `   带值旗标的值必须存在、非空且不以 - 开头;否则 --spec --staged 会把 --staged 当正则喂给 --grep,`,
    `            0 条测试匹配会被读成"全部通过"(exit 0),即 §17 的假验收。`,
    `   已拒绝执行(未探测 dev server、未派生 Playwright);要跑全部视觉测试就直接省略 --spec。`,
  ])
}

function log(msg, color = '\x1b[0m') {
  console.log(`${color}${msg}\x1b[0m`)
}
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const GRAY = '\x1b[90m'

function checkDevServer() {
  log('\n=== 检查 dev server 状态 ===', CYAN)
  const result = spawnSync(
    'node',
    ['-e', 'fetch("http://localhost:8801").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'],
    { encoding: 'utf8', timeout: 5000, windowsHide: true },
  )
  if (result.status === 0) {
    log('  [OK]   web 服务在 http://localhost:8801 响应', GREEN)
    return true
  }
  log('  [ERR]  web 服务未在 http://localhost:8801 响应', RED)
  log('         请先启动服务: pwsh -ExecutionPolicy Bypass -File scripts/dev-all.ps1', GRAY)
  return false
}

function checkPlaywrightInstalled() {
  log('\n=== 检查 Playwright 安装 ===', CYAN)
  const playwrightPkg = resolve(webRoot, 'node_modules/@playwright/test/package.json')
  if (!existsSync(playwrightPkg)) {
    log('  [ERR]  @playwright/test 未安装在 apps/web/node_modules', RED)
    log('         请运行: cd apps/web && pnpm install', GRAY)
    return false
  }
  log('  [OK]   @playwright/test 已安装', GREEN)
  return true
}

function runVisualTests() {
  log('\n=== 运行 Playwright 视觉回归测试 ===', CYAN)

  const configPath = resolve(webRoot, 'playwright.visual.config.ts')
  if (!existsSync(configPath)) {
    log(`  [ERR]  配置文件不存在: ${configPath}`, RED)
    return 1
  }

  const pwArgs = ['playwright', 'test', '--config', configPath]
  if (specFilter) {
    pwArgs.push('--grep', specFilter)
    log(`  过滤 spec: ${specFilter}`, GRAY)
  }

  const result = spawnSync('pnpm', pwArgs, {
    cwd: webRoot,
    stdio: 'inherit',
    encoding: 'utf8',
    shell: process.platform === 'win32',
    windowsHide: true,
  })

  if (result.status === 0) {
    log('\n=== 测试全部通过 ===', GREEN)
    return 0
  }
  log(`\n=== 测试失败 (exit ${result.status}) ===`, RED)
  return 1
}

function main() {
  log('IHUI-AI UI 视觉回归守门', CYAN)
  log(`项目根: ${projectRoot}`, GRAY)
  log(`Web 根: ${webRoot}`, GRAY)

  if (checkServerOnly) {
    process.exit(checkDevServer() ? 0 : 2)
  }

  if (!checkDevServer()) {
    process.exit(2)
  }

  if (!checkPlaywrightInstalled()) {
    process.exit(3)
  }

  const exitCode = runVisualTests()
  process.exit(exitCode)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
