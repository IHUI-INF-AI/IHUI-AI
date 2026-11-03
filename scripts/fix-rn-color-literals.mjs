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
 *
 * 写盘凭据(2026-11-03 接线,与另七条跨端写盘腿同形):`--apply` 每轮把本批**真写过盘**的文件
 *   逐枚「写完盘后实测 oid」追写申报账本 .ihui-agent/state/cross-end-landing.jsonl
 *   (库 = scripts/lib/cross-end-landing-ledger.mjs;收编侧按 blob 逐字节核验后才收)。
 *   下一轮开始先把「本 leg 在册 ∧ 工作树 blob 仍相符」的路径整枚跳过(可续跑)。
 *   只读档(无旗/--check/--report/--json/--emit-blobs)结构上到不了登记调用 ⇒ 零登记。
 *   结论行机读键:landing=<登记枚数> landingPath=<账本相对路径> skipLanded=<跳过数>
 *   [landingDedup=n][landingRejected=n][ledger=unjudged][landingError=<原因>]。
 *   注:--emit-blobs 交的是 HEAD 面构出的 blob(盘上字节未动),**不是**工作树落档 ⇒ 不登记,
 *   登记了反而让收编侧把「盘上仍是旧字节」判成 contested 污染凭据。
 *
 * 归属闸(2026-11-03 立,本腿挂守护周期循环的**前置条件**):--apply 的落点只要出现在
 *   `git status --porcelain` 里(他席在飞 / 未跟踪 / 已暂存未提交)⇒ 归属未知 ⇒ **本轮不写**,
 *   进 held 桶并逐条点名;脏集本身取不到 ⇒ 一条都不写并在结论行标 `ownership=unjudged`
 *   (§0.3:失效方向恒为"少写一次",绝不覆盖别人的未提交工作 —— AGENTS.md §12/§16 事故型)。
 *   判据单源 = `scripts/lib/git-paths.mjs`(`ownershipGate`),三枚 lander 与 gen-ui-mirror 共用
 *   同一份(§0.6 / 门 191)。闸只挡写盘:HEAD 面判据、`colorsAgree` 等价性前置、只读档与 --check
 *   档一字未动。新增机读键:`held=<枚数>`(只读档给的是同一条尺的**预演**读数)、
 *   `ownership=unjudged`(脏集取不到)。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import ts from 'typescript'

import { catBatch, gitRaw } from './lib/face-reader.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
import { __test__ as tok93 } from './check-cross-end-tokens.mjs'
import { __test__ as syncTok } from './sync-rn-tokens.mjs'
import { appendLanding, collectiblePaths, ledgerPathFor } from './lib/cross-end-landing-ledger.mjs'
// 归属闸(2026-11-03 立,本腿挂守护周期循环的**前置条件**):判据与点名文案的单源都在
// `scripts/lib/git-paths.mjs`(三枚 lander + gen-ui-mirror 共用同一份,§0.6 / 门 191)。
// 多会话共享工作区里,自动腿写他席正在编辑的文件 = 覆盖别人的未提交工作(§12/§16 事故型)。
import { ownershipGate } from './lib/git-paths.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_FACES = ['apps/mobile-rn/src', 'packages/app/src']
const PKG_IMPORT = '@ihui/design-tokens'

/**
 * 腿短名 = 本脚本文件名去掉 .mjs。出处现读:scripts/guardian-runner.mjs 的守门 255 登记条目
 * `script: 'fix-rn-color-literals.mjs'`(git-guardian.mjs 通篇不点名本器物 ⇒ 唯一在册自称就是这条),
 * 三枚 lander 同名规(LEG_NAME = guardian/runner 派发的那枚文件名)。账本复合主键用,不得自立新名。
 */
export const LEG_NAME = 'fix-rn-color-literals'

// ─── 写盘凭据账本(cross-end-landing-ledger 接线,2026-11-03 立,与另七条腿同形)──────
// 治两条根因:R1 无凭据(--apply 写完工作树就悬挂,收编侧无从正当收编)、
// R2 不可续跑(每轮从头再扫一遍,已落的那枚文件反复进落盘批)。
// 本层零复算判据(§0.6):取 oid 与库内 collectiblePaths 的 worktree 面逐字同一把尺
// (gitRaw hash-object,face-reader 出口;两侧算法不同的后果是"永远 contested"),
// 登记/读账本一律走库出口,本层不写第二份 appendLanding/readLanding。
// 失效方向:账本读不到 ⇒ 回落现行为(照旧全量尝试)+ ledger=unjudged,不判死不退场(§0.3)。

