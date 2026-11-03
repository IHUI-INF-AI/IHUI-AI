#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 容器 hover 浮起单一数值源(浮起散写对账守门;blocking,新增 id '285')
 *
 * 判的是什么:`apps/web/**` 与 `packages/ui-react/**` 的 ts/tsx 里,任何
 * `hover:`/`group-hover:`/`sm:hover:` 等 hover 变体后面跟着 `translate-y-*` 或 `shadow*`
 * 的 Tailwind 类字面量。豁免只走具名台账(`scripts/data/hover-lift-single-source-allowlist.json`,
 * 带 reason ≥10 字与 until 到期),台账口径照 §0.7:到期 ⇒ 红、登记数 > 被审面命中数 ⇒ 清单腐烂红。
 *
 * 为什么这一格必须是机器闸(2026-11-03 立):
 * 容器浮起的全站唯一数值源在 `apps/web/app/globals.css` 的 `--lift-*`(2026-10-22 定档,
 * 2026-11-03 机主二次定档"稍微有点感觉")。该块头注写着"端内不得再各写 hover:scale-105 /
 * hover:shadow-xl / hover:-translate-y-*",但**这条铁律此前只是注释**——§0.9:判据没在真跑它
 * 的那一刻才成立 = 没有。2026-11-03 实测:全仓仍有 24 个文件 30 处散写,其中营销定价卡的
 * `group-hover:-translate-y-2`(8px)与 `ui-lift` 源的 -2px **叠加**(Tailwind translate 是独立
 * 属性、源用 transform,两支各走各的),机主因此看到"调了数值源还是重"。注释拦不住下一次
 * 复制粘贴,所以把这条铁律收成一门:D1 绝对零容忍(散写清干净后才能立,立当次现读通过)。
 *
 * 维度边界(刻意不贪):
 *   ① 只判 translate-y 与 shadow 两族 —— `hover:scale-*`/`-translate-x-*` 有大量**合法身份**
 *      (图片 hover 推开 object-cover、图标微缩放、方向箭头),纯文本判据分不开它们,强行判的
 *      假阳性会让人学会忽略这道门的红(比没有门更糟,§12f);scale 族暂靠注释与人工审。
 *   ② 只判带 `hover:` 语义段的类(前置变体链含 hover),静态 shadow/translate 属常驻样式,不在射程。
 *   ③ 判字面量 ⇒ 遮注释(`maskComments`),**不遮字符串**(类的家就在字符串里)。
 *
 * 取材面纪律照 §0.4:默认判 HEAD blob,`--staged` 判索引 blob,`--worktree` 仅人工逃生舱;
 * 清单与内容同面同轮(./lib/face-scan.mjs),取不到不回落另一个面。存量 2026-11-03 清扫当次
 * HEAD 现读 = 0(非台账条目)⇒ 按 §12e 可直接 blocking,非恒红门。
 *
 * 用法:
 *   node scripts/check-hover-lift-single-source.mjs            # 全量(HEAD)
 *   node scripts/check-hover-lift-single-source.mjs --staged    # pre-commit 档
 *   node scripts/check-hover-lift-single-source.mjs --worktree  # 人工逃生舱(盘上现读)
 *   node scripts/check-hover-lift-single-source.mjs --self-test  # 判据夹具(含变异自证)
 * 跳过(紧急):HUSKY_SKIP_HOVER_LIFT_SINGLE_SOURCE=1 git commit ...
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName, withExcludes } from './lib/exclude-dirs.mjs'
import { Undetermined, assertRepoRoot, selectFace } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'
import { readSources, sourceCandidates } from './lib/face-scan.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SCAN_GLOBS = ['apps/web/**/*.ts', 'apps/web/**/*.tsx', 'packages/ui-react/**/*.tsx']
// 预筛只用于 git grep 缩小候选集(同一行内 hover 段与 translate-y/shadow 相邻);真判据在下面。
const PREFILTER_RE = 'hover.{0,120}(translate-y|shadow)'

const SKIP_DIRS = withExcludes(['tests', '__tests__', 'e2e'])
const skipSegmentTest = (seg) => SKIP_DIRS.has(seg) || isExcludedDirName(seg)

const TAILWIND_SEG = String.raw`[a-zA-Z0-9:/.\[\]_%-]*`
/** `hover:` 变体链(group-hover / sm:hover / 任意前置变体)后接 translate-y 族。 */
const R_TRANSLATE_Y = new RegExp(`hover:${TAILWIND_SEG}-?translate-y${TAILWIND_SEG}`, 'g')
/** 同族形态,接 shadow 族(shadow-lg / shadow-primary/30 / hover:shadow-*)。 */
const R_SHADOW = new RegExp(`hover:${TAILWIND_SEG}shadow${TAILWIND_SEG}`, 'g')

