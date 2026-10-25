#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 器物为 CLI 工具,需打印逐处台账 */
/**
 * fix-rn-color-literals.mjs —— 把「已经等于某枚源档」的 RN 色值字面量改成源档取用
 *
 * 为什么这一格值得自动化(而不是继续人抄):
 * 上一票把 tokens.css 的 174 档派生进 rn-tokens.ts 的受管块(守门 254),端内**终于有档可走**;
 * 但存量 45 处(现读)仍写着 `rgba(0,0,0,0.5)` 这类字面量 —— 源里改值它们不会跟着动,
 * 这正是"web 改一处 RN 不动"的残留面。逐处人改 = 最大化增加开发,与目标相反。
 *
 * 只做**可证等价**的那一档(其余一律进队列,不猜):
 *   S1 位置 = 对象字面量的属性值(StyleSheet.create / 内联 style 的键值),不动 JSX 文本与函数实参;
 *   S2 值 = 覆盖面块里某档,且该档 **light === dark**(明暗同值 ⇒ 静态取用与原字面量同形,不引入主题回归);
 *      明暗不同的档只在"该文件里已有主题符号在作用域"时才换,否则进 needs-theme 队列;
 *   S3 键唯一(同值多档 ⇒ 歧义,不择一,交人工命名);
 *   S4 写前逐处断言 `colorsAgree(原字面量, 档值)`,不成立即整批不落;
 *   S5 桶口已有的 `@ihui/design-tokens` import 只增名字,不新增第二条 import(实测 45/45 文件已 import 该包)。
 *
 * 面(§0.4):--report/--check 判 HEAD blob;--apply 只写工作树(紧接着由调用方落 HEAD)。
 * 用法:node scripts/fix-rn-color-literals.mjs [--report|--apply|--json]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import ts from 'typescript'

import { catBatch } from './lib/face-reader.mjs'
import { __test__ as tok93 } from './check-cross-end-tokens.mjs'
import { __test__ as syncTok } from './sync-rn-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_FACES = ['apps/mobile-rn/src', 'packages/app/src']
const PKG_IMPORT = '@ihui/design-tokens'

const argv = process.argv.slice(2)
const git = (args, input) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    input,
  })

/** 建"归一色值 → 候选档"表:覆盖面块优先(它就是源),再补 RN 表里已有的同名同值档。 */
function buildIndex(rnText, cssText) {
  const tables = syncTok.readTokenTables(cssText)
  const pal = syncTok.planPalette({ rnText, light: tables.light, dark: tables.dark })
  const byNorm = new Map()
  for (const e of pal.entries) {
    const rec = { key: e.key, light: e.light, dark: e.dark, same: tok93.normalizeColor(e.light) === tok93.normalizeColor(e.dark) }
    const n = tok93.normalizeColor(e.light)
    if (!byNorm.has(n)) byNorm.set(n, [])
    byNorm.get(n).push(rec)
  }
  return { byNorm, paletteSize: pal.entries.length }
}

