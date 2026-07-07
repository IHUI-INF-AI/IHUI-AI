#!/usr/bin/env node
/**
 * 侧边栏活跃指示条 (nav-active-indicator) 对齐 静态守门脚本 (pre-commit 用, 2026-07-04 立)
 *
 * 目的: 防止未来某次提交把指示条位置算法退回到错误的实现, 或移除
 *       ResizeObserver 对子元素的多元素观察 (导致 chat history 异步加载
 *       后指示条卡在旧位置错位).
 *
 * 与 e2e/sidebar-active-indicator-alignment.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, < 50ms)
 *   - e2e 测试: 完整源码级 + 浏览器级断言 (CI 阶段, 7 用例)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 检查项:
 *   1. updateActiveIndicator 必须使用 getBoundingClientRect() (不能退化到 offsetTop 链)
 *   2. ResizeObserver 必须观察 nav + .sidebar-chat-history + .nav-group-items
 *      + .nav-submenu (4 个目标, 缺一即视为回归)
 *   3. 指示条高度算法: activeHeight × 0.7 (保留 70% + 垂直居中)
 *   4. 指标条 opacity=0 的兜底分支: offsetParent === null 时必须隐藏
 *      (防止 v-show 隐藏的分组仍渲染指示条到 (0,0) 位置)
 *
 * 用法:
 *   node scripts/check-sidebar-active-indicator.mjs          # 全量检查
 *   node scripts/check-sidebar-active-indicator.mjs --staged # 仅 staged 文件触发
 *
 * 退出码:
 *   0 - 通过
 *   1 - 发现回归 (含具体文件:行号)
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')

const onlyStaged = process.argv.includes('--staged')

// 目标文件
const SIDEBAR_VUE = path.join(clientRoot, 'src/components/Sidebar.vue')

// staged 模式下只检查 git staged 的文件
function isStaged(filePath) {
  if (!onlyStaged) return true
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', { cwd: clientRoot, encoding: 'utf8' }).trim()
    const rel = path.relative(gitRoot, filePath).replace(/\\/g, '/')
    const result = execSync('git diff --cached --name-only', { cwd: clientRoot, encoding: 'utf8' })
    return result.split('\n').some((line) => line.trim() === rel)
  } catch {
    return true
  }
}

let errors = []

if (!isStaged(SIDEBAR_VUE)) {
  console.log('✅ 侧边栏指示条对齐检查: 跳过 (Sidebar.vue 未暂存)')
  process.exit(0)
}

if (!fs.existsSync(SIDEBAR_VUE)) {
  console.error(`❌ 侧边栏指示条对齐检查失败: ${path.relative(clientRoot, SIDEBAR_VUE)} 不存在`)
  process.exit(1)
}

const content = fs.readFileSync(SIDEBAR_VUE, 'utf8')
const lines = content.split('\n')

/* ── 1. updateActiveIndicator 必须使用 getBoundingClientRect (禁止退回 offsetTop 链) ──
 * 根因 (2026-07-04): 旧实现用 offsetTop 链式累加, 但 .nav-item-wrapper /
 * .nav-group-items 上有 `contain: layout style` 创建新 offsetParent 上下文,
 * 中间节点累加容易因 SidebarChatHistory 异步加载计算出过时值.
 *
 * 关键字: 必须同时存在 `getBoundingClientRect` 出现 ≥ 2 次 (navRect + activeRect)
 *         + 出现 `navRect.top` 用法. */
const gbrCount = (content.match(/getBoundingClientRect/g) || []).length
if (gbrCount < 2) {
  errors.push(`updateActiveIndicator 中 getBoundingClientRect() 调用次数为 ${gbrCount} < 2 (期望 navRect + activeRect 各 1 次). 退回到 offsetTop 链会导致 .nav-item-wrapper / .nav-group-items 的 contain:layout style 创建新 offsetParent 上下文, 累加计算出过时值, 指示条错位.`)
}
if (!/navRect\.top/.test(content)) {
  errors.push(`updateActiveIndicator 缺少 navRect.top 用法. 必须用 getBoundingClientRect 获取 nav 自身视口坐标作为基准.`)
}

