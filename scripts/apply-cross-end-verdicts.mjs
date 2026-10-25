#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * apply-cross-end-verdicts.mjs — 裁决件 → 登记器的**词表适配层**(默认只读预演)。
 *
 * 治的是哪一格(2026-10-26 实测):子代理产出的跨端裁决件用一套词表
 * (`verdict: mirrored | missing | not-applicable | declare`),而落地器
 * `auto-register-cross-end.mjs` 的 web 分支只认 `aligned | excluded | gap` ——
 * 于是 `mirrored` / `not-applicable` 既不落地、也不进 refused,整批裁决**静默消失**。
 * 这不是判据错,是两侧词表没对上;修法必须是**一处适配**,而不是让每个裁决者去猜落地器的词。
 *
 * 本器只做三件事,不重判任何一格:
 *   ① web 档词表归一:mirrored → aligned、not-applicable → excluded、missing → gap(保持缺口);
 *      未知值 ⇒ 当场 refused(§0.10:失效方向是多要一次定向说明,不是静默放过);
 *   ② miniapp 档原样透传(declare/missing/not-applicable 落地器已认);
 *   ③ 归一后的清单写到临时文件,再调 `auto-register-cross-end.mjs --proposals=<tmp>`;
 *      `--apply` 与 `--record-verdicts` 原样透传给落地器(本器不自己写 registry/标记/台账)。
 *
 * 判据零复算(§0.6):共享屏/RN/小程序枚举、结构校验、置信度门槛、写盘全部在落地器那一份实现里。
 * 取材面:裁决件是子代理产物(临时件),本器只读它;写入面完全交给落地器(它自己按 HEAD 面取材)。
 *
 * Usage:
 *   node scripts/apply-cross-end-verdicts.mjs --proposals=<file|dir>            # 预演(打印归一与拒收)
 *   node scripts/apply-cross-end-verdicts.mjs --proposals=<file|dir> --apply    # 真落地(委托落地器)
 *   node scripts/apply-cross-end-verdicts.mjs --proposals=<dir> --apply --record-verdicts
 *   node scripts/apply-cross-end-verdicts.mjs --proposals=<file> --json
 *   node scripts/apply-cross-end-verdicts.mjs --self-test
 *
 * 退出码:0 = 归一完成(预演或落地器成功);1 = 有拒收项(未知词表/结构不符);
 *         2 = 未判定(取不到裁决件 / 落地器缺席)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp', 'cross-end-verdicts')

/** 词表归一唯一表(web 档)。值 = 落地器认的词;null = 保持缺口(不落地)。 */
export const WEB_VERDICT_ALIASES = Object.freeze({
  aligned: 'aligned',
  mirrored: 'aligned',
  excluded: 'excluded',
  'not-applicable': 'excluded',
  gap: 'gap',
  missing: 'gap',
})

/**
 * 归一单条(纯函数,零 IO)。miniapp 档原样返回。
 * refused 非空表示这条不能交给落地器 —— 由调用方大声点名,不许静默丢。
 */
export function normalizeVerdictItem(item) {
  if (!item || typeof item !== 'object') return { ok: false, why: '条目不是对象' }
  const verdict = String(item.verdict ?? '').trim()
  if (!verdict) return { ok: false, why: '缺 verdict' }
  if (item.web) {
    const mapped = WEB_VERDICT_ALIASES[verdict]
    if (mapped === undefined) return { ok: false, why: `web 档未知 verdict=${verdict}(词表未登记)` }
    if (mapped === 'aligned' && !item.rn) return { ok: false, why: `verdict=${verdict} 但缺 rn(屏路径)` }
    if (mapped === 'excluded' && String(item.evidence ?? item.reason ?? '').trim().length < 10)
      return { ok: false, why: `verdict=${verdict} 但证据少于 10 字` }
    return { ok: true, kind: 'web', item: { ...item, verdict: mapped }, from: verdict, to: mapped }
  }
  if (item.shared) {
    const allowed = new Set(['declare', 'missing', 'not-applicable'])
    if (!allowed.has(verdict)) return { ok: false, why: `miniapp 档未知 verdict=${verdict}` }
    return { ok: true, kind: 'miniapp', item, from: verdict, to: verdict }
  }
  return { ok: false, why: '条目既无 web 也无 shared 键' }
}

/** 读一份或一目录裁决件,逐条归一。 */
export function normalizeAll(list) {
  const out = { web: [], miniapp: [], keptGap: [], refused: [], counts: {} }
  const bump = (k) => (out.counts[k] = (out.counts[k] ?? 0) + 1)
  for (const it of list) {
    const r = normalizeVerdictItem(it)
    if (!r.ok) {
      out.refused.push({ item: it?.web ?? it?.shared ?? '?', why: r.why })
      continue
    }
    bump(`${r.from}→${r.to}`)
    if (r.kind === 'web' && r.to === 'gap') {
      out.keptGap.push({ web: r.item.web, why: String(r.item.evidence ?? '').slice(0, 80) })
      continue
    }
    out[r.kind].push(r.item)
  }
  return out
}