const LEDGER_REL = 'scripts/data/hover-lift-single-source-allowlist.json'

/**
 * 单文件判据(纯函数:进源码文本,遮注释后扫两条 regex;返回按出现顺序的命中)。
 * 一行可命中多枚(一行里 translate 与 shadow 各一)——逐枚点名,不并成"该行违规"。
 */
export function judgeLiftLiterals(text) {
  const masked = maskComments(text)
  const violations = []
  for (const [re, dim] of [
    [R_TRANSLATE_Y, 'translate-y'],
    [R_SHADOW, 'shadow'],
  ]) {
    re.lastIndex = 0
    for (const m of masked.matchAll(re)) {
      const line = masked.slice(0, m.index).split('\n').length
      violations.push({ line, dim, snippet: m[0].slice(0, 72) })
    }
  }
  violations.sort((a, b) => a.line - b.line || a.dim.localeCompare(b.dim))
  return violations
}

/**
 * 台账判序(与豁免族同一条规矩,§0.7):
 *   ① 台账取不到/形状坏 ⇒ 未判定(既不记绿也不冒红);
 *   ② 条目 `until` 已到期 ⇒ 腐烂红;
 *   ③ 条目所在文件的实际命中数**少于**登记的豁免数 ⇒ 清单腐烂红(豁免不再命中);
 *   ④ 超出豁免数的每一枚散写 ⇒ 违规红;
 *   ⑤ 登记了台账而该文件在扫描集中零命中 ⇒ 清单腐烂红(同 ③,防"豁免比判据活得久")。
 */
export function judgeAgainstAllowlist(perFile, entries, { today }) {
  const expired = []
  const stale = []
  const violations = []
  const exemptByFile = new Map()
  for (const e of entries) {
    if (typeof e.file !== 'string' || !Number.isInteger(e.liftCalls) || e.liftCalls < 1) {
      return { malformed: `条目形状坏:${JSON.stringify(e).slice(0, 120)}` }
    }
    if (typeof e.reason !== 'string' || e.reason.trim().length < 10) {
      return { malformed: `条目 ${e.file} 的 reason 缺失或短于 10 字` }
    }
    if (typeof e.until !== 'string') return { malformed: `条目 ${e.file} 缺 until(豁免必须会到期)` }
    if (e.until < today) expired.push(`${e.file} 于 ${e.until} 到期`)
    exemptByFile.set(e.file, (exemptByFile.get(e.file) ?? 0) + e.liftCalls)
  }
  for (const [rel, hits] of perFile) {
    const exempt = expired.some((x) => x.startsWith(`${rel} `)) ? 0 : (exemptByFile.get(rel) ?? 0)
    if (hits.length > exempt) {
      for (const h of hits.slice(exempt)) {
        violations.push(`${rel}:${h.line} [${h.dim}] ${h.snippet}`)
      }
    } else if (hits.length < exempt) {
      stale.push(`${rel} 登记豁免 ${exempt} 枚,被审面只命中 ${hits.length} 枚 ⇒ 清单腐烂`)
    }
  }
  for (const rel of exemptByFile.keys()) {
    if (!perFile.has(rel)) stale.push(`${rel} 登记了豁免,但被审面该文件一枚散写都没有 ⇒ 清单腐烂`)
  }
  return { expired, stale, violations, malformed: null }
}

function readAllowlist(top) {
  const abs = join(top, LEDGER_REL)
  if (!existsSync(abs)) throw new Undetermined(`豁免台账不存在:${LEDGER_REL}`)
  let parsed
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    throw new Undetermined(`豁免台账不是合法 JSON:${e?.message ?? e}`)
  }
  if (!Array.isArray(parsed?.entries)) throw new Undetermined(`豁免台账缺 entries 数组`)
  return parsed
}

