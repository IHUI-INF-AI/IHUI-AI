#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 登记表层别漂移(advisory ratchet,2026-11-08 立)
 *
 * ## 治的是什么
 *
 * `scripts/data/web-rn-screen-map.jsonl` 只记 web 路由 ↔ RN 壳路径。按路径判层时,
 * `apps/mobile-rn/src/screens/Xxx.tsx` 这种壳文件天然被读成"端侧各自实现";
 * 但其中一批壳正文已经 `import @ihui/rn-app/...` 并渲染共享 `*Screen` —— 它们其实是
 * **已委托**,不是自实现。这个偏差会让人把已经接好的屏再抽一遍,是最贵的一类重复劳动。
 *
 * 本门只做一件事:**读壳正文**,把"路径会判成自实现、正文其实已委托"的行逐条列出。
 *
 * ## 为什么先 advisory 不判红
 *
 * 层别判定还只有"壳正文 import 共享 *Screen"这一条可机器复现的判据;等清单稳定、
 * 且共享屏命名/导出面收敛后再谈 blocking。当前默认永远 exit 0,`--gate` 只给未来
 * 升阻断时留一个口(有漂移才 exit 1),不进守门批。
 *
 * ## 取材面(§0.4 同口径)
 *
 *   默认       = HEAD blob(`HEAD:<path>`),提交进仓的那一份;
 *   `--worktree` = 磁盘工作树,人工逃生舱;
 *   两面同给 ⇒ exit 2「未判定」;取不到壳正文 ⇒ 单独计入 `unreadable`,不记绿。
 *
 * ## 用法
 *
 *   node scripts/check-registry-layer-drift.mjs            # 汇总(advisory, exit 0)
 *   node scripts/check-registry-layer-drift.mjs --list     # 逐条清单
 *   node scripts/check-registry-layer-drift.mjs --json     # 机器可读
 *   node scripts/check-registry-layer-drift.mjs --gate     # 未来阻断档:有漂移 exit 1
 *   node scripts/check-registry-layer-drift.mjs --self-test
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { catBatch } from './lib/face-reader.mjs'

const ROOT = process.cwd()
const MAP_PATH = 'scripts/data/web-rn-screen-map.jsonl'
const argv = process.argv.slice(2)
const worktreeMode = argv.includes('--worktree')
const gate = argv.includes('--gate')
const listMode = argv.includes('--list')
const jsonMode = argv.includes('--json')
const selfTestMode = argv.includes('--self-test')
if (worktreeMode && argv.includes('--staged')) {
  console.error('❌ 未判定:--staged 与 --worktree 同给,取材面不明(§0.4)')
  process.exit(2)
}
const FACE = worktreeMode ? 'worktree' : 'head'
const revOf = (rel) => (FACE === 'worktree' ? rel : `HEAD:${rel}`)

/** 读一批仓库相对路径;HEAD 面走同一次 cat-file --batch,取不到归 null(不静默记绿)。 */
function readBatch(rels) {
  const map = new Map()
  const uniq = [...new Set(rels.filter(Boolean))]
  if (uniq.length === 0) return map
  if (FACE === 'worktree') {
    for (const rel of uniq) {
      try {
        map.set(rel, readFileSync(join(ROOT, rel), 'utf8'))
      } catch {
        map.set(rel, null)
      }
    }
    return map
  }
  const got = catBatch(ROOT, uniq.map(revOf), { maxBuffer: 512 * 1024 * 1024 })
  for (const rel of uniq) map.set(rel, got.get(revOf(rel)) ?? null)
  return map
}

const IMPORT_RE =
  /import\s+(?:type\s+)?(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]/g

/** 从 import 子句里取绑定名(默认/命名/别名都收;`type` 前缀剥掉)。 */
function importedNames(clause) {
  const out = []
  const raw = String(clause ?? '').trim()
  const braced = raw.match(/\{([\s\S]*)\}/)
  if (braced) {
    for (const part of braced[1].split(',')) {
      const seg = part.trim()
      if (!seg) continue
      const name = seg
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name) out.push(name)
    }
  }
  const head = raw.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim()
  for (const seg of head.split(/\s+/)) {
    const name = seg.split(/\s+as\s+/).pop()
    if (name && name !== '' && !name.startsWith('*')) out.push(name)
  }
  return out
}

const isSharedSpec = (spec) => spec.startsWith('@ihui/rn-app') || spec.startsWith('packages/app/src')

/**
 * 壳正文里"已委托"的唯一判据:import 了共享模块里的 `*Screen` 绑定,并且**在 JSX 里渲染它**。
 * 只 import 不渲染(类型、常量、局部组件)不算委托,避免把"引了共享工具"误记成"接了共享屏"。
 */
export function sharedScreenOf(text) {
  const src = String(text ?? '')
  const symbols = []
  for (const m of src.matchAll(IMPORT_RE)) {
    if (!isSharedSpec(m[2])) continue
    for (const name of importedNames(m[1])) symbols.push({ name, spec: m[2] })
  }
  const screens = symbols.filter((s) => /^[A-Z][A-Za-z0-9]*Screen$/.test(s.name))
  const rendered = screens.filter((s) => new RegExp(`<\\s*${s.name}[\\s/>]`).test(src))
  return { screens, rendered }
}

/** 路径判据会读成"端侧自实现"的壳:RN 应用内文件,不在 packages/app 共享层。 */
function isRnShellPath(p) {
  return typeof p === 'string' && /^apps\/[^/]+\/src\//.test(p) && !p.startsWith('apps/web/')
}

