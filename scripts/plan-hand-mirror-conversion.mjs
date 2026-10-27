#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 器物为 CLI 工具,需 console 输出诊断与台账 */
/**
 * plan-hand-mirror-conversion.mjs —— 把「端内手写镜像页」转成「壳承载形制」的**规划器**(2026-10-27 立)。
 *
 * 为什么要有它(现读):小程序 168 枚在册镜像页里 122 枚已是壳承载形制(渲染就是共享屏本体,
 * 源头改一笔这一页自动跟随),而 **46 枚仍是端内手写、合计 15224 行**。造页器对后者一条都不产 ——
 * `gen-miniapp-mirror.mjs:950`「页面文件已存在且在册 ⇒ skip,不重复造页」,于是这 46 枚永久停在
 * "每改一次源头都要重抄一遍" 那一格,正是目标里"最大化减少开发"要消掉的面。
 *
 * 为什么默认只规划不落地:转换会**删掉端内手写的几百行**。手写页里可能带着共享屏根本没有的
 * 端内能力(微信授权按钮、分享卡、端内组件/私有接口),转成壳承载就把这些能力静默删了 ——
 * 那是能力损失,不是重构。判据一律**相对**取(不手写白名单,§0.6):
 *   这一页用到的 Taro.X 方法 / `useXxx` 钩子 / `@/…` 端内模块,若在「共享屏本体 ∪ RN 壳」里
 *   一个都没出现 ⇒ 它是这一页独有的能力 ⇒ 拒转,并把符号逐条点名(拿不准就是拒,不是放行)。
 * 壳不存在 / 壳不渲染这一屏 ⇒ 同样拒(那两型是承载链本身没建起来,归造页腿与声明链,不归本器)。
 *
 * 用法:
 *   node scripts/plan-hand-mirror-conversion.mjs            # 人读汇总 + 分桶计数
 *   node scripts/plan-hand-mirror-conversion.mjs --json      # 机读(逐条带 reasons)
 *   node scripts/plan-hand-mirror-conversion.mjs --top=20    # 可转清单多列几条
 *   node scripts/plan-hand-mirror-conversion.mjs --self-test # 判据自检(纯内存夹具)
 * 退出码(§0.3):0 判成 / 2 未判定(取不到面、枚举止于 0 行手写页而无台账可读)。
 * 判机器与账面状态 ⇒ 只读,不进提交链;落地腿(改写 + 落 HEAD)由后续一票接,须走对象空间。
 */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

import { __test__ as fidelity } from './check-miniapp-mirror-fidelity.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { shellTargetRel } from './lib/rn-shell-refs.mjs'
import { __test__ as gen } from './gen-miniapp-mirror.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { computeFidelity, batchReadTexts } = fidelity
const { collectMiniapp, rnConsumes } = cov

/** 一页文本里"能力-bearing"的三族标识(方法名 / 钩子 / 端内模块),用于相对取差。 */
export function capabilityTokens(text) {
  const t = String(text ?? '')
  const out = new Set()
  for (const m of t.matchAll(/\bTaro\.([A-Za-z_][A-Za-z0-9_]*)/g)) out.add(`Taro.${m[1]}`)
  for (const m of t.matchAll(/\buse([A-Z][A-Za-z0-9_]*)\b/g)) out.add(`use${m[1]}`)
  for (const m of t.matchAll(/from\s*['"](@\/[^'"]+)['"]/g)) out.add(m[1])
  return out
}

/**
 * 这一页相对「共享屏本体 ∪ RN 壳」多出来的能力符号。空集 ⇒ 页面没带私有行为,可转。
 * pageTokens/sharedTokens/shellTokens 均为 Set|string(字符串现算)。
 */
