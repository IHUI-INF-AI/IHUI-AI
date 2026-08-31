#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-tagsview-visual.mjs — 选中态描边定稿守门(防回退,2026-08-17 立,2026-08-18 扩全站)
 *
 * 触发背景(真实回退事故):
 * 8-13 提交 85294855d5 用户反馈"pure black/white 太突兀",active 态定稿为
 * outline-2 outline-border(主题灰 2px 外描边);8-17 提交 3c22437562 重构时
 * 基于旧版覆盖,回退成 outline-black / dark:outline-white(纯黑/纯白),
 * 用户肉眼察觉"描边怎么变纯白纯黑了"。修复提交 9472c44bca 恢复定稿后,
 * 本守门在每次 commit 时跑,确保定稿不被再次静默回退。
 *
 * 2026-08-18 扩展:用户确认全站统一,其余 5 处选项选中态(agent-pill /
 * workspace-permission-dialog / generation-type-selector / question-dialog /
 * SpecGenerateForm)同步改为 outline-border,本守门新增全站扫描段,
 * 任何 .tsx/.ts 代码中再出现 outline-black / dark:outline-white 即拦截。
 *
 * 守门项(TagsView 专项,定稿依据见 TagsView.tsx 注释):
 * 1. active 态 className 必须含 outline-2 + outline-border(同一字符串)
 * 2. 禁止 outline-black(亮色纯黑描边)
 * 3. 禁止 dark:outline-white(暗色纯白描边)
 * 4. pinned 标签必须用 bg-pinned-tag-bg(2026-08-07 定稿 token)
 * 5. 未选中标签必须用 bg-tag-inactive-bg(2026-08-07 定稿 token,暗色提亮)
 * 6. TagsView.test.tsx 必须含反向断言 not.toContain('outline-black') /
 *    not.toContain('dark:outline-white')(防测试也被回退)
 *
 * 守门项(全站通用):
 * 7. apps/web 下所有 .tsx/.ts(app/ + src/)代码字符串禁止 outline-black / dark:outline-white
 *    (仅检查引号内 className 字符串,注释/测试断言/静态产物豁免)
 *
 * 用法:
 *   node scripts/check-tagsview-visual.mjs      # 单次守门
 *
 * 退出码: 0=通过, 1=失败(阻塞 commit)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const errors = []

function check(label, cond, hint) {
  if (cond) {
    console.log(`  \u2713 ${label}`)
  } else {
    errors.push(`${label}${hint ? ' — ' + hint : ''}`)
    console.log(`  \u2717 ${label}${hint ? ' — ' + hint : ''}`)
  }
}

/**
 * 提取源码中所有引号包裹的字符串(单引号/双引号/模板串),只在这些片段里检查
 * className 样式词,避免把注释/说明文字里的历史描述(如"曾用 outline-black")误判为违规。
 */
