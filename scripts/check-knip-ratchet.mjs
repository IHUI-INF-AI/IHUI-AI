#!/usr/bin/env node
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * Knip 棘轮门禁(ratchet)。
 *
 * 背景(2026-09-10 立):
 *   仓库历史死代码债规模很大(实测约 1000+ 未引用文件 / 1500+ 未用导出 / 1200+ 未用导出类型),
 *   外加框架装载型依赖(Taro plugin-*、@capacitor/*、expo-*、pino-pretty、tailwindcss-*、
 *   babel preset 等)全靠配置文件加载,knip 无法静态看到 → 结构性误报。
 *   直接 `knip`(发现问题即 exit 1)的结果是:门禁长期恒红、零信号,真实的新增死代码被淹没在
 *   历史噪声里。而一次性清空 1000+ 文件既有误删动态入口(Next route handler / Taro 页面 /
 *   扩展 entrypoints)的风险,也远超单次改动范围。
 *
 *   故改为「棘轮」:不要求一次清零历史债,但**禁止新增**。
 *     - 当前各项计数 <= 基线 → 通过(exit 0),并提示可收紧基线;
 *     - 任一项 > 基线 → 失败(exit 1),打印增量明细与修复指引。
 *
 * 用法:
 *   node scripts/check-knip-ratchet.mjs             # 校验(CI 用)
 *   node scripts/check-knip-ratchet.mjs --update    # 用当前状态重写 knip-baseline.json(收紧基线)
 *   node scripts/check-knip-ratchet.mjs --print     # 只打印当前计数,不校验、不写基线
 *
 * 环境变量:
 *   KNIP_RATCHET_TOLERANCE   每类允许的容差(默认 0)。仅在确认跨平台计数抖动时临时放宽。
 *
 * 说明:计数取自 `knip --reporter json` 的 issues 聚合,与终端报告的分节数字同源。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const BASELINE_PATH = join(ROOT, 'knip-baseline.json')
const KNIP_BIN = join(ROOT, 'node_modules', 'knip', 'bin', 'knip.js')

// 与 knip json reporter 的 issue 字段一一对应;顺序即输出顺序
const CATEGORIES = [
  'files',
  'exports',
  'types',
  'duplicates',
  'enumMembers',
  'namespaceMembers',
  'dependencies',
  'devDependencies',
  'optionalPeerDependencies',
  'unlisted',
  'binaries',
  'unresolved',
]

const CATEGORY_LABEL = {
  files: '未引用文件',
  exports: '未用导出',
  types: '未用导出类型',
  duplicates: '重复导出',
  enumMembers: '未用枚举成员',
  namespaceMembers: '未用命名空间成员',
  dependencies: '未用依赖',
  devDependencies: '未用开发依赖',
  optionalPeerDependencies: '未用可选 peer 依赖',
  unlisted: '未声明依赖',
  binaries: '未声明二进制',
  unresolved: '无法解析的导入',
}

function runKnipJson() {
  if (!existsSync(KNIP_BIN)) {
    console.error(`[knip-ratchet] ❌ 未找到 knip:${KNIP_BIN}(请先 pnpm install)`)
    process.exit(2)
  }
  const result = spawnSync(process.execPath, [KNIP_BIN, '--reporter', 'json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    // 保持与本仓库其它守门脚本一致的删除守护豁免(pnpm/knip 内部可能创建临时目录)
    env: { ...process.env, CODEBUDDY_SAFE_DELETE_ENABLED: '0' },
  })
  if (result.error) {
    console.error(`[knip-ratchet] ❌ 无法启动 knip:${result.error.message}`)
    process.exit(2)
  }
  const stdout = result.stdout ?? ''
  const start = stdout.indexOf('{')
  if (start < 0) {
    console.error('[knip-ratchet] ❌ knip 未产出 JSON。stderr 摘要:')
    console.error((result.stderr ?? '').slice(0, 2000))
    process.exit(2)
  }
  try {
    return JSON.parse(stdout.slice(start))
  } catch (e) {
    console.error(`[knip-ratchet] ❌ knip JSON 解析失败:${e.message}`)
    process.exit(2)
  }
}

function countByCategory(report) {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]))
  for (const issue of report.issues ?? []) {
    for (const c of CATEGORIES) {
      const arr = issue[c]
      if (Array.isArray(arr)) counts[c] += arr.length
    }
  }
  return counts
}

function total(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

const args = new Set(process.argv.slice(2))
const tolerance = Number.parseInt(process.env.KNIP_RATCHET_TOLERANCE ?? '0', 10) || 0

const counts = countByCategory(runKnipJson())
const currentTotal = total(counts)

if (args.has('--print')) {
  console.log(`[knip-ratchet] 当前计数 total=${currentTotal}`)
  for (const c of CATEGORIES) console.log(`  ${c.padEnd(24)} ${counts[c]}`)
  process.exit(0)
}

if (args.has('--update') || !existsSync(BASELINE_PATH)) {
  const isInit = !existsSync(BASELINE_PATH)
  const payload = {
    // 说明:这是「允许存在的历史债上限」。只允许通过修复来收紧(重新 --update),
    // 不允许为了过门禁而放大——放大会在 PR 审查中被看见。
    note: 'Knip 棘轮基线:各项计数不得超过此值。新增死代码会使 CI 失败;清理后请重跑 --update 收紧。',
    generatedAt: new Date().toISOString(),
    total: currentTotal,
    counts,
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(
    `[knip-ratchet] ${isInit ? '已初始化' : '已更新'}基线 → knip-baseline.json(total=${currentTotal})`,
  )
  console.log('[knip-ratchet] 请把该文件一并提交(它是门禁的一部分)。')
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
const baseCounts = baseline.counts ?? {}

console.log('[knip-ratchet] 类别             当前    基线    增量')
let regressions = []
for (const c of CATEGORIES) {
  const cur = counts[c] ?? 0
  const base = baseCounts[c] ?? 0
  const delta = cur - base
  const flag = delta > tolerance ? ' ❌' : ''
  console.log(
    `[knip-ratchet] ${c.padEnd(22)} ${String(cur).padStart(5)} ${String(base).padStart(7)} ${String(
      delta >= 0 ? `+${delta}` : delta,
    ).padStart(7)}${flag}`,
  )
  if (delta > tolerance) regressions.push({ c, cur, base, delta })
}

if (regressions.length > 0) {
  console.error('')
  console.error(
    `[knip-ratchet] ❌ 检出新增死代码/依赖问题(共 ${regressions.length} 类超出基线,容差 ${tolerance}):`,
  )
  for (const r of regressions) {
    console.error(
      `[knip-ratchet]    · ${CATEGORY_LABEL[r.c] ?? r.c}(${r.c}):${r.base} → ${r.cur} (+${r.delta})`,
    )
  }
  console.error('[knip-ratchet]    修复:删除/内联相关死代码,或为框架装载型依赖补充 knip.jsonc 的')
  console.error('[knip-ratchet]    ignoreDependencies / ignoreBinaries(附理由)。')
  console.error(
    '[knip-ratchet]    确属有意引入且无法消除者:node scripts/check-knip-ratchet.mjs --update',
  )
  console.error('[knip-ratchet]    收紧基线并提交(该动作会出现在 diff 中,便于审查)。')
  process.exit(1)
}

console.log('')
console.log(
  `[knip-ratchet] ✅ 未超过基线(total ${currentTotal} ≤ ${baseline.total ?? '?'};容差 ${tolerance})`,
)
if (currentTotal < (baseline.total ?? Number.POSITIVE_INFINITY)) {
  console.log(
    `[knip-ratchet] 💡 已低于基线 ${(baseline.total ?? 0) - currentTotal} 项,可运行 --update 收紧基线。`,
  )
}
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
