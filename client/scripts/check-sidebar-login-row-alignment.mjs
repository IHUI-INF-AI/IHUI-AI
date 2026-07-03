#!/usr/bin/env node
/**
 * 侧边栏底部登录/注册按钮 水平对齐 nav-item 静态守门 (pre-commit 用, 2026-07-04 立)
 *
 * 目的: 防止未来某次提交把 .sidebar-login-row 的 padding-x 改回非零值
 *       (12px/8px 等), 导致 .login-button (width:100%) 比 nav-item 窄 16px,
 *       与上面所有菜单按钮容器的左右间距不一致.
 *
 * 与 e2e/sidebar-login-row-alignment.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, < 50ms)
 *   - e2e 测试: 完整源码级 + 浏览器级断言 (CI 阶段, 4+ 用例)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 检查项:
 *   1. .sidebar-login-row 块 (排除 .is-collapsed) 必须 margin-x 引用
 *      var(--nav-item-margin-x) (4px) - 与 nav-item 完全对齐
 *   2. .sidebar-login-row padding 水平分量必须为 0 (允许 6px 0 10px 三向简写)
 *   3. 禁用旧值 padding: 6px 12px 10px (用户反馈"间距大"根因, 2026-07-04 修复)
 *   4. 折叠态 .sidebar-login-row.is-collapsed 不允许强制 padding-x 非零
 *      (因为折叠态用 28×28 居中按钮, 不能再加 padding-x 缩窄)
 *
 * 用法:
 *   node scripts/check-sidebar-login-row-alignment.mjs          # 全量检查
 *   node scripts/check-sidebar-login-row-alignment.mjs --staged # 仅 staged 文件触发
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
// 注意: git diff 路径相对 git 根, 不是 client 根 (monorepo 结构下 client/ 是子目录)
function isStaged(filePath) {
  if (!onlyStaged) return true
  try {
    // 找 git 根目录 (可能高于 clientRoot, 如 /IHUI-AI 是根, /IHUI-AI/client 是子)
    const gitRoot = execSync('git rev-parse --show-toplevel', { cwd: clientRoot, encoding: 'utf8' }).trim()
    const rel = path.relative(gitRoot, filePath).replace(/\\/g, '/')
    const result = execSync('git diff --cached --name-only', { cwd: clientRoot, encoding: 'utf8' })
    return result.split('\n').some(line => line.trim() === rel)
  } catch {
    return true // fallback: 检查全部
  }
}

let errors = []

if (!isStaged(SIDEBAR_VUE)) {
  console.log('✅ 登录按钮水平对齐检查: 跳过 (Sidebar.vue 未暂存)')
  process.exit(0)
}

if (!fs.existsSync(SIDEBAR_VUE)) {
  console.error(`❌ 登录按钮水平对齐检查失败: ${path.relative(clientRoot, SIDEBAR_VUE)} 不存在`)
  process.exit(1)
}

const content = fs.readFileSync(SIDEBAR_VUE, 'utf8')
const lines = content.split('\n')

/* ── 工具: 找所有 .sidebar-login-row { ... } 块 (排除 .is-collapsed 后缀) ── */
function findLoginRowBlocks() {
  const blocks = []
  for (let i = 0; i < lines.length; i++) {
    // 只匹配 ".sidebar-login-row {" 开头, 排除 ".sidebar-login-row.is-collapsed"
    if (/^\s*\.sidebar-login-row\s*\{/.test(lines[i])) {
      let depth = 0
      let endIdx = i
      for (let j = i; j < lines.length; j++) {
        depth += (lines[j].match(/\{/g) || []).length
        depth -= (lines[j].match(/\}/g) || []).length
        if (depth === 0) { endIdx = j; break }
      }
      blocks.push({ start: i, end: endIdx })
    }
  }
  return blocks
}

const loginRowBlocks = findLoginRowBlocks()

if (loginRowBlocks.length === 0) {
  errors.push('找不到 .sidebar-login-row { ... } 规则块 (要求至少 1 个, 排除 .is-collapsed)')
}

/* ── 1. 禁用旧值 padding: 6px 12px 10px (用户反馈"间距大"根因) ── */
for (let i = 0; i < lines.length; i++) {
  if (/padding\s*:\s*6px\s+12px\s+10px/.test(lines[i])) {
    errors.push(`第 ${i + 1} 行: 含禁用旧值 padding: 6px 12px 10px (用户反馈"登录按钮间距大"根因, 2026-07-04 已修复为 margin-x: var(--nav-item-margin-x) + padding: 6px 0 10px)`)
  }
}

/* ── 2. 检查每个 .sidebar-login-row 块 ── */
for (const block of loginRowBlocks) {
  const blockText = lines.slice(block.start, block.end + 1).join('\n')

  /* 2a. margin-x 必须引用 var(--nav-item-margin-x) */
  // 匹配: margin: 0 var(--nav-item-margin-x); 或 margin: 0 4px;
  const hasNavItemMarginX = /margin\s*:\s*0\s+var\(--nav-item-margin-x\)/.test(blockText)
    || /margin\s*:\s*[^;]*var\(--nav-item-margin-x\)[^;]*;/.test(blockText)
  if (!hasNavItemMarginX) {
    errors.push(`第 ${block.start + 1}-${block.end + 1} 行: .sidebar-login-row 缺少 margin-x 引用 var(--nav-item-margin-x) (与 nav-item 不对齐根因)\n块内容:\n${blockText}`)
  }

  /* 2b. padding 水平分量必须为 0 */
  const paddingMatch = blockText.match(/padding\s*:\s*([^;]+);/)
  if (!paddingMatch) {
    errors.push(`第 ${block.start + 1}-${block.end + 1} 行: .sidebar-login-row 缺少 padding 声明 (无法计算水平间距)`)
  } else {
    const parts = paddingMatch[1].trim().split(/\s+/)
    const horizontalValues = []
    if (parts.length === 1) horizontalValues.push(parts[0])
    else if (parts.length === 2) horizontalValues.push(parts[1])
    else if (parts.length === 3) { horizontalValues.push(parts[1]); horizontalValues.push(parts[1]) }
    else if (parts.length === 4) { horizontalValues.push(parts[1]); horizontalValues.push(parts[3]) }

    for (const v of horizontalValues) {
      if (!['0', '0px'].includes(v)) {
        errors.push(`第 ${block.start + 1}-${block.end + 1} 行: .sidebar-login-row padding 水平分量必须为 0 (实测: ${v}, 完整: ${paddingMatch[1].trim()}) - 用户反馈"距离侧边栏左右间距有点大, 应该跟上面的菜单按钮容器相同"`)
      }
    }
  }
}

/* ── 3. 折叠态 .sidebar-login-row.is-collapsed padding-x 必须为 0 ── */
for (let i = 0; i < lines.length; i++) {
  if (/^\s*\.sidebar-login-row\.is-collapsed\s*\{/.test(lines[i])) {
    let depth = 0
    let endIdx = i
    for (let j = i; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) || []).length
      depth -= (lines[j].match(/\}/g) || []).length
      if (depth === 0) { endIdx = j; break }
    }
    const blockText = lines.slice(i, endIdx + 1).join('\n')
    const paddingMatch = blockText.match(/padding\s*:\s*([^;]+);/)
    if (paddingMatch) {
      const parts = paddingMatch[1].trim().split(/\s+/)
      const horizontalValues = []
      if (parts.length === 1) horizontalValues.push(parts[0])
      else if (parts.length === 2) horizontalValues.push(parts[1])
      else if (parts.length === 3) { horizontalValues.push(parts[1]); horizontalValues.push(parts[1]) }
      else if (parts.length === 4) { horizontalValues.push(parts[1]); horizontalValues.push(parts[3]) }
      for (const v of horizontalValues) {
        if (!['0', '0px'].includes(v)) {
          errors.push(`第 ${i + 1}-${endIdx + 1} 行: .sidebar-login-row.is-collapsed padding 水平分量必须为 0 (折叠态 28×28 居中按钮不能再缩窄, 实测: ${v})`)
        }
      }
    }
  }
}

// 输出结果
if (errors.length > 0) {
  console.error('❌ 登录按钮水平对齐 静态守门失败:')
  for (const e of errors) {
    console.error(`  - ${e}`)
  }
  console.error('')
  console.error('修复指南:')
  console.error('  1. .sidebar-login-row 必须用 margin-x: var(--nav-item-margin-x) (4px) + padding-x: 0')
  console.error('  2. 让 .login-button (width:100%) 撑满 = nav-item 同宽 (sidebar - 8 = 108px)')
  console.error('  3. 旧 padding: 6px 12px 10px 已废弃, 会让按钮比 nav-item 窄 16px')
  console.error('  4. 完整约束见 e2e/sidebar-login-row-alignment.spec.ts (4+ 用例)')
  process.exit(1)
} else {
  console.log('✅ 登录按钮水平对齐 检查通过')
  process.exit(0)
}
