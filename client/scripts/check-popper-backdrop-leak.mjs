#!/usr/bin/env node
/**
 * 守门脚本：检测 el-select / el-select-v2 / el-dropdown popper 弹窗
 * 卡在打开状态导致 .dropdown--fullscreen-backdrop 永久遮挡 div 点击
 *
 * 历史问题 (2026-07-04):
 *  - 某个 el-select-v2 popper 卡在 display:block / visibility:visible 状态
 *  - 它的 .dropdown--fullscreen-backdrop 子元素 (aria-hidden=true, pointer-events:auto,
 *    position:fixed; inset:0; z-index:2147483647) 覆盖整个视口拦截点击
 *  - 用户报告 LanguageSwitcher / AppDownload 多次点击无反应
 *
 * 修复方案 (g:\IHUI-AI\client\src\styles\fixes.scss):
 *  (A) :where(.dropdown--fullscreen-backdrop) { pointer-events: none !important }
 *  (B) :where([aria-hidden='true']) &.el-popper ... { display: none !important; ... }
 *  (C) :where([class*='dropdown--'][class*='backdrop']) { pointer-events: none !important }
 *
 * 本脚本扫描 src/styles/fixes.scss 是否包含上述 3 层防御 CSS，
 * 缺失任何一层都会失败，CI 阻断。
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const TARGET = resolve(ROOT, 'src/styles/fixes.scss')

const REQUIRED = [
  {
    name: '(A) .dropdown--fullscreen-backdrop pointer-events:none',
    pattern: /\.dropdown--fullscreen-backdrop[\s\S]{0,200}pointer-events:\s*none/i,
    desc: '直接禁用装饰性 backdrop 的点击拦截',
  },
  {
    name: '(B) [aria-hidden=true] &.el-popper display:none',
    pattern: /\[aria-hidden=['"]true['"]\][\s\S]{0,400}&?\.?el-popper[\s\S]{0,300}display:\s*none/i,
    desc: '父 popper 关闭时强制整个 popper 隐藏',
  },
  {
    name: '(C) [class*=dropdown--][class*=backdrop] pointer-events:none',
    pattern: /\[class\*?=['"]dropdown--['"]\]\[class\*?=['"]backdrop['"]\][\s\S]{0,200}pointer-events:\s*none/i,
    desc: '兜底：所有 dropdown--* backdrop 类都不拦截点击',
  },
  {
    name: '注释标记 (2026-07-04 防御性修复)',
    pattern: /2026-07-04/,
    desc: '确保修复有清晰的版本标记',
  },
]

let failed = 0
for (const r of REQUIRED) {
  if (!existsSync(TARGET)) {
    console.error(`[FAIL] ${TARGET} 不存在`)
    failed++
    continue
  }
  const content = readFileSync(TARGET, 'utf8')
  if (!r.pattern.test(content)) {
    console.error(`[FAIL] ${r.name}`)
    console.error(`       ${r.desc}`)
    failed++
  } else {
    console.log(`[ OK ] ${r.name}`)
  }
}

if (failed > 0) {
  console.error(`\n❌ 失败 ${failed} 项：popper 防御 CSS 不完整`)
  console.error('   这些 CSS 缺失会导致 el-select / el-select-v2 / el-dropdown 弹窗')
  console.error('   卡死时永久遮挡底层 div 点击 (用户报告 LanguageSwitcher / AppDownload 无反应)')
  process.exit(1)
}

console.log(`\n✅ 全部 ${REQUIRED.length} 项检查通过`)
