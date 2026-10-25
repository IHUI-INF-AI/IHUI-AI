// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 壳承载页的**编译期契约**生成器 —— 为 `@rn-shells/<X>` 与 `@ihui/rn-app/<deep>` 两类
 * 只在 webpack 别名里成立的说明符,派出一份 `.d.ts`(declare module 块),让小程序端的
 * `tsc --noEmit` 也认得它们。
 *
 * 立因(2026-10-26 现读):apps/miniapp-taro/tsconfig.json 的 paths 把这两个别名写成
 * `../../../apps/...`,baseUrl 是本包目录 ⇒ 三级上跳落到**仓库根之外**(D:\apps\...),
 * 于是 6 枚壳承载页一律 TS2307「找不到模块」—— 页面在 tsc 眼里等于 any,编译期契约整格缺失;
 * 而把三级改成两级(真指到源码)实测把整棵 mobile-rn/packages/app 源拖进本包编译项目,
 * 243 → 2742 条错误(用本包的 lib/jsx 档位去编别人的端内源)。两头都不是出路。
 *
 * 正解 = 按"面上真读到的引用 + 壳真读到的出口形态"生成声明:
 *   · 引用集合来自被审面上的小程序页(shellRefsOf / @ihui/rn-app 深路径),不手写、不猜;
 *   · 每个模块的出口形态来自那个壳/屏自己的导出面(shellExportShapeOf),
 *     与门 251 C6 取用形态判据同一把尺子(§0.6);
 *   · 派生件带受管标记,改源头 ⇒ 重新生成;手改 ⇒ 门 251 C9 判红。
 *
 * 用法:
 *   node scripts/gen-rn-shell-types.mjs            # 打印当前计划(不写盘)
 *   node scripts/gen-rn-shell-types.mjs --write    # 按 HEAD 面派生并写回工作树
 *   node scripts/gen-rn-shell-types.mjs --check    # 只判"派生件是否落后"(供门/CI 复用)
 *   node scripts/gen-rn-shell-types.mjs --self-test
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, listFaceFiles, readWorktreeFile } from './lib/face-reader.mjs'
import { shellRefsOf, shellTargetRel, shellExportShapeOf } from './lib/rn-shell-refs.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MP_SRC = 'apps/miniapp-taro/src'
const OUT_REL = 'apps/miniapp-taro/types/rn-shells.generated.d.ts'
export const DECL_BEGIN = '// rn-shell-types:derived:begin —— 由 scripts/gen-rn-shell-types.mjs 从被审面派生(勿手改)'
export const DECL_END = '// rn-shell-types:derived:end'
/** 共享屏深路径引用:@ihui/rn-app/features/<domain>/<Name>Screen(小程序页里那枚 about-shared 用的就是它)。 */
const RN_APP_DEEP_RE = /from\s*['"](@ihui\/rn-app\/[^'"]+)['"]/g

/** 说明符 → 真相源文件(相对仓库根)。认不出的形制返回 null。 */
export function targetOfSpecifier(spec) {
  if (spec.startsWith('@rn-shells/')) return shellTargetRel(spec.slice('@rn-shells/'.length))
  if (spec.startsWith('@ihui/rn-app/')) return `packages/app/src/${spec.slice('@ihui/rn-app/'.length)}.tsx`
  return null
}

/** 一个模块的 declare 块:出口形态完全照壳/屏的现读出口,默认位与具名位各按实有。 */
export function declareBlock({ spec, target, text }) {
  const shape = shellExportShapeOf(text)
  if (!shape.hasDefault && shape.names.size === 0) {
    return { error: `${spec}:真相源 ${target} 现读既无 default 也无具名出口 ⇒ 契约无从生成(该壳本身有问题)` }
  }
  const L = [
    `declare module '${spec}' {`,
    "  import type { ComponentType } from 'react'",
    `  /** 真相源 ${target} —— 0 必填 props 才可被壳承载(造页器 form=shell 的前置)。 */`,
    '  // props 取开放记录档:本契约保证"模块存在且是组件",逐 props 的强弱由源头那一侧的 d.ts 负责',
    "  // (把 paths 直接指到源码去要真类型 = 用本包档位编别人的端内源,实测 243 → 2742 条错,两头都不是出路)。",
  ]
  const CT = 'ComponentType<Record<string, unknown>>'
  if (shape.hasDefault) L.push(`  const Shell: ${CT}`)
  for (const n of [...shape.names].sort()) L.push(`  export const ${n}: ${CT}`)
  if (shape.hasDefault) L.push('  export default Shell')
  L.push('}')
  return { block: L.join('\n') }
}