export async function run({ staged, worktree, selfTest = false } = {}) {
  if (selfTest) return selfTestRun()
  const top = assertRepoRoot(ROOT, '容器 hover 浮起单一数值源守门')
  const picked = selectFace({ staged, worktree, def: 'head' })
  if (picked.error) {
    console.log(`${C.yellow}⚠️  未判定:${picked.error}${C.reset}`)
    return 2
  }
  const face = picked.face
  const faceLabel =
    face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工逃生舱)' : 'HEAD blob'

  let allowlist
  try {
    allowlist = readAllowlist(top)
  } catch (e) {
    console.log(`${C.yellow}⚠️  未判定:豁免台账取不到 ⇒ ${e?.message ?? e}${C.reset}`)
    return 2
  }
  const today = new Date().toISOString().slice(0, 10)

  const listed = sourceCandidates(top, face, {
    prefilterRe: PREFILTER_RE,
    pathspecs: SCAN_GLOBS,
    skipSegmentTest,
  })
  const { texts, skippedMissing } = readSources(top, face, listed)
  const files = listed.filter((rel) => texts.has(rel))

  const perFile = new Map()
  let hitTotal = 0
  for (const rel of files) {
    const hits = judgeLiftLiterals(texts.get(rel))
    if (hits.length > 0) {
      perFile.set(rel, hits)
      hitTotal += hits.length
    }
  }

  const verdict = judgeAgainstAllowlist(perFile, allowlist.entries, { today })
  if (verdict.malformed) {
    console.log(`${C.yellow}⚠️  未判定:豁免台账 ${verdict.malformed}${C.reset}`)
    return 2
  }

  const rot = [...verdict.expired.map((x) => `到期:${x}`), ...verdict.stale]
  for (const v of verdict.violations) console.log(`${C.red}❌ 浮起散写(数值源应走 --lift-*):${v}${C.reset}`)
  for (const r of rot) console.log(`${C.red}❌ 豁免台账腐烂/到期:${r}${C.reset}`)
  if (skippedMissing.length > 0) {
    console.log(
      `${C.yellow}   · 工作树档跳过盘上缺失文件 ${skippedMissing.length} 个(机器态,不是业务结论):${skippedMissing.join(', ')}${C.reset}`,
    )
  }

  console.log(
    `容器 hover 浮起单一数值源守门结论:面=${faceLabel} 扫描 ${files.length} 文件 | ` +
      `散写命中 ${hitTotal} 枚 | 台账豁免 ${allowlist.entries.reduce((s, e) => s + e.liftCalls, 0)} 枚 | ` +
      `违规 ${verdict.violations.length} 枚 | 台账腐烂 ${rot.length} 枚` +
      (verdict.violations.length === 0 && rot.length === 0 ? ' ⇒ 通过' : ' ⇒ 红'),
  )
  return verdict.violations.length === 0 && rot.length === 0 ? 0 : 1
}

/**
 * 夹具自证。每一档都问两句:"这档摘掉判据会不会还绿"——变异自证住在被判的那一枚上。
 */
