#!/usr/bin/env node
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
 *   2 = dev server 未启动 (需要先 pnpm dev)
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
const specFilter = args.includes('--spec') ? args[args.indexOf('--spec') + 1] : null
const checkServerOnly = args.includes('--check-server')

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
    ['-e', 'fetch("http://localhost:3000").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'],
    { encoding: 'utf8', timeout: 5000 },
  )
  if (result.status === 0) {
    log('  [OK]   web 服务在 http://localhost:3000 响应', GREEN)
    return true
  }
  log('  [ERR]  web 服务未在 http://localhost:3000 响应', RED)
  log('         请先启动服务: powershell -ExecutionPolicy Bypass -File scripts/dev-all.ps1', GRAY)
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
