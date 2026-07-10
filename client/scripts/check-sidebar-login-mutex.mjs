#!/usr/bin/env node
// 2026-07-05 防回归: 检测 sidebar 登录态相关硬编码
// 触发场景: 用户报告"已登录时仍显示登录按钮 + 点击无反应" + "上下都有用户信息和登录按钮"
// 根因:
//   1. Sidebar.vue:252 `v-if="true"` (硬编码) - 应改为 `v-if="!isLoggedIn"`
//   2. UserMenu.vue:46 `showLoginBtn = computed(() => true)` (硬编码) - 应改为 `!isLoggedIn.value`
//   3. 任何 sidebar-login-row / sidebar-user 互斥位置都应基于 isLoggedIn 联动
//
// 检测规则:
//   规则 1: Sidebar.vue 中 `.sidebar-login-row` 元素必须含 `v-if="!isLoggedIn"` (不是 `v-if="true"`)
//   规则 2: UserMenu.vue 中 `showLoginBtn` 必须基于 `!isLoggedIn.value` 计算, 不能硬编码 `true`
//   规则 3: 项目内禁止 `.vue` 文件使用 `v-if="true"` / `v-if='true'` (允许 v-if="isTrue" 等变量形式)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const errors = []

// 规则 1: Sidebar.vue 中 .sidebar-login-row 必须基于登录态条件渲染
function checkSidebarLoginRowVIf() {
  const sidebarPath = path.join(ROOT, 'src', 'components', 'Sidebar.vue')
  if (!fs.existsSync(sidebarPath)) return
  const content = fs.readFileSync(sidebarPath, 'utf-8')
  const lines = content.split('\n')

  // 找到 .sidebar-login-row 元素块 (直到 </div>)
  let inLoginRow = false
  let loginRowStart = -1
  let loginRowEnd = -1
  let loginRowLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!inLoginRow && /class="sidebar-login-row"/.test(line)) {
      inLoginRow = true
      loginRowStart = i
    }
    if (inLoginRow) {
      loginRowLines.push(line)
      // 找到匹配的开始 <div (向上找最近的 <div 与本 .sidebar-login-row 配对)
      if (loginRowLines.length > 1 && /<\/div>/.test(line)) {
        // 数 div 嵌套深度
        let depth = 0
        for (const ll of loginRowLines) {
          const openMatches = ll.match(/<div\b/g)
          const closeMatches = ll.match(/<\/div>/g)
          if (openMatches) depth += openMatches.length
          if (closeMatches) depth -= closeMatches.length
          if (depth <= 0 && ll !== loginRowLines[0]) {
            loginRowEnd = i
            break
          }
        }
        if (loginRowEnd > 0) break
      }
    }
  }

  if (loginRowStart < 0) {
    return // 没有 sidebar-login-row 元素
  }

  // 检查包含 v-if 的最近 3 行 (start 附近)
  const vIfLine = lines.slice(Math.max(0, loginRowStart - 2), loginRowStart + 1)
    .reverse()
    .find((l) => /v-if=/.test(l))

  if (!vIfLine) {
    errors.push({
      file: 'src/components/Sidebar.vue',
      msg: '`.sidebar-login-row` 缺少 v-if 条件, 应当基于 isLoggedIn 控制显隐 (避免硬编码始终显示)',
    })
    return
  }

  // 允许的形式: v-if="!isLoggedIn" (含 v-else 邻居的 .sidebar-user)
  if (!/v-if="!isLoggedIn"/.test(vIfLine)) {
    // 排除 v-else 形式: 检查同一区域是否有 v-else
    const hasVElse = lines.slice(loginRowStart, loginRowStart + 8).some((l) => /v-else/.test(l))
    if (!hasVElse) {
      // 排除 v-if="!isLoggedIn" 形式 (允许三元/复杂表达式)
      if (/v-if="true"/.test(vIfLine) || /v-if='true'/.test(vIfLine)) {
        errors.push({
          file: 'src/components/Sidebar.vue',
          msg: `硬编码 v-if="true" 在 .sidebar-login-row (第 ${loginRowStart + 1} 行), 必须改为 v-if="!isLoggedIn"`,
          line: loginRowStart + 1,
        })
      } else if (!/v-if="!?\s*isLoggedIn/.test(vIfLine) && !/v-if="!auth/i.test(vIfLine)) {
        // 形式不严格匹配但也没引用 isLoggedIn, 给出警告
        errors.push({
          file: 'src/components/Sidebar.vue',
          msg: `\`v-if="${vIfLine.match(/v-if="([^"]+)"/)?.[1] || ''}"\` 在 .sidebar-login-row 应改为基于 isLoggedIn 的条件 (第 ${loginRowStart + 1} 行)`,
          line: loginRowStart + 1,
        })
      }
    }
  }
}

