#!/usr/bin/env node
/**
 * 侧边栏 header 对齐 / logo 尺寸 静态守门脚本 (pre-commit 用, 2026-07-04 立)
 *
 * 目的: 防止未来某次提交把 .sidebar-header 的 padding 改回非零值
 *       (导致 logo/btn 左右各缩进 10px, 视觉错位), 或把 .sidebar-logo
 *       高度压缩到 < 28px (用户反馈"logo 这么小了", 旧值 26px).
 *
 * 与 e2e/sidebar-header-alignment.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, < 50ms)
 *   - e2e 测试: 完整源码级 + 浏览器级断言 (CI 阶段, 17 用例)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 检查项:
 *   1. .sidebar-header 的 padding 必须是 0 (含 0 0 / 0px 0px / 0 0 0 0 等)
 *   2. .sidebar-logo 的 height 必须 >= 28px
 *   3. .sidebar-logo 显式禁止旧值 26px (用户反馈太小, 2026-07-04 修复为 32px)
 *
 * 用法:
 *   node scripts/check-sidebar-header.mjs          # 全量检查
 *   node scripts/check-sidebar-header.mjs --staged # 仅 staged 文件触发
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
    return result.split('\n').some((line) => line.trim() === rel)
  } catch {
    return true // fallback: 检查全部
  }
}

let errors = []

if (!isStaged(SIDEBAR_VUE)) {
  console.log('✅ 侧边栏 header 对齐检查: 跳过 (Sidebar.vue 未暂存)')
  process.exit(0)
}

if (!fs.existsSync(SIDEBAR_VUE)) {
  console.error(`❌ 侧边栏 header 对齐检查失败: ${path.relative(clientRoot, SIDEBAR_VUE)} 不存在`)
  process.exit(1)
}

const content = fs.readFileSync(SIDEBAR_VUE, 'utf8')
const lines = content.split('\n')

/* ── 1. 禁禁用旧值 height: 26px (用户反馈太小, 2026-07-04 立) ──
 * 直接全文扫描, 命中即报错. 这是最严格的规则, 因为旧值是已知反面教材. */
for (let i = 0; i < lines.length; i++) {
  if (/height\s*:\s*26px/.test(lines[i])) {
    errors.push(`第 ${i + 1} 行: 含禁用旧值 height: 26px (用户反馈"logo 这么小了", 已于 2026-07-04 修复为 32px)`)
  }
}

/* ── 2. 检查 .sidebar-logo 规则的 height >= 28px ──
 * 找到所有 .sidebar-logo { ... } 规则块, 检查 height 值.
 * 块解析算法: 跟踪花括号深度, 从首个匹配行开始, 到深度归零时结束. */
function findBlocks(selectorRe) {
  const blocks = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!selectorRe.test(line)) continue
    // 找到块开始, 跟踪花括号深度
    let depth = 0
    let endIdx = i
    for (let j = i; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) || []).length
      depth -= (lines[j].match(/\}/g) || []).length
      if (depth === 0) {
        endIdx = j
        break
      }
    }
    blocks.push({ start: i, end: endIdx })
  }
  return blocks
}

const logoBlocks = findBlocks(/^\s*\.sidebar-logo\s*\{/)
for (const block of logoBlocks) {
  for (let i = block.start; i <= block.end; i++) {
    const m = lines[i].match(/height\s*:\s*(\d+(?:\.\d+)?)px/)
    if (m) {
      const h = parseFloat(m[1])
      if (h < 28) {
        errors.push(`第 ${i + 1} 行: .sidebar-logo height: ${h}px 小于 28px 阈值 (用户反馈"logo 这么小了", 旧值 26px 已废弃)`)
      }
    }
  }
}

/* ── 3. 检查 .sidebar-header 规则的 padding 必须是 0 ──
 * 找到所有 .sidebar-header { ... } 规则块, 检查 padding 值.
 * 允许 "0" / "0px" / "0 0" / "0px 0px" / "0 0 0 0" 等全零形式.
 * 禁止 "0 10px" / "0 var(--nav-item-pad-x)" 等含非零值. */
const headerBlocks = findBlocks(/^\s*\.sidebar-header\s*\{/)
for (const block of headerBlocks) {
  for (let i = block.start; i <= block.end; i++) {
    const m = lines[i].match(/padding\s*:\s*([^;]+);/)
    if (!m) continue
    const value = m[1].trim()
    // 拆分空格, 验证每个分量都是 0
    const parts = value.split(/\s+/)
    const allZero = parts.every(p => /^(0|0px)$/.test(p))
    if (!allZero) {
      errors.push(`第 ${i + 1} 行: .sidebar-header padding: ${value} 含非零值 (会导致 logo/collapse-btn 左右缩进, 与下方容器错位)`)
    }
  }
}

// 输出结果
if (errors.length > 0) {
  console.error('❌ 侧边栏 header 对齐 / logo 尺寸 静态守门失败:')
  for (const e of errors) {
    console.error(`  - ${e}`)
  }
  console.error('')
  console.error('修复指南:')
  console.error('  1. .sidebar-header padding 必须保持 0 (与下方 nav-item 等容器共用 4px 边距)')
  console.error('  2. .sidebar-logo height 必须 >= 28px (用户反馈"logo 这么小了")')
  console.error('  3. 完整约束见 e2e/sidebar-header-alignment.spec.ts (17 用例)')
  process.exit(1)
} else {
  console.log('✅ 侧边栏 header 对齐 / logo 尺寸 检查通过')
  process.exit(0)
}