export function selfTestRun() {
  const cases = []
  const ok = (name, cond) => cases.push({ name, pass: !!cond })

  const clean = `
const cls = "flex items-center rounded-lg border bg-card p-3 transition-all ui-lift hover:border-primary/40 hover:bg-accent/40 shadow-sm"
`
  ok('① 干净容器(位移阴影走 ui-lift 源,bg/border/静态 shadow 合法)⇒ 0 命中', judgeLiftLiterals(clean).length === 0)

  const strayTranslate = `const c = "transition-all duration-300 hover:-translate-y-1 hover:border-primary/30"`
  ok('② hover:-translate-y 散写 ⇒ 1 命中', judgeLiftLiterals(strayTranslate).length === 1)

  const strayShadow = `const c = "transition-all hover:shadow-xl hover:shadow-primary/5"`
  const r2 = judgeLiftLiterals(strayShadow)
  ok('③ hover:shadow 散写(含色档)⇒ 按枚计数(2)', r2.length === 2 && r2.every((h) => h.dim === 'shadow'))

  const groupHover = `const c = "animate-pulse-glow-light group-hover:-translate-y-2 group-hover:shadow-xl"`
  ok('④ group-hover 变体链同样命中(substring 语义)', judgeLiftLiterals(groupHover).length === 2)

  const variantChain = `const c = "md:hover:shadow-lg sm:hover:-translate-y-0.5"`
  ok('⑤ 断点复合变体 md:hover: / sm:hover: ⇒ 命中', judgeLiftLiterals(variantChain).length === 2)

  const commented = `
// 这里曾写 hover:-translate-y-0.5 hover:shadow-md(注释里提一下不算散写)
/* hover:shadow-xl 也不该算 */
const keep = true
`
  ok('⑥ 注释里提及 ⇒ 0 命中(maskComments 生效,判字面量的门只遮注释)', judgeLiftLiterals(commented).length === 0)

  const imgPush = `const c = "object-cover transition-transform duration-500 group-hover:scale-105"`
  ok('⑦ 图片 hover 推开(scale 族)⇒ 不在射程(维度边界 ①)', judgeLiftLiterals(imgPush).length === 0)

  const staticShadow = `const c = "rounded-lg border bg-card p-3 shadow-lg shadow-primary/20 animate-pulse"`
  ok('⑧ 静态(常驻)shadow ⇒ 无 hover 段,0 命中(维度边界 ②)', judgeLiftLiterals(staticShadow).length === 0)

  // 变异自证:同一行摘掉 hover: 前缀(改成常驻),命中必须归零 —— 证明判的是 hover 语义段。
  const mutated = strayShadow.replace(/hover:/g, '')
  ok('⑨ 变异:摘掉 hover: 段 ⇒ 同串翻零(牙在语义段上)', judgeLiftLiterals(mutated).length === 0)
  // 变异自证:把 -translate-y 换成 translate-x(不在射程),原命中消失 —— 尺子指哪打哪。
  const axisSwap = strayTranslate.replace('-translate-y-1', '-translate-x-1')
  ok('⑩ 变异:translate-y → translate-x ⇒ 放行(边界如实,不假装全覆盖)', judgeLiftLiterals(axisSwap).length === 0)

  const perFile = new Map([
    ['a.tsx', [{ line: 3, dim: 'shadow', snippet: 'x' }]],
    ['c.tsx', [{ line: 9, dim: 'translate-y', snippet: 'z' }]],
  ])
  const entries = [
    { file: 'a.tsx', liftCalls: 1, reason: '按钮档 CTA 浮起是交互层级,不是容器', until: '2099-01-01' },
  ]
  const v = judgeAgainstAllowlist(perFile, entries, { today: '2026-11-03' })
  ok('⑪ 台账命中且份数配平 ⇒ 该文件零违规', v.violations.every((x) => !x.startsWith('a.tsx')))
  ok('⑫ 未登记的散写文件 ⇒ 判红点名', v.violations.length === 1 && v.violations[0].startsWith('c.tsx'))

  const perFilePlus = new Map([
    [
      'a.tsx',
      [
        { line: 3, dim: 'shadow', snippet: 'x' },
        { line: 7, dim: 'shadow', snippet: 'y' },
      ],
    ],
  ])
  ok(
    '⑬ 变异:同档多出一枚未登记散写 ⇒ 判红',
    judgeAgainstAllowlist(perFilePlus, entries, { today: '2026-11-03' }).violations.length === 1,
  )

  ok(
    '⑭ 变异:豁免不再命中 ⇒ 清单腐烂',
    judgeAgainstAllowlist(new Map([['a.tsx', []]]), entries, { today: '2026-11-03' }).stale.length >= 1,
  )
  ok(
    '⑮ 登记文件整体不在扫描集 ⇒ 也算清单腐烂(豁免不许比判据活得久)',
    judgeAgainstAllowlist(new Map(), entries, { today: '2026-11-03' }).stale.length === 1,
  )
  ok(
    '⑯ 到期条目 ⇒ 顶红(exempt 归零)',
    judgeAgainstAllowlist(perFile, [{ ...entries[0], until: '2020-01-01' }], { today: '2026-11-03' })
      .expired.length === 1,
  )
  ok(
    '⑰ 缺 until ⇒ 未判定(malformed)',
    !!judgeAgainstAllowlist(perFile, [{ file: 'a.tsx', liftCalls: 1, reason: '足够长的原因说明文字' }], {
      today: '2026-11-03',
    }).malformed,
  )
  ok(
    '⑱ reason 短于 10 字 ⇒ 未判定(malformed)',
    !!judgeAgainstAllowlist(perFile, [{ file: 'a.tsx', liftCalls: 1, reason: '太短', until: '2099-01-01' }], {
      today: '2026-11-03',
    }).malformed,
  )

  let rc = 0
  for (const c of cases) {
    if (!c.pass) rc = 1
    console.log(`${c.pass ? `${C.green}✅` : `${C.red}❌`} ${c.name}${C.reset}`)
  }
  console.log(
    `自检:${cases.filter((c) => c.pass).length}/${cases.length}${rc === 0 ? ' 全过' : ' 有失败'}`,
  )
  return rc
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  run({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    selfTest: argv.includes('--self-test'),
  })
    .then((code) => process.exit(code))
    .catch((e) => {
      const undetermined = e instanceof Undetermined
      console.log(
        `${undetermined ? C.yellow : C.red}${undetermined ? '⚠️  未判定(取材失败)' : '❌ 守门异常'}: ${e?.message ?? e}${C.reset}`,
      )
      process.exit(2)
    })
}

export const __test__ = {
  LEDGER_REL,
  PREFILTER_RE,
  R_SHADOW,
  R_TRANSLATE_Y,
  SCAN_GLOBS,
  judgeAgainstAllowlist,
  judgeLiftLiterals,
  selfTestRun,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
