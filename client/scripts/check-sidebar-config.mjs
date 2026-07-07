#!/usr/bin/env node
/**
 * 侧边栏尺寸硬约束守门 (v12 永久锁定 60-136, 2026-07-06 升级)
 *
 * 目的: 防止 useSidebar.ts 的 4 个常量与 _sidebar-layout.scss 的 4 个 token
 *       被任意修改. 本脚本在 pre-commit 阶段跑 (< 50ms), 任何 v12 锁值的回归
 *       都会立刻 fail, 强制走"申请解除锁定"流程.
 *
 * 与 e2e/sidebar-width-v12.spec.ts 的关系:
 *   - 本脚本: 轻量级源码级检查 (pre-commit 阶段, < 50ms)
 *   - e2e 测试: 完整源码级 + 浏览器级断言 (CI 阶段, 含 12 个 nav-item 截断检查)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 历史教训:
 *   2026-07-04 用户在 1 小时内连续迭代 100 → 120 → 110 → 116 共 4 次,
 *   每次都出现"改 useSidebar.ts 忘改 _sidebar-layout.scss" 或反之的错位.
 *   落地 v12 (60-136), 2026-07-06 用户强制要求升级.
 *   本脚本即为此锁定提供回归拦截, 任何调整必须先解除锁定.
 *
 * 触发范围 (staged 模式):
 *   - client/src/composables/useSidebar.ts
 *   - client/src/composables/__tests__/useSidebar.test.ts
 *   - client/src/styles/_sidebar-layout.scss
 *   - client/src/components/Sidebar.vue
 *
 * 用法:
 *   node scripts/check-sidebar-config.mjs          # 全量检查
 *   node scripts/check-sidebar-config.mjs --staged # 仅 staged 文件触发
 *
 * 退出码:
 *   0 - 通过
 *   1 - 发现回归 (含具体文件:行号 + v12 锁定值)
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')

const onlyStaged = process.argv.includes('--staged')

// ════════════════════════════════════════════════════════════════════════
// v12 永久锁定值 (2026-07-06 用户强制要求升级, 任何调整必须先解除锁定)
// v12 与 v11 区别: DEFAULT_WIDTH/MAX_WIDTH 116→136, CURRENT_CONFIG_VERSION 11→12
// ════════════════════════════════════════════════════════════════════════
const EXPECTED = {
  useSidebar: {
    MIN_WIDTH: 60,
    MAX_WIDTH: 136,
    DEFAULT_WIDTH: 136,
    COLLAPSE_THRESHOLD: 60,
    CURRENT_CONFIG_VERSION: 12,
  },
  scss: {
    'sidebar-width': '136px',
    'sidebar-min-width': '60px',
    'sidebar-max-width': '136px',
    'sidebar-collapsed-width': '60px',
  },
}

// ─────────────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────────────

function readFile(p) {
  return fs.readFileSync(p, 'utf-8')
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    })
    return out
      .split('\n')
      .map(s => s.trim().replace(/\\/g, '/'))
      .filter(Boolean)
  } catch {
    return null
  }
}

let violationCount = 0
function report(file, line, msg) {
  console.error(`  [FAIL] ${path.relative(projectRoot, file)}:${line} ${msg}`)
  violationCount++
}

// ─────────────────────────────────────────────────────────────────────
// 检查 1: useSidebar.ts 4 个常量 + CURRENT_CONFIG_VERSION
// ─────────────────────────────────────────────────────────────────────
function checkUseSidebar() {
  console.log('\n[1] useSidebar.ts 4 个常量 + CURRENT_CONFIG_VERSION 必须匹配 v12 锁定值')
  const file = path.join(clientRoot, 'src/composables/useSidebar.ts')
  if (!fs.existsSync(file)) {
    console.error(`  [WARN] ${file} 不存在, 跳过`)
    return
  }
  const src = readFile(file)
  for (const [key, expected] of Object.entries(EXPECTED.useSidebar)) {
    // 匹配: const KEY = NUMBER (允许前后空格)
    const re = new RegExp(`\\bconst\\s+${key}\\s*=\\s*(\\d+)`)
    const m = src.match(re)
    if (!m) {
      report(file, 0, `未找到 const ${key} = ?`)
      continue
    }
    if (Number(m[1]) !== expected) {
      const lineNo = src.slice(0, m.index).split('\n').length
      report(file, lineNo, `const ${key} = ${m[1]}, 应是 ${expected} (v12 锁定值)`)
    } else {
      console.log(`  [OK] const ${key} = ${m[1]}`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 检查 2: _sidebar-layout.scss 4 个 token
// ─────────────────────────────────────────────────────────────────────
function checkScss() {
  console.log('\n[2] _sidebar-layout.scss 4 个 token 必须匹配 v12 锁定值')
  const file = path.join(clientRoot, 'src/styles/_sidebar-layout.scss')
  if (!fs.existsSync(file)) {
    console.error(`  [WARN] ${file} 不存在, 跳过`)
    return
  }
  const src = readFile(file)
  for (const [token, expected] of Object.entries(EXPECTED.scss)) {
    // 匹配: --sidebar-width: 116px; (允许前后空格, 不匹配 var() 引用)
    const re = new RegExp(`--${token}\\s*:\\s*([^;\\s}]+)`)
    const m = src.match(re)
    if (!m) {
      report(file, 0, `未找到 --${token}: ?`)
      continue
    }
    if (m[1] !== expected) {
      const lineNo = src.slice(0, m.index).split('\n').length
      report(file, lineNo, `--${token} = ${m[1]}, 应是 ${expected} (v12 锁定值)`)
    } else {
      console.log(`  [OK] --${token} = ${m[1]}`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────

// staged 模式: 若任一 trigger 文件不在 staged, 跳过
let shouldRun = true
if (onlyStaged) {
  const staged = getStagedFiles()
  if (staged === null) {
    console.log('[staged] git 不可用, 退到全量检查')
  } else {
    const triggers = [
      'client/src/composables/useSidebar.ts',
      'client/src/composables/__tests__/useSidebar.test.ts',
      'client/src/styles/_sidebar-layout.scss',
      'client/src/components/Sidebar.vue',
    ]
    const hasTrigger = triggers.some(t => staged.includes(t))
    if (!hasTrigger) {
      console.log('[staged] useSidebar.ts / _sidebar-layout.scss / Sidebar.vue 不在 staged, 跳过')
      shouldRun = false
    }
  }
}

if (shouldRun) {
  checkUseSidebar()
  checkScss()
}

if (violationCount > 0) {
  console.error(`\n[FAIL] 共 ${violationCount} 处违规, 侧边栏尺寸已偏离 v12 锁定值 (60-136)`)
  console.error('')
  console.error('  v12 (2026-07-06 升级) 永久锁定, 任何调整必须先解除锁定:')
  console.error('    1. 通知项目 Owner 明确放行 (只有用户口头强制要求才调整)')
  console.error('    2. 同步修改本脚本 EXPECTED 对象 + e2e/sidebar-width-v12.spec.ts 锚定值')
  console.error('    3. 跑全套验证: npm run check:sidebar:config + npx playwright test e2e/sidebar-width-v12.spec.ts')
  console.error('    4. 提交时附"unlock: sidebar size"前缀, 在 PR 描述中说明改动原因')
  process.exit(1)
}

console.log('\n[OK] 侧边栏尺寸 v12 锁定值 (60-136) 守门通过')