/** 账本相对路径(正斜杠),结论行 landingPath= 键用;真相源 = 库的 ledgerPathFor。 */
export const LEDGER_REL = relative(ROOT, ledgerPathFor(ROOT)).replace(/\\/g, '/')

/** 路径在工作树面的当前 blob oid —— 与账本库 currentOidsForFace(worktree) 逐字同一把尺。 */
export function blobOidOf(rel, { root = ROOT } = {}) {
  return String(gitRaw(['hash-object', '--', rel], root)).trim().toLowerCase()
}

/**
 * 本 leg 已登记 ∧ 工作树 blob 仍相符的路径集合(⇒ 本轮跳过,即幂等续跑)。
 * 账本读不到 ⇒ {ok:false}:调用方必须回落现行为并在结论行标 ledger=unjudged。
 * quietMs=0:续跑只看「在册且未漂」,静默期是收编侧的判据,不在这里复算。
 */
export function landedPathsOf({ root = ROOT, leg = LEG_NAME, now = new Date() } = {}) {
  const r = collectiblePaths(now, { quietMs: 0, face: 'worktree', root })
  if (!r.ok) return { ok: false, reason: r.reason, paths: new Set() }
  return { ok: true, paths: new Set(r.collectible.filter((c) => c.leg === leg).map((c) => c.path)) }
}

/**
 * 落盘成功后一次批量登记:逐路径**写完盘后实测** oid(绝不取 HEAD 旧值)→ appendLanding。
 * 本体永不抛(账本不可写只如实报 error,§0.3);同轮共用一个 ISO 时刻;空批一个字节都不写。
 */
export function registerLanding(paths, { root = ROOT, leg = LEG_NAME, at = new Date().toISOString() } = {}) {
  if (!paths.length) return { ok: true, landing: 0, deduped: 0, rejected: [] }
  try {
    const list = paths.map((p) => ({ at, leg, path: p, blobOid: blobOidOf(p, { root }) }))
    const r = appendLanding(list, { root })
    return { ok: true, landing: r.appended, deduped: r.deduped, rejected: r.rejected }
  } catch (e) {
    return { ok: false, landing: 0, deduped: 0, rejected: [], error: String(e?.message ?? e).split('\n')[0] }
  }
}

/** 结论行机读尾段(与三枚 lander 逐字同形,同形锁见 scripts/tests/fix-rn-color-literals-landing.test.mjs)。 */
export function landingKeys({ landing = 0, deduped = 0, rejected = 0, skipLanded = 0, ledgerUnjudged = false, landingErr = '' } = {}) {
  const parts = [`landing=${landing}`, `landingPath=${LEDGER_REL}`, `skipLanded=${skipLanded}`]
  if (deduped) parts.push(`landingDedup=${deduped}`)
  if (rejected) parts.push(`landingRejected=${rejected}`)
  if (ledgerUnjudged) parts.push('ledger=unjudged')
  if (landingErr) parts.push(`landingError=${landingErr.replace(/\s+/g, '_').slice(0, 100)}`)
  return ` ${parts.join(' ')}`
}