/* ── 2. ResizeObserver 必须观察 4 个目标元素 ──
 * 根因 (2026-07-04): nav 是 flex:1 1 0% 固定高度 (~1090px), 子元素 chat history
 * 从 0 异步增长到 ~165px 时 nav 自身 offsetHeight/scrollHeight 都不变,
 * ResizeObserver 永远不触发 → 指示条卡在旧 transform 错位.
 *
 * 必须观察: nav, .sidebar-chat-history, .nav-group-items, .nav-submenu
 * 检查方式: 全文搜索 observe( 调用 + 选择器. */
const requiredObservers = [
  { name: 'nav 自身 (兜底)', pattern: /\.observe\(\s*navEl\s*\)/, required: true },
  { name: '.sidebar-chat-history (异步加载)', pattern: /\.sidebar-chat-history/, required: true },
  { name: '.nav-group-items (展开/收起)', pattern: /\.nav-group-items/, required: true },
  { name: '.nav-submenu (二级菜单展开)', pattern: /\.nav-submenu/, required: true },
]
for (const obs of requiredObservers) {
  if (obs.required && !obs.pattern.test(content)) {
    errors.push(`ResizeObserver 缺少对 ${obs.name} 的观察. 根因: nav 是 flex:1 1 0% 固定高度, 子元素高度变化不触发父容器 ResizeObserver. 修复: 必须显式 observe 每个会变化高度的子元素.`)
  }
}

/* ── 3. 指示条高度 = activeHeight × 0.7 (保留 70%, 垂直居中) ──
 * 必须存在 Math.round(height * 0.7) 或 height * 0.7 的高度算法. */
if (!/height\s*\*\s*0\.7/.test(content)) {
  errors.push(`指示条高度算法缺少 'height * 0.7' (保留 70% 高度 + 垂直居中). 旧值 24px 写死会导致 nav-item 高度变化时指示条不再居中.`)
}

/* ── 4. offsetParent === null 时必须隐藏 (防止 v-show 隐藏分组残留指示条) ──
 * v-show 隐藏的分组 (display:none) 内 active 项的 offsetParent = null,
 * 指示条会跑偏到 (0,0) 位置. 必须显式判断并设 opacity:0. */
if (!/offsetParent\s*===\s*null/.test(content)) {
  errors.push(`updateActiveIndicator 缺少 'offsetParent === null' 兜底分支. v-show 隐藏的分组 (display:none) 内 active 项的 offsetParent = null, 不判断会跑偏到 (0,0) 位置.`)
}

/* ── 5. 禁止使用 offsetTop 链式累加 (旧错误实现的反面教材) ──
 * 允许单次 'offsetTop' 出现用于 offsetParent 兜底判断, 但不能用于位置计算
 * (不能有 'el.offsetTop' 或 'activeEl.offsetTop' 用于 top 变量赋值). */
const offsetTopMisuse = /(?:activeEl|el|item|navItem)\.offsetTop/.test(content)
if (offsetTopMisuse) {
  errors.push(`检测到 '*.offsetTop' 用于位置计算的痕迹. 禁止用 offsetTop 链式累加 (会被 contain:layout style 创建的新 offsetParent 上下文干扰). 应统一用 getBoundingClientRect() 视口坐标.`)
}

// 输出结果
if (errors.length > 0) {
  console.error('❌ 侧边栏指示条对齐 静态守门失败:')
  for (const e of errors) {
    console.error(`  - ${e}`)
  }
  console.error('')
  console.error('修复指南:')
  console.error('  1. updateActiveIndicator 用 getBoundingClientRect() 而非 offsetTop 链')
  console.error('  2. ResizeObserver 同时观察 nav + .sidebar-chat-history + .nav-group-items + .nav-submenu')
  console.error('  3. 指示条高度 = activeHeight × 0.7, 垂直居中 (activeTop + 6px)')
  console.error('  4. offsetParent === null 时 opacity:0 兜底')
  console.error('  5. 完整约束见 e2e/sidebar-active-indicator-alignment.spec.ts (7 用例)')
  process.exit(1)
} else {
  console.log('✅ 侧边栏指示条对齐 检查通过')
  process.exit(0)
}