/** 面上页文本里出现的、本契约射程内的说明符集合(去重排序)。 */
export function specsOfPages(pageTexts) {
  const specs = new Set()
  for (const text of pageTexts) {
    for (const x of shellRefsOf(text ?? '')) specs.add(`@rn-shells/${x}`)
    for (const m of String(text ?? '').matchAll(RN_APP_DEEP_RE)) specs.add(m[1])
  }
  return [...specs].sort()
}

/**
 * 纯判据:给定"页文本集合 + 真相源文本读取器",产出整份声明件正文。
 * 没有任何 IO,便于门与器物共用同一份实现(§0.6)。
 */
export function planDeclarations({ pageTexts, readTarget }) {
  const sorted = specsOfPages(pageTexts)
  const blocks = []
  const undetermined = []
  for (const spec of sorted) {
    const target = targetOfSpecifier(spec)
    if (!target) {
      undetermined.push(`${spec}:说明符形制不在尺子射程内`)
      continue
    }
    const text = readTarget(target)
    if (text === null || text === undefined) {
      undetermined.push(`${spec}:真相源 ${target} 取不到(面上没有这个文件)`)
      continue
    }
    const b = declareBlock({ spec, target, text })
    if (b.error) undetermined.push(b.error)
    else blocks.push(b.block)
  }
  const header = [
    DECL_BEGIN,
    '// 覆盖面 = 面上小程序页真引用的说明符;出口形态 = 各自真相源的现读导出面。',
    '// ⇒ 新增/删除壳承载页后必须重新生成;手改本文件一律算违规(门 251 C9 判红)。',
    '',
  ].join('\n')
  const body = blocks.length > 0 ? blocks.join('\n\n') : ''
  const next = `${header}${body}${body ? '\n' : ''}${DECL_END}\n`
  return { next, modules: sorted, undetermined, blockCount: blocks.length }
}

/** 把生成物里已存在的受管块换掉(保留块外的任何人工内容)。 */
export function applyBlock(current, next) {
  const b = current.indexOf(DECL_BEGIN)
  const e = current.indexOf(DECL_END)
  if (b < 0 || e < 0 || e < b) return next
  return current.slice(0, b) + next.replace(/^\n+/, '').replace(/\n+$/, '') + current.slice(e + DECL_END.length)
}

function headText(rel) {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 24,
    })
  } catch {
    return null
  }
}

/**
 * 面上的小程序页正文(同面同轮,§0.4 + 守门 118):
 * 枚举用 listFaceFiles(工作树档补 --others,新落的页在射程内),正文一律一次 catBatch 批取。
 * 取不到正文的页 ⇒ 显式落未判定(不回落另一个面,也不静默跳过)。
 */