function loadMap() {
  const text = readBatch([MAP_PATH]).get(MAP_PATH)
  if (typeof text !== 'string') {
    console.error(`❌ 未判定:取不到 ${MAP_PATH}(${FACE} 面)`)
    process.exit(2)
  }
  const rows = []
  for (const [i, line] of text.split('\n').entries()) {
    if (!line.trim()) continue
    try {
      rows.push({ ...JSON.parse(line), __line: i + 1 })
    } catch (e) {
      console.error(`❌ 未判定:${MAP_PATH}:${i + 1} 不是合法 JSON(${e.message})`)
      process.exit(2)
    }
  }
  return rows
}

export function analyze(rows, read = readBatch) {
  const aligned = rows.filter((r) => r.status === 'aligned' || r.status === 'pending')
  const shells = aligned.filter((r) => isRnShellPath(r.rn))
  const texts = read(shells.map((r) => r.rn))
  const drift = []
  const unreadable = []
  for (const r of shells) {
    const text = texts.get(r.rn)
    if (typeof text !== 'string') {
      unreadable.push({ route: r.web, rn: r.rn, line: r.__line })
      continue
    }
    const { rendered } = sharedScreenOf(text)
    if (rendered.length > 0) {
      drift.push({
        route: r.web,
        rn: r.rn,
        line: r.__line,
        symbols: [...new Set(rendered.map((s) => s.name))],
      })
    }
  }
  return {
    face: FACE,
    mapRows: rows.length,
    alignedRows: aligned.length,
    sharedPathRows: aligned.length - shells.length,
    rnShellRows: shells.length,
    delegatedShells: drift.length,
    unreadable: unreadable.length,
    drift,
    unreadableRows: unreadable,
  }
}

function selfTest() {
  const cases = [
    {
      want: true,
      text: "import { FooScreen } from '@ihui/rn-app/features/foo/FooScreen'\nexport default () => <FooScreen />",
    },
    {
      want: false,
      text: "import { FooScreen } from '@ihui/rn-app/features/foo/FooScreen'\nexport const x = FooScreen",
    },
    {
      want: false,
      text: "import { helper } from '@ihui/rn-app/lib/helper'\nexport default () => <View />",
    },
    {
      want: false,
      text: "import { Foo } from '@ihui/ui-react'\nexport default () => <Foo />",
    },
  ]
  const bad = []
  for (const [i, c] of cases.entries()) {
    const got = sharedScreenOf(c.text).rendered.length > 0
    if (got !== c.want) bad.push(`case${i + 1}: want ${c.want} got ${got}`)
  }
  const rows = [
    { web: 'a', rn: 'apps/mobile-rn/src/screens/AScreen.tsx', status: 'aligned', __line: 1 },
    { web: 'b', rn: 'packages/app/src/features/b/BScreen.tsx', status: 'aligned', __line: 2 },
    { web: 'c', rn: 'apps/mobile-rn/src/screens/CScreen.tsx', status: 'excluded', __line: 3 },
  ]
  const texts = new Map([
    ['apps/mobile-rn/src/screens/AScreen.tsx', cases[0].text],
  ])
  const got = analyze(rows, (paths) => {
    const m = new Map()
    for (const p of paths) {
      if (texts.has(p)) m.set(p, texts.get(p))
      else m.set(p, 'export default () => null')
    }
    return m
  })
  if (got.delegatedShells !== 1) bad.push(`analyze drift 期望 1,实得 ${got.delegatedShells}`)
  if (got.sharedPathRows !== 1) bad.push(`analyze sharedPathRows 期望 1,实得 ${got.sharedPathRows}`)
  if (bad.length) {
    console.error('❌ self-test 失败:\n' + bad.join('\n'))
    process.exit(1)
  }
  console.log('✅ self-test 通过(4 个正文判据 + 2 个分档断言)')
}

if (selfTestMode) {
  selfTest()
  process.exit(0)
}

const rows = loadMap()
const out = analyze(rows)

if (jsonMode) {
  console.log(JSON.stringify(out, null, 2))
} else {
  console.log(
    `[registry-layer-drift] 面=${FACE} 登记行=${out.mapRows} 已对账=${out.alignedRows} ` +
      `(共享路径行 ${out.sharedPathRows} / RN 壳行 ${out.rnShellRows})`,
  )
  console.log(
    `  路径判据会读成"自实现"、正文其实已委托共享屏:${out.delegatedShells} 条` +
      (out.unreadable ? ` / 壳正文取不到 ${out.unreadable} 条(未判定,不记绿)` : ''),
  )
  if (listMode && out.drift.length) {
    console.log('\n  逐条(route | rn | 共享屏符号 | 登记表行号):')
    for (const d of out.drift) {
      console.log(`  - ${d.route} | ${d.rn} | ${d.symbols.join(', ')} | 第 ${d.line} 行`)
    }
  }
  if (out.unreadableRows.length && listMode) {
    console.log('\n  取不到正文(未判定):')
    for (const u of out.unreadableRows) console.log(`  - ${u.route} | ${u.rn} | 第 ${u.line} 行`)
  }
  console.log(
    `\n  档=advisory(只报数,${gate ? '--gate 已给:有漂移 exit 1' : 'exit 0'})`,
  )
}

if (gate && out.delegatedShells > 0) process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
