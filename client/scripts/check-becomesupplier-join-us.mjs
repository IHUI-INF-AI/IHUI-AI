#!/usr/bin/env node
/**
 * 侧边栏 nav span 文字 "加入我们" 防回归轻量级守门 (pre-commit 用, 2026-07-03 立)
 *
 * 目的: 防止有人把 Sidebar.vue / HeaderNavigation.vue 的 t('navigation.becomeSupplier')
 *       改回 "成为供应商" 字面量, 或把 6 语言 navigation.becomeSupplier 改回旧值.
 *       本脚本在 pre-commit 阶段跑 (< 100ms), 与 e2e 守门互补:
 *
 * 与 e2e/sidebar-becomesupplier-join-us.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, < 100ms)
 *   - e2e 测试: 完整源码级断言 (CI 阶段, 88 用例含 chromium + Mobile Chrome)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 触发范围 (staged 模式):
 *   - client/src/locales/modules/{zh-CN,en,en-US,zh-TW,ja,ko}/navigation.json
 *   - client/src/components/Sidebar.vue
 *   - client/src/components/header/HeaderNavigation.vue
 *   - client/src/composables/useSidebar.ts
 *   - client/src/composables/__tests__/useSidebar.test.ts
 *
 * 用法:
 *   node scripts/check-becomesupplier-join-us.mjs          # 全量检查
 *   node scripts/check-becomesupplier-join-us.mjs --staged # 仅 staged 文件触发
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
const projectRoot = path.resolve(clientRoot, '..')

const onlyStaged = process.argv.includes('--staged')

// 6 语言 navigation.becomeSupplier 精确值 (sidebar 渲染的唯一来源)
const EXPECTED_JOIN_US = {
  'zh-CN': '加入我们',
  en: 'Join Us',
  'en-US': 'Join Us',
  'zh-TW': '加入我們',
  ja: '参加する',
  ko: '참여하기',
}

// 禁止出现的"成为供应商"族旧值 (任何语言)
const FORBIDDEN_VALUES = [
  '成为供应商',
  '成為供應商',
  'サプライヤーになる',
  '공급업체가 되기',
  '공급업체 되기',
  'Become a Supplier',
]

// ─────────────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────────────

/** 读取文件 UTF-8 字符串 */
function readFile(p) {
  return fs.readFileSync(p, 'utf-8')
}

/** git diff --cached --name-only (POSIX 路径) */
function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    })
    return out.split('\n').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean)
  } catch {
    return null // git 不可用 → 退到全量
  }
}

/** 报告违规并累加 */
let violationCount = 0
function report(file, line, msg) {
  console.error(`  [FAIL] ${path.relative(projectRoot, file)}:${line} ${msg}`)
  violationCount++
}