export function pageOnlyCapabilities({ pageTokens, sharedText, shellText }) {
  const src = `${sharedText || ''}\n${shellText || ''}`
  const base = pageTokens instanceof Set ? pageTokens : capabilityTokens(pageTokens)
  const out = []
  for (const tok of base) {
    const re = new RegExp(tok.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\b')
    if (!re.test(src)) out.push(tok)
  }
  return out.sort()
}

/** 一枚手写镜像页的转换判定(纯判据,不写盘)。 */
export function judgeConversion({ spec, pageText, shellText, sharedText, shellName = null }) {
  const name = String(spec || '')
    .split('/')
    .pop()
    .replace(/\.[jt]sx$/, '')
  if (!pageText) return { spec, kind: 'undetermined', why: '页面正文取不到' }
  if (shellText === null || shellText === undefined)
    return { spec, kind: 'no-shell', why: `${shellTargetRel(name)} 在本面不存在` }
  if (!rnConsumes({ text: shellText }, name))
    return {
      spec,
      kind: 'shell-not-rendering',
      why: `壳 ${name} 未消费共享屏(不带 @ihui/rn-app 取用该符号)`,
    }
  const extras = pageOnlyCapabilities({
    pageTokens: capabilityTokens(pageText),
    sharedText,
    shellText,
  })
  if (extras.length > 0)
    return {
      spec,
      kind: 'page-only-capability',
      why: `这一页带着共享屏/壳没有的能力:${extras.slice(0, 8).join(', ')}`,
    }
  const body = gen.buildShellPage({ spec, base: name.replace(/Screen$/, ''), shellText, shellName })
  if (body?.error) return { spec, kind: 'undetermined', why: `壳承载出口形态不合:${body.error}` }
  const lines = String(body?.content ?? body ?? '').split('\n').length
  return {
    spec,
    kind: 'convertible',
    why: '',
    shellLines: lines,
    pageLines: String(pageText).split('\n').length,
  }
}

/** 现算整份计划:只判 form==='hand' 的对(承载页无需转;断链页归造页腿)。 */
export function plan({ face = 'head' } = {}) {
  const res = computeFidelity(face)
  const hand = res.rows.filter((r) => r.form === 'hand')
  const miniapp = collectMiniapp(face)
  const byRoute = new Map(miniapp.map((p) => [p.route, p]))
  const specs = [...new Set(hand.map((r) => r.spec))]
  const sharedTexts = batchReadTexts(face, specs)
  const shellRels = specs.map((s) =>
    shellTargetRel(
      String(s)
        .split('/')
        .pop()
        .replace(/\.tsx$/, ''),
    ),
  )
  const shellTexts = batchReadTexts(face, shellRels)
  const rows = []
  for (const r of hand) {
    const page = byRoute.get(r.route)
    const shellRel = shellTargetRel(
      String(r.spec)
        .split('/')
        .pop()
        .replace(/\.tsx$/, ''),
    )
    rows.push({
      ...judgeConversion({
        spec: r.spec,
        pageText: page?.text ?? null,
        shellText: shellTexts.get(shellRel) ?? null,
        sharedText: sharedTexts.get(r.spec) ?? '',
      }),
      route: r.route,
      pageLines: String(page?.text ?? '').split('\n').length,
      missingKeys: r.missing.length,
    })
  }
  const bucket = (k) => rows.filter((x) => x.kind === k)
  // 拒转符号的**频次**表:这就是"改一处解锁 N 页"的经济账 —— 每个高频符号只要在共享层/兼容层
  // 补一次承载,对应那批页才可能自动转;没有这张表,转换就只能一页一页人工判(= 目标要消掉的东西)。
  const freq = new Map()
  for (const r of rows)
    for (const tok of String(r.why || '')
      .replace(/^.*能力:/, '')
      .split(', ')) {
      if (!tok || r.kind !== 'page-only-capability') continue
      freq.set(tok, (freq.get(tok) || 0) + 1)
    }
  return {
    face,
    pairs: res.pairs,
    hosted: res.hosted,
    hand: rows.length,
    counts: {
      convertible: bucket('convertible').length,
      'page-only-capability': bucket('page-only-capability').length,
      'no-shell': bucket('no-shell').length,
      'shell-not-rendering': bucket('shell-not-rendering').length,
      undetermined: bucket('undetermined').length,
    },
    // 行数是**按页**算的,而一页可以声明镜像多屏 ⇒ 按行加会把同一页的字节数算几遍
    // (实测按行加读出 30871,而按唯一路由加读出手写面真值)。合计与明细不同基准就是坏账。
    handLines: [...new Map(rows.map((r) => [r.route, r.pageLines || 0])).values()].reduce(
      (a, b) => a + b,
      0,
    ),
    convertibleLinesSaved: bucket('convertible').reduce(
      (a, x) => a + Math.max(0, (x.pageLines || 0) - x.shellLines),
      0,
    ),
    blockers: [...freq.entries()].sort((a, b) => b[1] - a[1]),
    rows,
  }
}

function main(argv) {
  const p = plan({ face: 'head' })
  if (argv.includes('--self-test')) {
    const cases = []
    const P = (name, got, want) =>
      cases.push({ name, pass: JSON.stringify(got) === JSON.stringify(want), got })
    P(
      'S1 相对取差:页面独有的 Taro 调用与端内模块被点名,共享屏也用的不算',
      pageOnlyCapabilities({
        pageTokens: new Set(['Taro.showToast', 'Taro.login', 'useShareAppMessage', '@/api/pay']),
        sharedText: `Taro.showToast(1)\nconst x = t('a.b')`,
        shellText: `Taro.showToast(2)`,
      }),
      ['@/api/pay', 'Taro.login', 'useShareAppMessage'],
    )
    P(
      'S2 无私有能力 ⇒ convertible(壳存在且消费本屏)',
      judgeConversion({
        spec: 'packages/app/src/features/demo/DemoScreen.tsx',
        pageText: `Taro.showToast({ title: 'ok' })`,
        shellText: `import { DemoScreen } from '@ihui/rn-app'\nexport default function DemoScreen(){return null}\nTaro.showToast(1)`,
        sharedText: `Taro.showToast(1)`,
      }).kind,
      'convertible',
    )
    P(
      'S3 壳不在面上 ⇒ no-shell(不猜)',
      judgeConversion({
        spec: 'packages/app/src/features/demo/DemoScreen.tsx',
        pageText: 'x',
        shellText: null,
        sharedText: '',
      }).kind,
      'no-shell',
    )
    P(
      'S4 壳不渲染这一屏 ⇒ shell-not-rendering',
      judgeConversion({
        spec: 'packages/app/src/features/demo/DemoScreen.tsx',
        pageText: 'y',
        shellText: `import { Other } from '@ihui/rn-app'`,
        sharedText: '',
      }).kind,
      'shell-not-rendering',
    )
    for (const c of cases)
      console.log(
        `${c.pass ? '✔' : '✖'} ${c.name}${c.pass ? '' : ` —— 实测:${JSON.stringify(c.got)}`}`,
      )
    console.log(`SELF-TEST ${cases.filter((c) => c.pass).length}/${cases.length} 通过`)
    return cases.every((c) => c.pass) ? 0 : 1
  }
  const topArg = argv.find((a) => a.startsWith('--top='))
  const top = topArg ? Number(topArg.slice(6)) : 8
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        { ...p, rows: p.rows.filter((r) => r.kind !== 'convertible').slice(0, 400) },
        null,
        2,
      ),
    )
    return 0
  }
  console.log(
    `[plan-hand-mirror-conversion] 面=${p.face} 对=${p.pairs} 已承载=${p.hosted} 手写=${p.hand}(${p.handLines} 行)` +
      ` ⇒ 可转=${p.counts.convertible}(省 ${p.convertibleLinesSaved} 行) ` +
      `带私有能力=${p.counts['page-only-capability']} 无壳=${p.counts['no-shell']} ` +
      `壳不渲染=${p.counts['shell-not-rendering']} 未判定=${p.counts.undetermined}`,
  )
  const conv = p.rows
    .filter((r) => r.kind === 'convertible')
    .sort((a, b) => b.pageLines - a.pageLines)
  for (const r of conv.slice(0, top))
    console.log(
      `   可转 ${r.route} ← ${r.spec}(${r.pageLines} 行 → ${r.shellLines} 行,缺 ${r.missingKeys} 键)`,
    )
  console.log(
    `ℹ️ 拦路符号频次(改一处共享层/兼容层承载 ⇒ 解锁这么多页;这是"值不值得建承载"的经济账):`,
  )
  for (const [tok, n] of p.blockers.slice(0, top))
    console.log(`   ${String(n).padStart(3)} 枚页卡在 ${tok}`)
  for (const r of p.rows
    .filter((x) => x.kind === 'page-only-capability')
    .slice(0, Math.max(0, top - 6)))
    console.log(`   拒转 ${r.route}:${r.why}`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ 未判定(异常):${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { capabilityTokens, pageOnlyCapabilities, judgeConversion, plan, ROOT }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