// 规则 2: UserMenu.vue 中 showLoginBtn 必须基于 !isLoggedIn.value
function checkUserMenuShowLoginBtn() {
  const userMenuPath = path.join(ROOT, 'src', 'components', 'header', 'parts', 'UserMenu.vue')
  if (!fs.existsSync(userMenuPath)) return
  const content = fs.readFileSync(userMenuPath, 'utf-8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/const\s+showLoginBtn\s*=\s*computed\(\s*\(\s*\)\s*=>\s*([^)]+)\)/)
    if (match) {
      const expr = match[1].trim()
      // 禁止硬编码 true (或 !false)
      if (expr === 'true' || expr === '!false' || expr === '!!false' || expr === 'isLoggedIn.value') {
        errors.push({
          file: 'src/components/header/parts/UserMenu.vue',
          msg: `\`showLoginBtn = computed(() => ${expr})\` 错误: 应当基于 !isLoggedIn.value, 否则已登录时仍会显示登录按钮`,
          line: i + 1,
        })
      }
      // 推荐形式: !isLoggedIn.value
      if (expr !== '!isLoggedIn.value' && expr !== '!authStore.isLoggedIn' && !expr.includes('isLoggedIn.value')) {
        errors.push({
          file: 'src/components/header/parts/UserMenu.vue',
          msg: `\`showLoginBtn = computed(() => ${expr})\` 推荐改为 \`!isLoggedIn.value\` 以确保已登录时按钮隐藏`,
          line: i + 1,
        })
      }
    }
  }
}

// 规则 3: 项目内禁止 .vue 文件使用 v-if="true" / v-if='true'
function checkNoHardcodedVIfTrue() {
  const SRC = path.join(ROOT, 'src')
  const files = []
  function walk(dir) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'dist') continue
        walk(full)
      } else if (entry.isFile() && /\.vue$/.test(entry.name)) {
        files.push(full)
      }
    }
  }
  walk(SRC)
  for (const f of files) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/')
    const content = fs.readFileSync(f, 'utf-8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (/v-if="true"/.test(lines[i]) || /v-if='true'/.test(lines[i])) {
        // 跳过注释行
        if (/^\s*(<!--|\*|\/\/)/.test(lines[i])) continue
        errors.push({
          file: rel,
          msg: `硬编码 v-if="true" 在第 ${i + 1} 行, 必须用动态表达式 (如 v-if="someCondition")`,
          line: i + 1,
        })
      }
    }
  }
}

checkSidebarLoginRowVIf()
checkUserMenuShowLoginBtn()
checkNoHardcodedVIfTrue()

if (errors.length === 0) {
  console.log('[check-sidebar-login-mutex] ✓ 侧边栏用户区/登录按钮互斥显示检查通过')
  process.exit(0)
}

console.error('\n[check-sidebar-login-mutex] ✗ 发现问题:')
for (const e of errors) {
  console.error(`  ${e.file}:${e.line || '-'}`)
  console.error(`    ${e.msg}`)
}
console.error('')
process.exit(1)