export function facePages(face) {
  let rels
  if (face === 'worktree') {
    rels = execFileSync('git', ['-C', ROOT, 'ls-files', '--others', '--cached', '--', MP_SRC], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter((p) => p.endsWith('.tsx'))
    const map = rels.map((r) => ({ rel: r, text: readWorktreeFile(ROOT, r) }))
    return { texts: map.map((m) => m.text), missing: map.filter((m) => m.text === null).map((m) => m.rel) }
  }
  rels = listFaceFiles(ROOT, face, { paths: [MP_SRC] }).filter((p) => p.endsWith('.tsx'))
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const got = catBatch(ROOT, rels.map((r) => `${prefix}${r}`))
  const texts = rels.map((r) => got.get(`${prefix}${r}`) ?? null)
  return { texts, missing: rels.filter((_, i) => texts[i] === null) }
}

export function collect({ face }) {
  const pages = facePages(face)
  const readTarget = (rel) => (face === 'worktree' ? readWorktreeFile(ROOT, rel) : headText(rel))
  if (pages.missing.length > 0) {
    throw new Error(`面上有 ${pages.missing.length} 枚页取不到正文(面错位,不回落):${pages.missing.slice(0, 3).join(' / ')}`)
  }
  return planDeclarations({ pageTexts: pages.texts, readTarget })
}

function selfTest() {
  const mk = (over = {}) => {
    const face = {
      'apps/mobile-rn/src/screens/DashboardScreen.tsx': 'export function DashboardScreen() {}\n',
      'apps/mobile-rn/src/screens/DomainHubScreen.tsx': 'export default function DomainHubScreen() {}\n',
      'packages/app/src/features/about/AboutScreen.tsx': 'export const AboutScreen = () => null\n',
      ...over,
    }
    return (rel) => face[rel] ?? null
  }
  const read = mk()
  const cases = [
    {
      name: '具名壳 ⇒ 只出具名出口(不造假默认位)',
      want: true,
      got: () =>
        planDeclarations({ pageTexts: [`import { DashboardScreen as S } from '@rn-shells/DashboardScreen'\n`], readTarget: read })
          .next.includes('export const DashboardScreen: ComponentType') &&
        !/declare module '@rn-shells\/DashboardScreen'[\s\S]*export default/.test(
          planDeclarations({ pageTexts: [`import { DashboardScreen as S } from '@rn-shells/DashboardScreen'\n`], readTarget: read }).next,
        ),
    },
    {
      name: '默认壳 ⇒ 出 default 位(照壳真导出)',
      want: true,
      got: () =>
        planDeclarations({ pageTexts: [`import S from '@rn-shells/DomainHubScreen'\n`], readTarget: read }).next.includes('export default Shell'),
    },
    {
      name: '@ihui/rn-app 深路径 ⇒ 落回 packages/app 源',
      want: 'packages/app/src/features/about/AboutScreen.tsx',
      got: () => targetOfSpecifier('@ihui/rn-app/features/about/AboutScreen'),
    },
    {
      name: '真相源不在面上 ⇒ 落未判定清单(不记绿也不冒红)',
      want: 1,
      got: () =>
        planDeclarations({ pageTexts: [`import S from '@rn-shells/Ghost9x'\n`], readTarget: read }).undetermined.length,
    },
    {
      name: '壳无任何出口 ⇒ 点名(契约无从生成)',
      want: 1,
      got: () =>
        planDeclarations({
          pageTexts: [`import { X } from '@rn-shells/EmptyScreen'\n`],
          readTarget: mk({ 'apps/mobile-rn/src/screens/EmptyScreen.tsx': 'const a = 1\n' }),
        }).undetermined.length,
    },
    {
      name: '页面没有壳引用 ⇒ 块数 0 而受管标记仍在(空覆盖面也是一份合法派生件)',
      want: 0,
      got: () => planDeclarations({ pageTexts: ['export default function Plain() { return null }\n'], readTarget: read }).blockCount,
    },
    {
      name: 'applyBlock:块外人写内容保留,块内整段替换',
      want: true,
      got: () => {
        const cur = `// 人工抬头\n${DECL_BEGIN}\n旧内容\n${DECL_END}\n// 人工脚注\n`
        const out = applyBlock(cur, `${DECL_BEGIN}\n新内容\n${DECL_END}\n`)
        return out.startsWith('// 人工抬头') && out.includes('新内容') && !out.includes('旧内容') && out.endsWith('// 人工脚注\n')
      },
    },
  ]
  let pass = 0
  for (const c of cases) {
    let got
    try {
      got = c.got()
    } catch (e) {
      got = `异常 ${e.message}`
    }
    const ok = String(got) === String(c.want)
    if (ok) pass++
    console.log(`${ok ? '✓' : '✗'} ${c.name}(期望 ${JSON.stringify(c.want)},实得 ${JSON.stringify(got)})`)
  }
  console.log(`自检 ${pass}/${cases.length} ${pass === cases.length ? '通过' : '—— 有例不过'}`)
  process.exit(pass === cases.length ? 0 : 1)
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const write = argv.includes('--write')
  const check = argv.includes('--check')
  const face = check ? 'head' : 'worktree'
  let plan
  try {
    plan = collect({ face })
  } catch (e) {
    console.error(`❌ 未判定:${e?.message ?? e}`)
    process.exit(2)
  }
  const abs = join(ROOT, OUT_REL)
  const current = face === 'worktree' ? (existsSync(abs) ? readFileSync(abs, 'utf8') : '') : headText(OUT_REL) ?? ''
  const expected = applyBlock(current, plan.next)
  const stale = expected !== current
  for (const u of plan.undetermined) console.error(`❌ 未判定:${u}`)
  console.log(
    `[gen-rn-shell-types] 面=${face} 覆盖面说明符 ${plan.modules.length} 个 / declare 块 ${plan.blockCount} 段 / 未判定 ${plan.undetermined.length} 条 / 派生件${stale ? '落后(待写回)' : '与源一致'}`,
  )
  if (plan.undetermined.length > 0) process.exit(1)
  if (check) {
    if (stale) {
      console.error(`[gen-rn-shell-types] ❌ 派生件落后于面上引用,请运行: node scripts/gen-rn-shell-types.mjs --write`)
      process.exit(1)
    }
    process.exit(0)
  }
  if (write) {
    if (!stale) console.log('[gen-rn-shell-types] 无变化,不写盘')
    else {
      writeFileSync(abs, expected, 'utf8')
      execFileSync(process.execPath, [join(ROOT, 'scripts/watermark.mjs'), 'inject', abs], {
        encoding: 'utf8',
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      console.log(`[gen-rn-shell-types] ✅ 已写回 ${OUT_REL}(${statSync(abs).size} 字节,含水印注入)`)
    }
    process.exit(0)
  }
  console.log('—— 当前派生件正文 ——')
  console.log(plan.next)
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
export const __test__ = { planDeclarations, declareBlock, applyBlock, targetOfSpecifier, specsOfPages, collect, OUT_REL, DECL_BEGIN, DECL_END }
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