function readProposalFiles(target) {
  const abs = resolve(ROOT, target)
  if (!existsSync(abs)) throw new Error(`裁决件不存在:${target}`)
  const files = []
  const walk = (p) => {
    if (statSync(p).isDirectory()) for (const e of readdirSync(p)) walk(join(p, e))
    else if (p.endsWith('.json')) files.push(p)
  }
  walk(abs)
  const items = []
  for (const f of files) {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(f, 'utf8'))
    } catch (e) {
      throw new Error(`裁决件解析失败 ${basename(f)}:${e.message}`)
    }
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null
    if (!list) throw new Error(`裁决件不是数组:${basename(f)}`)
    for (const it of list) items.push(it)
  }
  return { files: files.length, items }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const r = selfTest()
    console.log(`[self-test] ${r.pass}/${r.total} 通过`)
    process.exit(r.pass === r.total ? 0 : 1)
  }
  const pArg = argv.find((a) => a.startsWith('--proposals='))
  if (!pArg) {
    console.error('用法: node scripts/apply-cross-end-verdicts.mjs --proposals=<file|dir> [--apply] [--record-verdicts] [--json]')
    process.exit(2)
  }
  const json = argv.includes('--json')
  const apply = argv.includes('--apply')
  const record = argv.includes('--record-verdicts')

  let input
  try {
    input = readProposalFiles(pArg.slice('--proposals='.length))
  } catch (e) {
    console.error(`❌ 未判定:${e?.message ?? e}`)
    process.exit(2)
  }
  const n = normalizeAll(input.items)
  const report = {
    files: input.files,
    items: input.items.length,
    counts: n.counts,
    keptGap: n.keptGap.length,
    refused: n.refused,
    delegated: { web: n.web.length, miniapp: n.miniapp.length, applied: false, exitCode: null, output: null },
  }

  const lander = join(HERE, 'auto-register-cross-end.mjs')
  if (!existsSync(lander)) {
    console.error(`❌ 未判定:落地器缺席 ${lander}`)
    process.exit(2)
  }

  if (n.web.length + n.miniapp.length > 0) {
    mkdirSync(TMP_DIR, { recursive: true })
    const outFile = join(TMP_DIR, `normalized-${Date.now()}.json`)
    writeFileSync(outFile, JSON.stringify([...n.web, ...n.miniapp], null, 1), 'utf8')
    const args = [lander, `--proposals=${outFile}`, '--json']
    if (apply) args.push('--apply')
    if (record) args.push('--record-verdicts')
    try {
      const out = execFileSync(process.execPath, args, {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10 * 60 * 1000,
        maxBuffer: 1 << 24,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      report.delegated.applied = apply
      report.delegated.exitCode = 0
      report.delegated.output = String(out ?? '').trim()
    } catch (e) {
      report.delegated.applied = apply
      report.delegated.exitCode = typeof e?.status === 'number' ? e.status : null
      report.delegated.output = `${e?.stdout ?? ''}${e?.stderr ?? ''}`.trim()
    } finally {
      try {
        rmSync(outFile, { force: true })
      } catch {
        /* 临时件删不掉不影响结论 */
      }
    }
  }

  if (json) {
    console.log(JSON.stringify(report, null, 1))
  } else {
    console.log(`裁决件 ${report.files} 份 / ${report.items} 条`)
    for (const [k, v] of Object.entries(report.counts)) console.log(`  ${k}: ${v}`)
    console.log(`  保持缺口(missing): ${report.keptGap}`)
    console.log(`  拒收: ${report.refused.length}`)
    for (const r of report.refused) console.log(`    ✗ ${r.item} — ${r.why}`)
    console.log(`  委托落地器: web ${report.delegated.web} / miniapp ${report.delegated.miniapp}` +
      `${report.delegated.applied ? ` | apply rc=${report.delegated.exitCode}` : ' (预演,未写盘)'}`)
    if (!apply) console.log('  加 --apply 真落地(本器不自己写任何文件)')
  }
  process.exit(report.refused.length > 0 ? 1 : 0)
}

/** 纯函数自检:不依赖仓内文件,断言词表与拒收方向。 */
export function selfTest() {
  const cases = [
    ['mirrored→aligned', normalizeVerdictItem({ web: 'a', rn: 'x.tsx', verdict: 'mirrored', evidence: 'e'.repeat(12) }).to === 'aligned'],
    ['aligned 原样', normalizeVerdictItem({ web: 'a', rn: 'x.tsx', verdict: 'aligned', evidence: 'e'.repeat(12) }).to === 'aligned'],
    ['not-applicable→excluded', normalizeVerdictItem({ web: 'a', verdict: 'not-applicable', evidence: 'App 不承载管理后台,且 RN 侧无对应屏与端点' }).to === 'excluded'],
    ['missing→gap', normalizeVerdictItem({ web: 'a', verdict: 'missing', evidence: 'e'.repeat(12) }).to === 'gap'],
    ['未知词表 ⇒ 拒', normalizeVerdictItem({ web: 'a', verdict: 'whatever' }).ok === false],
    ['mirrored 缺 rn ⇒ 拒', normalizeVerdictItem({ web: 'a', verdict: 'mirrored' }).ok === false],
    ['excluded 短证据 ⇒ 拒', normalizeVerdictItem({ web: 'a', verdict: 'not-applicable', evidence: '短' }).ok === false],
    ['miniapp declare 透传', normalizeVerdictItem({ shared: 's', verdict: 'declare' }).ok === true],
    ['miniapp 未知 ⇒ 拒', normalizeVerdictItem({ shared: 's', verdict: 'mirrored' }).ok === false],
    ['非对象 ⇒ 拒', normalizeVerdictItem(null).ok === false],
  ]
  const pass = cases.filter(([, ok]) => ok).length
  for (const [name, ok] of cases) console.log(`  ${ok ? '✓' : '✗'} ${name}`)
  return { pass, total: cases.length }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { normalizeVerdictItem, normalizeAll, WEB_VERDICT_ALIASES, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