function extractQuotedStrings(src) {
  const out = []
  const re = /(["'`])((?:[^\\\n]|\\.)*?)\1/g
  let m
  while ((m = re.exec(src)) !== null) {
    out.push(m[2])
  }
  return out
}

// ─── 1. TagsView.tsx 定稿守门 ─────────────────────────────
const tsxPath = resolve(ROOT, 'apps/web/src/components/layout/TagsView.tsx')
if (!existsSync(tsxPath)) {
  errors.push(`TagsView.tsx 不存在: ${tsxPath}`)
} else {
  const src = readFileSync(tsxPath, 'utf8')
  const code = extractQuotedStrings(src).join('\n')

  // active 态必须同时含 outline-2 + outline-border(主题灰 2px 外描边,8-13 定稿)
  check(
    'active 态用 outline-2 + outline-border(主题灰)',
    code.includes('outline-2') && code.includes('outline-border'),
    '8-13 用户定稿:outline-2 outline-border;被回退成纯黑/纯白会在此拦截',
  )

  // 禁止纯黑/纯白描边(8-13 用户反馈"太突兀"后永久禁用)
  check(
    '禁止 outline-black(纯黑描边)',
    !code.includes('outline-black'),
    '8-13 用户明确反馈 pure black/white 太突兀,禁止改回 outline-black',
  )
  check(
    '禁止 dark:outline-white(纯白描边)',
    !code.includes('dark:outline-white'),
    '8-13 用户明确反馈 pure black/white 太突兀,禁止改回 dark:outline-white',
  )

  // pinned / 未选中标签 token 定稿(2026-08-07)
  check(
    'pinned 标签用 bg-pinned-tag-bg',
    code.includes('bg-pinned-tag-bg'),
    '2026-08-07 定稿专用 token,暗色下与背景可辨;勿改回 bg-muted/70',
  )
  check(
    '未选中标签用 bg-tag-inactive-bg',
    code.includes('bg-tag-inactive-bg'),
    '2026-08-07 定稿专用 token(暗色提亮 7% L);勿改回 bg-muted',
  )
}

// ─── 2. 测试断言守门(防测试被一并回退) ─────────────────────
const testPath = resolve(ROOT, 'apps/web/src/components/layout/__tests__/TagsView.test.tsx')
if (!existsSync(testPath)) {
  errors.push(`TagsView.test.tsx 不存在: ${testPath}`)
} else {
  const testSrc = readFileSync(testPath, 'utf8')
  // 测试断言是代码(不在引号内),直接用原始文本匹配 not.toContain(...) 组合
  check(
    '测试含 outline-black 反向断言',
    testSrc.includes("not.toContain('outline-black')"),
    '9472c44bca 起要求测试必须反向断言禁用纯黑,防回退静默通过',
  )
  check(
    '测试含 dark:outline-white 反向断言',
    testSrc.includes("not.toContain('dark:outline-white')"),
    '9472c44bca 起要求测试必须反向断言禁用纯白,防回退静默通过',
  )
  check(
    '测试断言 outline-2 + outline-border',
    testSrc.includes('outline-2') && testSrc.includes('outline-border'),
    '测试应断言定稿样式存在,与 8-13 定稿保持一致',
  )
}

// ─── 3. 全站选中态描边守门(2026-08-18 立,2026-08-18 扩展至 apps/web 全目录) ──
// 扫描 apps/web 下所有 .tsx/.ts(app/ + src/ 全部纳入),仅检查引号内的 className 字符串,
// 禁止 outline-black / dark:outline-white(用户 8-13 定稿"纯黑/纯白太突兀")。
// 豁免:__tests__/tests/e2e(测试断言故意含这些词)、out/.next(静态产物)、
//      TagsView.tsx(专项已查,注释含历史描述)。
const WEB_ROOT = resolve(ROOT, 'apps/web')
const EXCLUDE_DIRS = new Set(['__tests__', 'tests', 'e2e', 'node_modules', '.next', 'out'])
const BANNED = ['outline-black', 'dark:outline-white']

function walkFiles(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walkFiles(join(dir, entry.name), out)
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(join(dir, entry.name))
    }
  }
}

if (existsSync(WEB_ROOT)) {
  const files = []
  walkFiles(WEB_ROOT, files)
  const hits = []
  for (const file of files) {
    if (file.endsWith('TagsView.tsx')) continue
    const src = readFileSync(file, 'utf8')
    const code = extractQuotedStrings(src).join('\n')
    for (const banned of BANNED) {
      if (code.includes(banned)) hits.push(`${relative(ROOT, file)}: ${banned}`)
    }
  }
  if (hits.length > 0) {
    errors.push(
      `全站禁止 outline-black / dark:outline-white(选中态描边定稿),命中 ${hits.length} 处:\n    ` +
        hits.join('\n    '),
    )
    console.log(`  \u2717 全站禁纯黑/纯白描边(命中 ${hits.length} 处,见错误详情)`)
  } else {
    console.log('  \u2713 全站禁纯黑/纯白描边(0 命中)')
  }
}

// ─── 汇总 ─────────────────────────────────────────────────
if (errors.length > 0) {
  console.error(
    `\n❌ 选中态描边定稿守门失败(${errors.length} 项),提交已阻止。\n` +
      '   修复方法:恢复主题灰描边定稿(TagsView 用 outline-2 outline-border,' +
      '其他选中态用 outline-1 outline-border),不要用 outline-black / dark:outline-white。\n' +
      '   紧急跳过:HUSKY_SKIP_TAGSVIEW_GUARD=1 git commit ...\n',
  )
  process.exit(1)
} else {
  console.log('  \u2713 选中态描边定稿守门全部通过(主题灰描边 / 定稿 token / 测试断言完整)')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