/** 列出对象字面量属性值位置上的色值字面量(纯 AST,不正则扫全文)。 */
function sitesOf(rel, src, byNorm) {
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out = []
  const walk = (node) => {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.initializer)) {
      const raw = node.initializer.text
      if (/^(#[0-9a-fA-F]{3,8}$|rgba?\(|hsla?\()/.test(raw.trim())) {
        const cands = byNorm.get(tok93.normalizeColor(raw))
        if (cands && cands.length > 0) {
          const amb = cands.length > 1
          const pick = cands[0]
          const needsTheme = !pick.same
          out.push({
            rel,
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            raw,
            key: pick.key,
            value: pick.light,
            same: pick.same,
            ambiguous: amb,
            candCount: cands.length,
            needsTheme,
            start: node.initializer.getStart(sf),
            end: node.initializer.getEnd(),
          })
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
  return out
}

/** 把 `rnCssLight` 追加进文件已有的 @ihui/design-tokens 具名 import(实测 45/45 文件已 import 该包)。 */
export function ensureImport(src, names) {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${PKG_IMPORT.replace('/', '\\/')}['"]`)
  const m = re.exec(src)
  if (!m) return { ok: false, why: '该文件没有 @ihui/design-tokens 的具名 import(不自动新建第二条,交人工)' }
  const have = new Set(m[1].split(',').map((s) => s.trim().replace(/^type\s+/, '')).filter(Boolean))
  const add = names.filter((n) => !have.has(n))
  if (add.length === 0) return { ok: true, src, added: [] }
  if (m[1].includes('\n')) {
    // 已经是多行 import:照最后一项的缩进插行。把多行折成一行会顶穿 printWidth(格式红),
    // 不取缩进则插出第 0 列的名字(prettier 同样判红)。
    const lines = m[0].split('\n')
    const closeAt = lines.findIndex((l) => /^\s*\}/.test(l))
    if (closeAt <= 0) return { ok: false, why: '多行 import 里找不到收尾的 `}` 或前一项,不猜结构' }
    const indent = /^\s*/.exec(lines[closeAt - 1])?.[0] ?? '  '
    lines.splice(closeAt, 0, ...add.map((n) => `${indent}${n},`))
    const nextSrc = src.replace(m[0], lines.join('\n'))
    if (nextSrc === src) return { ok: false, why: '多行 import 插入未生效' }
    return { ok: true, src: nextSrc, added: add }
  }
  // 单行形态:括号内侧必须留一个空格,prettier 的写法是 `{ a, b }`;贴死 `}` 会让下一枚提交吃一条格式红
  const inner = m[1].trim().replace(/\s*,\s*$/, '').trim()
  const nextList = [inner, ...add].filter(Boolean).join(', ')
  const nextSrc = src.replace(m[0], `import { ${nextList} } from '${PKG_IMPORT}'`)
  return { ok: true, src: nextSrc, added: add }
}

/** 对一枚文件做替换(倒序改,避免偏移失效);任一断言不过 ⇒ 整个文件不落。 */
export function rewriteFile(src, sites) {
  const ordered = [...sites].sort((a, b) => b.start - a.start)
  let next = src
  for (const s of ordered) {
    if (!tok93.colorsAgree(s.raw, s.value)) return { ok: false, why: `第 ${s.line} 行原值与档值不同色,拒绝改写` }
    const expr = `rnCssLight.${s.key}`
    next = `${next.slice(0, s.start)}${expr}${next.slice(s.end)}`
  }
  const imp = ensureImport(next, ['rnCssLight'])
  if (!imp.ok) return { ok: false, why: imp.why }
  return { ok: true, src: imp.src, added: imp.added, count: ordered.length }
}

function collect(face) {
  const files = SCAN_FACES.flatMap((d) =>
    (face === 'worktree'
      ? git(['ls-files', '--', d])
      : git(['ls-tree', '-r', '--name-only', face === 'staged' ? '--' : 'HEAD', '--', d])
    )
      .split('\n')
      .filter((p) => /\.(tsx|ts)$/.test(p)),
  )
  const contents = new Map()
  if (face === 'worktree') for (const r of files) contents.set(r, readFileSync(join(ROOT, r), 'utf8'))
  else {
    const prefix = face === 'staged' ? ':' : 'HEAD:'
    for (let i = 0; i < files.length; i += 300) {
      const chunk = files.slice(i, i + 300)
      const got = catBatch(ROOT, chunk.map((r) => `${prefix}${r}`))
      for (const r of chunk) contents.set(r, String(got.get(`${prefix}${r}`) ?? ''))
    }
  }
  const rnText = String(contents.get(syncTok.RN_TOKENS_REL) ?? git(['show', `${prefix0(face)}${syncTok.RN_TOKENS_REL}`]))
  const cssText = git(['show', `${prefix0(face)}${syncTok.TOKENS_SOURCE_REL}`])
  const { byNorm, paletteSize } = buildIndex(rnText, cssText)
  const all = []
  for (const r of files) all.push(...sitesOf(r, contents.get(r) ?? '', byNorm))
  return { all, paletteSize, contents }
}
function prefix0(face) {
  return face === 'staged' ? ':' : 'HEAD:'
}

function splitBuckets(all) {
  const safe = all.filter((s) => !s.ambiguous && !s.needsTheme)
  const ambiguous = all.filter((s) => s.ambiguous)
  const needsTheme = all.filter((s) => !s.ambiguous && s.needsTheme)
  return { safe, ambiguous, needsTheme }
}

/** 自检:全内存夹具,零写盘、零真仓依赖;S1-S5 五条口径各有正反例。 */
function selfTest() {
  const RN = `export type RnThemeMode = 'light' | 'dark'
export const rnTokens = {
  brand: { DEFAULT: '#000000' },
}
export const rnLightTokens = {
  brand: { DEFAULT: '#000000' },
}
export const rnDarkTokens = {
  brand: { DEFAULT: '#FFFFFF' },
}
`
  const CSS = `@theme {
  --color-black-50: rgba(0,0,0,0.5);
  --color-card: #FFFFFF;
  --color-surface-alt: #FFFFFF;
  --color-gold: #FFD700;
}
.dark {
  --color-gold: #DAA520;
}
`
  const results = []
  const ok = (name, cond) => results.push(`${cond ? '✅' : '❌'} ${name}`)
  let idx
  try {
    idx = buildIndex(RN, CSS)
  } catch (e) {
    console.error(`❌ 未判定:夹具被真判据拒收 —— ${String(e?.message ?? e).slice(0, 160)}`)
    process.exit(2)
  }
  ok('T0 夹具建索引成功且有档', idx.paletteSize > 0 && idx.byNorm.size > 0)
  const black = idx.byNorm.get(tok93.normalizeColor('rgba(0,0,0,0.5)')) ?? []
  const gold = idx.byNorm.get(tok93.normalizeColor('#FFD700')) ?? []
  ok('T1 明暗同值档标 same、明暗异值档不标', black.some((r) => r.same) && gold.length > 0 && gold.every((r) => !r.same))

  const srcHit = `import { tokens } from '@ihui/design-tokens'
const styles = StyleSheet.create({ scrim: { backgroundColor: 'rgba(0,0,0,0.5)' } })
`
  const sites = sitesOf('a.tsx', srcHit, idx.byNorm)
  ok('T2 对象位的同值字面量进射程(S1+S2)', sites.length === 1 && sites[0].key === 'black50' && !sites[0].needsTheme)

  const srcArgs = `import { t } from '@ihui/design-tokens'
foo('#FFD700')
const a = ['rgba(0,0,0,0.5)']
`
  ok('T3 函数实参数组元素不动(不是样式位)', sitesOf('b.tsx', srcArgs, idx.byNorm).length === 0)

  const srcAmb = `import { t } from '@ihui/design-tokens'
const s = { color: '#FFFFFF' }
`
  const amb = sitesOf('c.tsx', srcAmb, idx.byNorm)
  ok('T4 同值多档 ⇒ 歧义标记(不择一)', amb.length === 1 && amb[0].ambiguous && amb[0].candCount >= 2)

  const rw = rewriteFile(srcHit, sites)
  ok(
    'T5 改写形态:样式值换 rnCssLight.black50 且 import 只追加名字',
    rw.ok && rw.src.includes("backgroundColor: rnCssLight.black50") && rw.added.join(',') === 'rnCssLight' && !rw.src.includes("'rgba(0,0,0,0.5)'"),
  )
  const rw2 = rewriteFile(`const s = StyleSheet.create({ scrim: { backgroundColor: 'rgba(0,0,0,0.5)' } })`, sites)
  ok('T6 文件没有该包具名 import ⇒ 整文件拒改写(不自动新建第二条)', rw2.ok === false && /具名 import/.test(rw2.why))
  const bad = [{ ...sites[0], raw: '#123456', value: 'rgba(0,0,0,0.5)' }]
  ok('T7 原值与档值不同色 ⇒ 拒改写(可证等价是硬前置)', rewriteFile(srcHit, bad).ok === false)
  const buckets = splitBuckets([...sites, ...amb, ...gold.map((g) => ({ ...g, rel: 'd', line: 1, raw: '#FFD700', key: g.key, needsTheme: true, ambiguous: false }))])
  ok('T8 三桶互斥不重复(safe/歧义/需主题)', buckets.safe.length === 1 && buckets.ambiguous.length === 1 && buckets.needsTheme.length >= 1)
  // 真仓 22 枚文件里那条 import 全是 prettier 折行后的多行形态 —— 夹具必须按真实形态来,
  // 否则单行夹具过而真仓写坏(T5 只测了单行,首版就在多行上插出第 0 列的名字)
  const multiSrc = `import {
  rnLightTokens as tokens,
  rnType,
} from '@ihui/design-tokens'
const s = StyleSheet.create({ scrim: { backgroundColor: 'rgba(0,0,0,0.5)' } })
`
  const mSites = sitesOf('e.tsx', multiSrc, idx.byNorm)
  const mRw = rewriteFile(multiSrc, mSites)
  ok(
    'T9 多行 import:按最后一项缩进插行,不把块折成一行、不插到第 0 列',
    mRw.ok &&
      mRw.src.includes('\n  rnCssLight,\n') &&
      !mRw.src.includes('\nrnCssLight,') &&
      mRw.src.includes('backgroundColor: rnCssLight.black50') &&
      mRw.src.includes("} from '@ihui/design-tokens'") &&
      mRw.src.includes('  rnType,'),
  )

  const failed = results.filter((r) => r.startsWith('❌')).length
  for (const r of results) console.log(r)
  console.log(failed ? `❌ 自检 ${results.length - failed}/${results.length}` : `✅ self-test 全通过(${results.length} 条)`)
  process.exit(failed ? 1 : 0)
}

function main() {
  if (argv.includes('--self-test')) return selfTest()
  const face = argv.includes('--apply') ? 'worktree' : 'head'
  const { all, paletteSize } = collect(face)
  const { safe, ambiguous, needsTheme } = splitBuckets(all)
  const perFileSafe = new Map()
  for (const s of safe) {
    if (!perFileSafe.has(s.rel)) perFileSafe.set(s.rel, [])
    perFileSafe.get(s.rel).push(s)
  }

  console.log(
    `[fix-color-literals] 面=${face} 覆盖面档 ${paletteSize} 枚;对象位色值字面量命中 ${all.length} 处 ⇒ 可直接改写 ${safe.length} / 明暗不同需主题 ${needsTheme.length} / 同值多档歧义 ${ambiguous.length}`,
  )
  for (const s of ambiguous.slice(0, 8)) console.log(`  歧义 ${s.rel}:${s.line} ${JSON.stringify(s.raw)} 命中 ${s.candCount} 档`)
  for (const s of needsTheme.slice(0, 8)) console.log(`  需主题 ${s.rel}:${s.line} ${JSON.stringify(s.raw)} → ${s.key}(light≠dark)`)

  if (argv.includes('--json')) {
    console.log(
      JSON.stringify({
        summary: { face, hits: all.length, safe: safe.length, needsTheme: needsTheme.length, ambiguous: ambiguous.length, files: perFileSafe.size },
      }),
    )
  }
  if (!argv.includes('--apply') && !argv.includes('--emit-blobs')) {
    console.log(`[fix-color-literals] 只读档(未写盘)。加 --apply 改写盘上 ${safe.length} 处,或 --emit-blobs <文件> 由 HEAD 面构 blob(落地用,不读盘上他人现场)。`)
    return 0
  }
  // --emit-blobs:每条 blob = git show HEAD:<file> 上的改写结果。
  // 为什么必须有这一档:共享工作树里那 22 枚文件可能正挂着别席未提交改动,拿盘上字节交就是替人提交(§12);
  // 而 HEAD 面改写既证得等价,又不读别人的现场 —— 盘上那份由自愈层随后对齐。
  if (argv.includes('--emit-blobs')) {
    const at = argv.indexOf('--emit-blobs')
    const out = String(argv[at + 1] ?? '').trim()
    if (!out) {
      console.log('❌ 未判定:--emit-blobs 需要跟一个输出文件路径')
      return 2
    }
    const byFile = new Map()
    for (const s of safe) {
      if (!byFile.has(s.rel)) byFile.set(s.rel, [])
      byFile.get(s.rel).push(s)
    }
    const built = []
    const refused = []
    for (const [rel, list] of byFile) {
      const head = git(['show', `HEAD:${rel}`])
      const again = sitesOf(rel, head, buildIndex(git(['show', `HEAD:${syncTok.RN_TOKENS_REL}`]), git(['show', `HEAD:${syncTok.TOKENS_SOURCE_REL}`])).byNorm).filter(
        (s) => !s.ambiguous && !s.needsTheme,
      )
      const r = rewriteFile(head, again)
      if (!r.ok) {
        refused.push(`${rel}:${r.why}`)
        continue
      }
      const oid = git(['hash-object', '-w', '--stdin'], r.src).trim()
      built.push({ path: rel, blob: oid, count: r.count, added: r.added })
    }
    writeFileSync(join(ROOT, out), JSON.stringify({ files: built.map((b) => ({ path: b.path, blob: b.blob })) }, null, 1), 'utf8')
    console.log(`[fix-color-literals] HEAD 面构 blob:${built.length} 枚文件 / ${built.reduce((a, b) => a + b.count, 0)} 处改写;拒落 ${refused.length} 枚 → ${out}`)
    for (const f of refused) console.log(`  ⚠ ${f}`)
    return built.length > 0 ? 0 : 1
  }
  let changed = 0
  const failed = []
  const notes = []
  // 索引一律由 **HEAD 面的 rn-tokens.ts + tokens.css** 建(档表是被审面,不是组件那份源码)
  const rnForIndex = git(['show', `HEAD:${syncTok.RN_TOKENS_REL}`])
  const cssForIndex = git(['show', `HEAD:${syncTok.TOKENS_SOURCE_REL}`])
  const idxForRewrite = buildIndex(rnForIndex, cssForIndex).byNorm
  for (const [rel, list] of perFileSafe) {
    const p = join(ROOT, rel)
    const src = readFileSync(p, 'utf8')
    // 重新在磁盘那份上算位(工作树可能与 HEAD 有差),不拿 HEAD 的偏移去改盘上字节
    const local = sitesOf(rel, src, idxForRewrite).filter((s) => !s.ambiguous && !s.needsTheme)
    if (local.length === 0) {
      failed.push(`${rel}:盘上已无安全档可改写(可能已被他席改过)⇒ 跳过`)
      continue
    }
    const r = rewriteFile(src, local)
    if (!r.ok) {
      failed.push(`${rel}:${r.why}`)
      continue
    }
    if (list.length !== local.length) notes.push(`${rel}:HEAD 面 ${list.length} 处 / 盘上 ${local.length} 处 ⇒ 按盘上那份改`)
    writeFileSync(p, r.src, 'utf8')
    changed += 1
    execFileSync(process.execPath, [join(ROOT, 'scripts/watermark.mjs'), 'inject', p], {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 60000,
    })
    console.log(`  ✓ ${rel} 改写 ${r.count} 处(import 追加 ${r.added.join(',') || '无需'})`)
  }
  for (const f of failed) console.log(`  ⚠ ${f}`)
  for (const n of notes) console.log(`  ℹ ${n}`)
  console.log(`[fix-color-literals] 落盘文件 ${changed} 枚,跳过/失败 ${failed.length} 枚`)
  return changed > 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ 未判定:${String(e?.message ?? e).slice(0, 200)}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { ensureImport, rewriteFile, sitesOf, splitBuckets, buildIndex }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
