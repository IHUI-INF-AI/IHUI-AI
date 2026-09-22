#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-adapter-wiring.mjs — miniapp-taro 适配层「未接线即拦」守门(2026-09-22 立,P2-F.5 配套)。
 *
 * 背景:adapters/ 下 18 个 `.taro.tsx` 中的 9 个屏级适配器(共 3078 行)从写下到删除
 *       始终零页面引用 —— 既有 `check-adapter-style-parity.mjs` 只守硬编码颜色,
 *       不守「是否被 import」,所以「造好没装车」这种死代码此前无闸可挡。
 *
 * 判据:每个 `apps/miniapp-taro/src/components/adapters/<Name>.taro.tsx` 的组件名
 *       必须出现在 adapters 目录**之外**某个源文件的 import/export-from 子句中。
 *       只认 import 子句:注释里写「对齐 RN SettingsScreen」不算接线。
 *       存量未接线项记入 `scripts/adapter-wiring-baseline.json` 放行(只减不增),
 *       新增未接线适配器即 BLOCK —— 与 check-adapter-style-parity.mjs 同一基线模式。
 *
 * 校验内容:
 *   RULE-1 (BLOCK): 出现基线之外的新增未接线适配器(必须接线或删除,不得留死代码)。
 *   RULE-2 (WARN) : 基线中已不存在的条目(已接线或已删除,建议 --update-baseline 收紧)。
 *
 * 退出码:0 = 通过(含 WARN);1 = 出现 BLOCK 级失败(阻塞)。
 *
 * 用法:
 *   node scripts/check-adapter-wiring.mjs                  # 全量校验
 *   node scripts/check-adapter-wiring.mjs --update-baseline # 接线/删除后收紧基线
 *   node scripts/check-adapter-wiring.mjs --quiet           # 仅输出失败
 *   node scripts/check-adapter-wiring.mjs --self-test       # 内建判据逻辑自检
 *   node scripts/check-adapter-wiring.mjs --help            # 帮助
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ADAPTERS_DIR = join(ROOT, 'apps', 'miniapp-taro', 'src', 'components', 'adapters')
const SRC_DIR = join(ROOT, 'apps', 'miniapp-taro', 'src')
const BASELINE_PATH = join(ROOT, 'scripts', 'adapter-wiring-baseline.json')

const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
const updateBaseline = argv.includes('--update-baseline')
const wantHelp = argv.includes('--help') || argv.includes('-h')

/**
 * 从一段源码里提取**从适配层路径** import/export-from 子句中被命名的绑定(含 type import)。
 * 必须限定 specifier 含 `adapters`:端内存在同名自有组件(如 `components/NavBar.tsx`),
 * 若不限定,`import { NavBar } from '@/components/NavBar'` 会被误判为适配器已接线(假阳性放过死代码)。
 */
function extractAdapterBindings(code) {
  const bindings = new Set()
  const clauseRe =
    /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
  for (const m of code.matchAll(clauseRe)) {
    if (!m[2].includes('adapters')) continue
    for (const raw of m[1].split(',')) {
      const name = raw
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim()
      if (name) bindings.add(name)
    }
  }
  // 默认导入:`import Foo from '...adapters...'`
  const defaultRe = /import\s+([A-Z][\w]*)\s+from\s*['"]([^'"]*adapters[^'"]*)['"]/g
  for (const m of code.matchAll(defaultRe)) bindings.add(m[1])
  return bindings
}

/** 递归收集目录下所有 .ts/.tsx 源文件(排除 .d.ts)。 */
function collectSourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectSourceFiles(full))
    else if (/\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * 计算未接线适配器清单。
 * @returns {{ wired: string[], unwired: string[], adapters: string[] }}
 */
export function analyzeAdapterWiring({ adaptersDir = ADAPTERS_DIR, srcDir = SRC_DIR } = {}) {
  const adapters = readdirSync(adaptersDir)
    .filter((n) => n.endsWith('.taro.tsx'))
    .map((n) => n.replace(/\.taro\.tsx$/, ''))
    .sort()

  // 只看 adapters 目录之外的源码文件(barrel 自身不算消费者)
  const consumers = collectSourceFiles(srcDir).filter((f) => !f.startsWith(adaptersDir))

  const externalBindings = new Set()
  for (const file of consumers) {
    for (const name of extractAdapterBindings(readFileSync(file, 'utf8'))) {
      externalBindings.add(name)
    }
  }

  const wired = []
  const unwired = []
  for (const name of adapters) {
    // 组件名本身、或其 Props 类型被外部 import,都算接线
    if (externalBindings.has(name) || externalBindings.has(`${name}Props`)) wired.push(name)
    else unwired.push(name)
  }
  return { wired, unwired, adapters }
}

/** 读基线;不存在时按空集处理。 */
function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return []
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  return Array.isArray(parsed.unwiredAdapters) ? parsed.unwiredAdapters.sort() : []
}