const argv = process.argv.slice(2)
const git = (args, input) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    input,
    windowsHide: true,
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
  // 枚举:工作树与索引都按 ls-files(索引面就是 ls-files 的那张表);HEAD 面才用 ls-tree
  const files = SCAN_FACES.flatMap((d) =>
    (face === 'head'
      ? git(['ls-tree', '-r', '--name-only', 'HEAD', '--', d])
      : git(['ls-files', '--', d])
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
  return { all, paletteSize, contents, byNorm }
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

  // T10 拦新增的正反控:同值字面量在"本枚改过的文件"里从 0→1 ⇒ fresh;未改动的文件一律不算本枚的账
  const mkSite = (rel, line) => ({ rel, line, raw: 'rgba(0,0,0,0.5)', key: 'black50', ambiguous: false, needsTheme: false })
  const twoSites = [mkSite('a.tsx', 1), mkSite('b.tsx', 2)]
  const ratchetFresh = checkRatchet({
    face: 'staged',
    changedRels: new Set(['a.tsx']),
    sites: twoSites,
    sitesOfBase: new Map([['a.tsx', 0]]),
  })
  const ratchetQuiet = checkRatchet({
    face: 'staged',
    changedRels: new Set(['a.tsx']),
    sites: twoSites,
    sitesOfBase: new Map([['a.tsx', 1]]),
  })
  ok(
    'T10 拦新增:改过的文件 0→1 即点名;1→1 不报;未改动文件(b.tsx)只进存量不进本枚账',
    ratchetFresh.fresh.length === 1 &&
      ratchetFresh.fresh[0].rel === 'a.tsx' &&
      ratchetQuiet.fresh.length === 0 &&
      ratchetFresh.stock === 2 &&
      ratchetFresh.checked === 1,
  )

  const failed = results.filter((r) => r.startsWith('❌')).length
  for (const r of results) console.log(r)
  console.log(failed ? `❌ 自检 ${results.length - failed}/${results.length}` : `✅ self-test 全通过(${results.length} 条)`)
  process.exit(failed ? 1 : 0)
}

/**
 * 拦新增(守门 255 的判据):被审面上"可机械改走源档"的字面量,只按**本枚改动过的文件**计数。
 *
 * 为什么按改动集而不是全数:① 全数存量由这一批之前的历史造成(现读 34 处已在 b853339 一次清完,
 *   剩 5 处歧义待人工命名),拿它拦别人的提交就是 §12e 的恒红门;② 未改动的文件在这一枚里内容逐字节不变,
 *   它的命中数结构上不可能变 ⇒ 只需为改动过的那几枚文件取上一面的数,判据既准又便宜。
 * 但必须如实报全数存量 —— 只报"本枚新增 0"而藏住存量,等于把治理面读成已归零。
 *
 * @returns {{fresh:Array,stock:number,checked:number,face:string,base:string}}
 */
export function checkRatchet({ face, changedRels, sites, sitesOfBase }) {
  const fresh = []
  for (const s of sites) {
    if (s.ambiguous || s.needsTheme) continue
    if (!changedRels.has(s.rel)) continue
    const before = sitesOfBase.get(s.rel) ?? 0
    const now = sites.filter((x) => x.rel === s.rel && !x.ambiguous && !x.needsTheme).length
    if (now > before) {
      fresh.push({ ...s, before, now })
      // 同一枚文件只点一次,附前后计数(逐处再列会淹没归因)
      sitesOfBase.set(s.rel, now)
    }
  }
  return { fresh, stock: sites.filter((s) => !s.ambiguous && !s.needsTheme).length, checked: changedRels.size, face, base: face === 'staged' ? 'HEAD' : 'HEAD^' }
}

/** 提交链档:被审面(索引或 HEAD)对上一面,只按本枚改过的文件比命中数。 */
function runCheck(face) {
  const baseRef = face === 'staged' ? 'HEAD' : 'HEAD^'
  const { all, paletteSize, byNorm } = collect(face)
  let changedRaw
  try {
    changedRaw = git([
      'diff',
      ...(face === 'staged' ? ['--cached'] : []),
      '--name-only',
      baseRef,
      '--',
      ...SCAN_FACES,
    ])
  } catch (e) {
    console.log(`❌ 未判定:改动集取不到(${String(e?.message ?? e).slice(0, 120)})——不记绿也不冒红`)
    return 2
  }
  const changed = new Set(changedRaw.split('\n').filter((p) => /\.(tsx|ts)$/.test(p)))
  if (changed.size === 0) {
    console.log(
      `[fix-color-literals] ✅ 本枚未新增可走源档的色值字面量(射程内改动文件 0 枚 ⇒ 不适用,不等于全仓归零;全数存量 ${all.filter((s) => !s.ambiguous && !s.needsTheme).length} 处,覆盖面档 ${paletteSize})`,
    )
    return 0
  }
  const sitesOfBase = new Map()
  for (const rel of changed) {
    let t = ''
    try {
      t = git(['show', `${baseRef}:${rel}`])
    } catch {
      t = '' // 新建文件:上一面没有 ⇒ 基线 0 处(新建里写死字面量同样该拦)
    }
    sitesOfBase.set(rel, sitesOf(rel, t, byNorm).filter((s) => !s.ambiguous && !s.needsTheme).length)
  }
  const r = checkRatchet({ face, changedRels: changed, sites: all, sitesOfBase })
  for (const f of r.fresh)
    console.log(
      `✗ ${f.rel}:${f.line} 新写死 ${JSON.stringify(f.raw)}(源里有档 rnCssLight.${f.key})⇒ 该走源档;本枚把这枚文件从 ${f.before} 处抬到 ${f.now} 处`,
    )
  const line = r.fresh.length
    ? `❌ 本枚新增 ${r.fresh.length} 处可机械改走源档的字面量(检查 ${r.checked} 枚改动文件;全数存量 ${r.stock} 处)`
    : `✅ 本枚零新增:检查 ${r.checked} 枚改动文件,全数存量 ${r.stock} 处只报数(存量治理归替换器 --apply)`
  console.log(line)
  if (argv.includes('--json'))
    console.log(JSON.stringify({ summary: { face, base: r.base, checked: r.checked, fresh: r.fresh.length, stock: r.stock } }))
  return r.fresh.length ? 1 : 0
}

/**
 * --apply 的**三桶裁决**(2026-11-03 立,本腿挂守护周期循环的前置条件)—— 纯裁决,零写盘、零登记。
 *
 *  · `skipLanded` = 本 leg 在册 ∧ 工作树 blob 未漂(续跑腿,判序与抽段前一字未动);
 *  · `held`       = 落点出现在 `git status --porcelain` 里(他席在飞 / 未跟踪 / 已暂存未提交),
 *                   或**脏集本身取不到** ⇒ 一律不写,并逐条点名(AGENTS.md:被拒/取不到都要点名到
 *                   具体文件,只报总数不可以);
 *  · `writable`   = 过了归属闸的落点 ⇒ 只有这一桶进 `applyRewriteToWorktree` 真写盘。
 *
 * 为什么要这道闸:多会话共享工作区里,自动腿写他席正在编辑的文件 = 覆盖别人的未提交工作
 * (AGENTS.md §12/§16 的明令事故型)。归属判据单源 = `scripts/lib/git-paths.mjs`
 * (`ownershipGate` = `ownershipDirtyPathsDetailed` + `isCleanOwned`),本层零复算(§0.6 / 门 191)。
 *
 * @returns {{ok:boolean, reason:string|null, writable:string[], held:string[], skipLanded:number}}
 */
export function ownershipPlan(rels, { root = ROOT, landedSet = new Set() } = {}) {
  const ownership = ownershipGate({ root })
  const writable = []
  const held = []
  let skipLanded = 0
  for (const rel of rels || []) {
    if (landedSet.has(rel)) {
      skipLanded += 1
      continue
    }
    const blocked = ownership.blocked(rel)
    if (blocked) {
      held.push(blocked)
      continue
    }
    writable.push(rel)
  }
  return { ok: ownership.ok, reason: ownership.reason, writable, held, skipLanded }
}

/**
 * 单枚落盘(2026-11-03 从主循环抽出,动作与抽段前逐字相同:读盘那份 → 重算安全位 → 改写 →
 * 水印 inject;等价性前置 `colorsAgree` 仍在 `rewriteFile` 里,任一处不过 = 整枚不落)。
 *
 * 抽出来的唯一目的是让归属闸能被夹具**整链**证明(mkScratch 临时仓里跑真写盘,绝不把写档打向
 * 真实工作树)。`root` 可注入;**账本登记不在这里** —— 仍只在批末由主流程对 `landedBatch` 做一次。
 * 读不到盘上字节一律照旧抛出(未判定),不在这里吞(§0.3)。
 *
 * @returns {{ok:boolean, action:'written'|'stale'|'failed', count?:number, added?:string[],
 *            headCount:number, localCount:number, drifted:boolean, why?:string}}
 */
export function applyRewriteToWorktree(rel, { root = ROOT, idxForRewrite, headCount = 0 } = {}) {
  const p = join(root, rel)
  const src = readFileSync(p, 'utf8')
  // 重新在磁盘那份上算位(工作树可能与 HEAD 有差),不拿 HEAD 的偏移去改盘上字节
  const local = sitesOf(rel, src, idxForRewrite).filter((s) => !s.ambiguous && !s.needsTheme)
  if (local.length === 0) return { ok: false, action: 'stale', headCount, localCount: 0, drifted: headCount !== 0 }
  const r = rewriteFile(src, local)
  if (!r.ok) return { ok: false, action: 'failed', why: r.why, headCount, localCount: local.length, drifted: headCount !== local.length }
  writeFileSync(p, r.src, 'utf8')
  execFileSync(process.execPath, [join(ROOT, 'scripts/watermark.mjs'), 'inject', p], {
    stdio: 'ignore',
    windowsHide: true,
    timeout: 60000,
  })
  return {
    ok: true,
    action: 'written',
    count: r.count,
    added: r.added,
    headCount,
    localCount: local.length,
    drifted: headCount !== local.length,
  }
}

function main() {
  if (argv.includes('--self-test')) return selfTest()
  const isCheck = argv.includes('--check')
  const isStaged = argv.includes('--staged')
  if (isCheck) return runCheck(isStaged ? 'staged' : 'head')
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
    // held= 在这里是**预演读数**(只读档一个字节都不写):报的是"若此刻 --apply,会被归属闸挡掉的枚数"。
    // 判据与 --apply 档同一条尺(同一 ownershipGate 出口),不是另算一遍。
    const preview = ownershipGate({ root: ROOT })
    let previewHeld = 0
    for (const rel of perFileSafe.keys()) if (preview.blocked(rel)) previewHeld += 1
    console.log(
      `[fix-color-literals] 只读档(未写盘)。加 --apply 改写盘上 ${safe.length} 处,或 --emit-blobs <文件> 由 HEAD 面构 blob(落地用,不读盘上他人现场)。` +
        landingKeys({}) +
        ` held=${previewHeld} (预演:落点归属未明的枚数,--apply 时这些一条都不写)` +
        (preview.ok ? '' : ' ownership=unjudged'),
    )
    return 0
  }
  // --emit-blobs:每条 blob = git show HEAD:<file> 上的改写结果。
  // 为什么必须有这一档:共享工作树里那 22 枚文件可能正挂着别席未提交改动,拿盘上字节交就是替人提交(§12);
  // 而 HEAD 面改写既证得等价,又不读别人的现场 —— 盘上那份由自愈层随后对齐。
  if (argv.includes('--emit-blobs')) {
    // G-322 第二十一批:落点型旗标接 `lib/flag-value.mjs` 单源。旧写法只查"非空" ⇒ `--emit-blobs --json`
    // 把 `--json` 当文件名收下,而落点是 `writeFileSync(join(ROOT, out))` —— **仓根**:往仓库根写出一个
    // 名为 "--json" 的文件还照打"blob:… → --json"(§28 根目录整洁铁律被吞值动作破坏,产物位置与调用方
    // 要的不是同一个)。判死排在任何 writeFileSync 之前;`--emit-blobs` 的合法正例面实测过(出件 2 枚 rc=0)。
    const emitFlag = requireFlagValue(argv, '--emit-blobs', { noun: '输出文件路径' })
    if (emitFlag.error) {
      console.error(`❌ ${emitFlag.error} ⇒ 未判定(落点型旗标:不得把被吞的旗标当输出文件名)`)
      return 2
    }
    const out = String(emitFlag.value ?? '').trim()
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
    for (const [rel] of byFile) {
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
    console.log(
      `[fix-color-literals] HEAD 面构 blob:${built.length} 枚文件 / ${built.reduce((a, b) => a + b.count, 0)} 处改写;拒落 ${refused.length} 枚 → ${out}` +
        // 盘上字节未动 ⇒ 本档结构上不登记(blob 属 HEAD 面,登记了收编侧只会判 contested)
        landingKeys({}),
    )
    for (const f of refused) console.log(`  ⚠ ${f}`)
    return built.length > 0 ? 0 : 1
  }
  let changed = 0
  const failed = []
  const notes = []
  // 续跑(R2):轮首读账本 —— 「本 leg 在册 ∧ 工作树 blob 仍相符」的枚 = 早前已落,整枚跳过。
  // 账本读不到 ⇒ 回落现行为(照旧全量尝试)并在结论行标 ledger=unjudged(失效方向=多做一遍)。
  let landedSet = new Set()
  let ledgerUnjudged = false
  const lp = landedPathsOf()
  if (lp.ok) landedSet = lp.paths
  else ledgerUnjudged = true
  const landedBatch = []
  // 索引一律由 **HEAD 面的 rn-tokens.ts + tokens.css** 建(档表是被审面,不是组件那份源码)
  const rnForIndex = git(['show', `HEAD:${syncTok.RN_TOKENS_REL}`])
  const cssForIndex = git(['show', `HEAD:${syncTok.TOKENS_SOURCE_REL}`])
  const idxForRewrite = buildIndex(rnForIndex, cssForIndex).byNorm
  // 归属闸(2026-11-03,本腿挂守护周期循环的前置条件):三桶裁决住 `ownershipPlan`(纯裁决、零写盘),
  // 主循环只对 `plan.writable` 落笔 ⇒ held 逐条点名、脏集取不到时一条都不写。
  const plan = ownershipPlan([...perFileSafe.keys()], { root: ROOT, landedSet })
  const skipLanded = plan.skipLanded
  const held = plan.held
  for (const rel of plan.writable) {
    const list = perFileSafe.get(rel)
    const w = applyRewriteToWorktree(rel, { root: ROOT, idxForRewrite, headCount: list.length })
    if (w.action === 'stale') {
      failed.push(`${rel}:盘上已无安全档可改写(可能已被他席改过)⇒ 跳过`)
      continue
    }
    if (!w.ok) {
      failed.push(`${rel}:${w.why}`)
      continue
    }
    if (w.drifted) notes.push(`${rel}:HEAD 面 ${w.headCount} 处 / 盘上 ${w.localCount} 处 ⇒ 按盘上那份改`)
    changed += 1
    // 登记的是「写盘 + 水印注入之后」的那份字节:inject 前实测的 oid 与盘上最终态不等 ⇒ 永远 contested
    landedBatch.push(rel)
    console.log(`  ✓ ${rel} 改写 ${w.count} 处(import 追加 ${w.added.join(',') || '无需'})`)
  }
  for (const f of failed) console.log(`  ⚠ ${f}`)
  for (const n of notes) console.log(`  ℹ ${n}`)
  // held 必须**逐条点名**(只报总数不可:AGENTS.md 要求被拒/取不到都点名到具体文件)
  if (held.length)
    console.log(
      `  🔒 held(归属未明,不猜 ⇒ 本轮不写)${held.length} 枚:${held.slice(0, 6).join(', ')}${held.length > 6 ? ' …' : ''}`,
    )
  // R1:本批产出一次登记(写完盘后逐枚实测 oid);登记不上绝不冒成功(landingError 如实点名)
  let landing = 0
  let landingDedup = 0
  let landingRejected = 0
  let landingErr = ''
  if (argv.includes('--apply') && landedBatch.length) {
    const reg = registerLanding(landedBatch)
    landing = reg.landing
    landingDedup = reg.deduped
    landingRejected = reg.rejected.length
    if (!reg.ok) landingErr = reg.error
    else if (landingRejected) landingErr = `rejected=${landingRejected}:${reg.rejected[0].reason}`
  }
  console.log(
    `[fix-color-literals] 落盘文件 ${changed} 枚,跳过/失败 ${failed.length} 枚` +
      landingKeys({ landing, deduped: landingDedup, rejected: landingRejected, skipLanded, ledgerUnjudged, landingErr }) +
      ` held=${held.length}` +
      (plan.ok ? '' : ' ownership=unjudged'),
  )
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

export const __test__ = {
  ensureImport,
  rewriteFile,
  sitesOf,
  splitBuckets,
  buildIndex,
  checkRatchet,
  // 写盘凭据账本层(§22c:镜像测试直调生产出口,测试里零复制判据)
  LEG_NAME,
  LEDGER_REL,
  blobOidOf,
  landedPathsOf,
  registerLanding,
  landingKeys,
  // 归属闸三桶裁决 + 单枚落盘(2026-11-03;测试在 mkScratch 临时仓里跑真写盘,不打真实工作树)
  ownershipPlan,
  applyRewriteToWorktree,
  ownershipGate,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