// ─────────────────────────────────────────────────────────────────────
// 检查 1: 6 语言 navigation.becomeSupplier = "加入我们"族
// ─────────────────────────────────────────────────────────────────────
function checkNavigationJson() {
  console.log('\n[1] 6 语言 navigation.becomeSupplier 必须是"加入我们"族')
  for (const [loc, expected] of Object.entries(EXPECTED_JOIN_US)) {
    const file = path.join(clientRoot, `src/locales/modules/${loc}/navigation.json`)
    if (!fs.existsSync(file)) {
      console.error(`  [WARN] ${file} 不存在, 跳过`)
      continue
    }
    const src = readFile(file)
    const m = src.match(/"becomeSupplier"\s*:\s*"([^"]*)"/)
    if (!m) {
      report(file, 0, `缺少 "becomeSupplier" 字段`)
      continue
    }
    if (m[1] !== expected) {
      const lineNo = src.slice(0, m.index).split('\n').length
      report(
        file,
        lineNo,
        `becomeSupplier = "${m[1]}", 应是 "${expected}" (回归到"成为供应商"族?)`,
      )
    } else {
      console.log(`  [OK] ${loc}: "${m[1]}"`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 检查 2: Sidebar.vue / HeaderNavigation.vue 引用 t('navigation.becomeSupplier')
//         且不硬编码"成为供应商"族
// ─────────────────────────────────────────────────────────────────────
function checkTemplateRef(file, label) {
  console.log(`\n[2.${label}] ${path.basename(file)} 引用 t("navigation.becomeSupplier") 不硬编码`)
  if (!fs.existsSync(file)) {
    console.error(`  [WARN] ${file} 不存在, 跳过`)
    return
  }
  const src = readFile(file)
  if (!/t\(\s*['"]navigation\.becomeSupplier['"]\s*\)/.test(src)) {
    report(file, 0, `未引用 t("navigation.becomeSupplier") (硬编码或 i18n key 错误)`)
  } else {
    console.log(`  [OK] 引用 t("navigation.becomeSupplier")`)
  }
  for (const forbidden of FORBIDDEN_VALUES) {
    if (src.includes(forbidden)) {
      const lineNo = src.split('\n').findIndex(l => l.includes(forbidden)) + 1
      report(file, lineNo, `硬编码 "${forbidden}" (应走 i18n key)`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 检查 3: useSidebar.ts / useSidebar.test.ts 注释含"加入我们"
// ─────────────────────────────────────────────────────────────────────
function checkComment(file, label) {
  console.log(`\n[3.${label}] ${path.basename(file)} 注释含"加入我们"作为 4 字 label 案例`)
  if (!fs.existsSync(file)) {
    console.error(`  [WARN] ${file} 不存在, 跳过`)
    return
  }
  const src = readFile(file)
  if (!/加入我们|加入我們/.test(src)) {
    report(file, 0, `注释未含"加入我们"案例 (4 字 label 完整显示示例)`)
  } else {
    console.log(`  [OK] 含"加入我们"案例`)
  }
  // 反向: 注释不应再用"成为供应商"作为 5 字截断案例
  if (/成为供应商|成為供應商/.test(src)) {
    const lineNo = src.split('\n').findIndex(l => /成为供应商|成為供應商/.test(l)) + 1
    report(file, lineNo, `注释残留"成为供应商" (5 字截断案例已过时, 应改为"加入我们")`)
  }
}

// ─────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────

// staged 模式: 若 nav/Sidebar/useSidebar 任一不在 staged, 跳过对应检查
let shouldRun = true
if (onlyStaged) {
  const staged = getStagedFiles()
  if (staged === null) {
    console.log('[staged] git 不可用, 退到全量检查')
  } else {
    const triggers = [
      'client/src/locales/modules/zh-CN/navigation.json',
      'client/src/locales/modules/en/navigation.json',
      'client/src/locales/modules/en-US/navigation.json',
      'client/src/locales/modules/zh-TW/navigation.json',
      'client/src/locales/modules/ja/navigation.json',
      'client/src/locales/modules/ko/navigation.json',
      'client/src/components/Sidebar.vue',
      'client/src/components/header/HeaderNavigation.vue',
      'client/src/composables/useSidebar.ts',
      'client/src/composables/__tests__/useSidebar.test.ts',
    ]
    const hasTrigger = triggers.some(t => staged.includes(t))
    if (!hasTrigger) {
      console.log('[staged] nav / Sidebar / useSidebar 不在 staged, 跳过')
      shouldRun = false
    }
  }
}

if (shouldRun) {
  checkNavigationJson()
  checkTemplateRef(path.join(clientRoot, 'src/components/Sidebar.vue'), 'a')
  checkTemplateRef(path.join(clientRoot, 'src/components/header/HeaderNavigation.vue'), 'b')
  checkComment(path.join(clientRoot, 'src/composables/useSidebar.ts'), 'a')
  checkComment(path.join(clientRoot, 'src/composables/__tests__/useSidebar.test.ts'), 'b')
}

if (violationCount > 0) {
  console.error(`\n[FAIL] 共 ${violationCount} 处违规, 侧边栏 nav span 文字已回归"成为供应商"`)
  console.error('  修复方法:')
  console.error('    1. 确认 src/locales/modules/{locale}/navigation.json 中 becomeSupplier = "加入我们"族')
  console.error('    2. 确认 Sidebar.vue / HeaderNavigation.vue 用 t("navigation.becomeSupplier")')
  console.error('    3. 跑 npm run check:becomesupplier:join-us 验证')
  console.error('  完整守门: npx playwright test e2e/sidebar-becomesupplier-join-us.spec.ts')
  process.exit(1)
}

console.log('\n[OK] 侧边栏 nav span 文字"加入我们"防回归检查通过')