function main() {
  if (wantHelp) {
    console.log(
      '用法: node scripts/check-adapter-wiring.mjs [--update-baseline|--quiet|--self-test|--help]'
    )
    return 0
  }
  if (!existsSync(ADAPTERS_DIR)) {
    console.warn('[check-adapter-wiring] adapters 目录不存在,跳过')
    return 0
  }

  const { wired, unwired, adapters } = analyzeAdapterWiring()
  const baseline = readBaseline()

  if (updateBaseline) {
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify({ unwiredAdapters: [...unwired].sort() }, null, 2)}\n`,
      'utf8'
    )
    console.log(`✅ 基线已收紧:${unwired.length} 个未接线条目写入 ${relative(ROOT, BASELINE_PATH)}`)
    return 0
  }

  if (!quiet) {
    console.log('[check-adapter-wiring] adapter 层接线基线守门...')
    console.log(
      `  适配器 ${adapters.length} 个 | 已接线 ${wired.length} | 未接线 ${unwired.length}`
    )
  }

  const added = unwired.filter((n) => !baseline.includes(n))
  const stale = baseline.filter((n) => !unwired.includes(n))

  if (added.length) {
    console.error(`\n❌ RULE-1 (BLOCK) 新增未接线适配器 ${added.length} 个:`)
    for (const n of added) console.error(`   - components/adapters/${n}.taro.tsx 无任何页面引用`)
    console.error('\n💡 适配层只允许「写了就有人用」:')
    console.error('   1) 在页面里 import { ' + added[0] + " } from '@/components/adapters' 接线;")
    console.error('   2) 或确认端内已有自有实现 → 删除该适配器(先按 AGENTS.md §7 三问)')
    console.error('   紧急跳过: HUSKY_SKIP_ADAPTER_WIRING=1 git commit ...\n')
    return 1
  }

  console.log(
    `[PASS] RULE-1: 无新增未接线适配器(存量 ${unwired.length} 处基线内放行,只减不增)`
  )
  if (stale.length) {
    console.warn(`⚠️  RULE-2: 基线中已不存在的条目 ${stale.length} 个: ${stale.join(', ')}`)
    console.warn('   已接线或已删除,建议 node scripts/check-adapter-wiring.mjs --update-baseline')
  }
  return 0
}

/** 内建自检:判据逻辑不依赖真实仓库,验证「只有从 adapters 路径 import 才算接线」。 */
export function __selfTest() {
  const results = []
  const assert = (label, got, want) => {
    results.push({ label, ok: got === want, got, want })
  }
  const names = (code) => [...extractAdapterBindings(code)].sort().join(',')
  assert(
    'barrel 具名 import 算接线',
    names("import { SectionHeader } from '@/components/adapters'"),
    'SectionHeader'
  )
  assert(
    'type import 算接线',
    names("import type { SelecterProps } from '@/components/adapters'"),
    'SelecterProps'
  )
  assert('as 别名取原名', names('import { TabBar as TB } from "./adapters"'), 'TabBar')
  assert(
    '默认导入(含 adapters 路径)算接线',
    names("import PayButton from '@/components/adapters/PayButton.taro'"),
    'PayButton'
  )
  assert(
    '端内同名自有组件的 import 不算适配器接线(防假阳性)',
    names("import { NavBar } from '@/components/NavBar'"),
    ''
  )
  assert(
    '注释里的组件名不算接线',
    names('const x = 1 // 对齐 RN SettingsScreen 的 container'),
    ''
  )
  assert(
    'JSX 注释里的组件名不算接线',
    names('{/* 对齐 RN MessageCenterScreen listBody */}\nexport default function P(){return null}'),
    ''
  )
  const bad = results.filter((r) => !r.ok)
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.label}${r.ok ? '' : ` got=${r.got} want=${r.want}`}`)
  }
  return bad.length === 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (argv.includes('--self-test')) {
    process.exit(__selfTest() ? 0 : 1)
  }
  Promise.resolve(main())
    .then((code) => process.exit(code ?? 0))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

// AGENTS.md §22c:暴露核心判据给测试文件直接 import(不做镜像常量复制)
export const __test__ = {
  extractAdapterBindings,
  analyzeAdapterWiring,
  selfTest: __selfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
