#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 已退役看板程序的产品名对账门(禁名门)。
 *
 * 立项依据(全是现读):2026-10-18 机主裁决「彻底融合进项目,不可以单独搞出一个程序」,当晚该程序整体退役
 * (本机实测:`Get-Service ihui-*` 无该项、8816 无监听、`D:\DevEnv\monitor` 无其目录与二进制);
 * 2026-10-19 机主再令:**这个名字不允许再出现**。只靠人工记不住 —— 名字会随文档、脚本、注释、归档件回潮
 * (实测存量:非文档面 306 处/79 文件,文档面另有 README 51 + docs 103 + 归档 95)。本门把"不许出现"
 * 变成一条每次提交都跑的判据。
 *
 * 判据:
 *   N1 差值棘轮(§12e):锚点 = 该文件 HEAD 面自身命中数;只拦"本次把名字加回来/没删净"(索引命中 > HEAD 命中)。
 *      全量档/人工档只报存量,不判红 —— 存量归零之前升 blocking 就是恒红门。
 *   N2 豁免必须"验过才免"且会到期(§0.7):台账每条带 match/kind/reason/ticket/until;到期回队列重裁。
 *      **没有行内豁免标记** —— 行内标记本身就得写那个名字,自相矛盾。
 *   N3 取不到被审面/取不到台账 ⇒ exit 2 显式「未判定」,既不记绿也不冒红(§0.3);枚举到 0 个被审文件 ⇒ 判死。
 *
 * 取材面纪律(§0.4):全量档判 HEAD blob、--staged 判索引 blob、--worktree 仅人工逃生舱;两面旗同给 exit 2。
 *
 * 自指锁:门体自身与台账都**不得**含该名字的字面量 —— 匹配串以 base64 存,selfTest T6 反证
 * "任何一处把字面量写进门体即红"。
 *
 * 用法:node scripts/check-board-name-legacy.mjs [--staged|--worktree] [--self-test]
 * 跳过:HUSKY_SKIP_BOARD_NAME_LEGACY=1(跳门留痕,§0.10)
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER_REL = 'scripts/data/board-name-legacy-exemptions.json'
/** 匹配串(不写明文,见头注「自指锁」) */
const NEEDLE = Buffer.from('Z3JhZmFuYQ==', 'base64').toString('utf8')
/** 不参与扫描的落点(依赖/构建产物/对象库) */
const SKIP_PREFIXES = ['node_modules/', '.git/', '.next/', 'out/', 'dist/', 'build/', 'coverage/']

function git(args) {
  // 取材统一走层(scripts/lib/face-reader.mjs):绝对 git + quotepath + 显式 stdio/windowsHide
  // 由 gitRaw 同源提供,不再自拼裸 'git' 派生。
  return gitRaw(args, ROOT, { maxBuffer: 256 * 1024 * 1024 })
}

/** 命中行数(不区分大小写) */
export function countHits(text) {
  if (!text) return 0
  let n = 0
  for (const line of text.split('\n')) if (line.toLowerCase().includes(NEEDLE)) n++
  return n
}

/** 豁免台账:形状坏 ⇒ 拒绝判定(既不冒绿也不冒红) */
export function loadLedger(raw) {
  let j
  try {
    j = JSON.parse(raw)
  } catch (e) {
    return { ok: false, why: `JSON 解析失败:${e.message}` }
  }
  if (!Array.isArray(j?.entries)) return { ok: false, why: '缺 entries[]' }
  for (const e of j.entries) {
    for (const k of ['match', 'kind', 'reason', 'until']) {
      if (typeof e?.[k] !== 'string' || !e[k].trim()) return { ok: false, why: `条目缺 ${k}` }
    }
  }
  return { ok: true, entries: j.entries }
}

/** 返回 null(无豁免)/ {hit}(有效)/ {stale,why}(失效:到期或日期不可解析) */
export function exemptFor(entries, file, now) {
  const hit = entries.find((e) => (e.match.endsWith('/') ? file.startsWith(e.match) : file === e.match))
  if (!hit) return null
  const until = Date.parse(hit.until)
  if (!Number.isFinite(until)) return { stale: true, hit, why: `until 不可解析(${hit.until})` }
  if (until < now) return { stale: true, hit, why: `已到期(${hit.until})` }
  return { hit }
}

/** 清单与内容必须同面同轮(§0.4):head=ls-tree HEAD / index=暂存集 / worktree=全部跟踪文件。
 *  写错这一格就是 §5c 更正过的那一型:清单取索引、内容取磁盘 ⇒ 两面不同形,悬留替红顶绿。 */
function listFiles(face, run = git) {
  const out =
    face === 'head'
      ? run(['ls-tree', '-r', '--name-only', '-z', 'HEAD'])
      : face === 'index'
        ? run(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMRT', 'HEAD'])
        : run(['ls-files', '-z'])
  return out
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => !SKIP_PREFIXES.some((s) => p.startsWith(s)))
}

function readFace(face, file) {
  try {
    return face === 'head' ? git(['show', `HEAD:${file}`]) : face === 'index' ? git(['show', `:${file}`]) : fs.readFileSync(path.join(ROOT, file), 'utf8')
  } catch {
    return null
  }
}

export const __test__ = { NEEDLE, countHits, exemptFor, loadLedger, listFiles, SKIP_PREFIXES }

function selfTest() {
  const cases = []
  const t = (name, fn) => {
    try {
      fn()
      cases.push([true, name])
    } catch (e) {
      cases.push([false, `${name} —— ${e.message}`])
    }
  }
  const now = Date.now()
  t('T1 命中计数:含名行算 1、不含算 0、null 算 0', () => {
    if (countHits(`a ${NEEDLE} b`) !== 1) throw new Error('未命中')
    if (countHits('a b') !== 0) throw new Error('误命中')
    if (countHits(null) !== 0) throw new Error('null 应算 0')
    if (countHits(`X${NEEDLE.toUpperCase()}Y`) !== 1) throw new Error('大小写未归一')
  })
  t('T2 豁免有效:未到期 ⇒ 免', () => {
    const r = exemptFor([{ match: 'docker-compose.yml', kind: 'upstream-artifact', reason: 'r', until: '2099-01-01' }], 'docker-compose.yml', now)
    if (!r || r.stale) throw new Error('未生效')
  })
  t('T3 豁免到期 ⇒ stale(不静默放过)', () => {
    const r = exemptFor([{ match: 'a.md', kind: 'evidence-archive', reason: 'r', until: '2020-01-01' }], 'a.md', now)
    if (!r?.stale) throw new Error('到期没被识出')
    const bad = exemptFor([{ match: 'a.md', kind: 'x', reason: 'r', until: '不是日期' }], 'a.md', now)
    if (!bad?.stale) throw new Error('坏日期没被识出')
  })
  t('T4 目录前缀豁免只覆盖该前缀,不串门', () => {
    const ents = [{ match: '.ihui-agent/archive/', kind: 'evidence-archive', reason: 'r', until: '2099-01-01' }]
    if (!exemptFor(ents, '.ihui-agent/archive/x.md', now)) throw new Error('前缀未生效')
    if (exemptFor(ents, 'docs/x.md', now)) throw new Error('豁免越界')
  })
  t('T5 台账形状坏 ⇒ 拒绝判定(不记绿)', () => {
    if (loadLedger(JSON.stringify({ entries: [{ match: 'a' }] })).ok) throw new Error('缺字段被判可用')
    if (loadLedger('{').ok) throw new Error('坏 JSON 被判可用')
    if (!loadLedger(JSON.stringify({ entries: [] })).ok) throw new Error('空 entries 应可用(零豁免)')
  })
  t('T6 自指锁:门体自身不含该名字的字面量', () => {
    const src = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').toLowerCase()
    if (src.includes(NEEDLE)) throw new Error('门体含字面量,自指锁破')
  })
  t('T7 匹配串解码正确(判据不是空转)', () => {
    if (NEEDLE.length < 5) throw new Error(`解码后仅 ${NEEDLE.length} 字符 ⇒ 判据可能空转`)
  })
  t('T8 三面清单各自取源(§0.4 同面同轮;曾因清单取索引、内容取磁盘而悬留顶绿)', () => {
    const seen = []
    const stub = (args) => {
      seen.push(args[0] + (args[0] === 'diff' ? ':' + (args.includes('--cached') ? 'cached' : '?') : ''))
      return 'a.txt\0b.md\0node_modules/x.js\0'
    }
    const wt = listFiles('worktree', stub)
    const idx = listFiles('index', stub)
    const hd = listFiles('head', stub)
    for (const r of [wt, idx, hd]) {
      if (r.length !== 2) throw new Error(`过滤失效(得 ${r.length})`)
    }
    if (new Set(seen).size !== 3) throw new Error(`三面清单未各自取源:${seen.join('|')}`)
  })
  const pass = cases.filter(([ok]) => ok).length
  cases.forEach(([ok, n]) => console.log(`${ok ? '  ok' : '  FAIL'} ${n}`))
  console.log(`自检 ${pass}/${cases.length} 通过`)
  return pass === cases.length ? 0 : 1
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  if (staged && worktree) {
    console.log('❌ 未判定:--staged 与 --worktree 互斥(§0.4 同面同轮)')
    return 2
  }
  const face = staged ? 'index' : worktree ? 'worktree' : 'head'

  let ledgerRaw
  try {
    ledgerRaw = readFace(face, LEDGER_REL) ?? ''
    if (ledgerRaw === '') throw new Error('文件不存在于该面')
  } catch (e) {
    console.log(`❌ 未判定:豁免台账在该面取不到(${LEDGER_REL},面=${face})—— ${String(e.message).slice(0, 80)}`)
    return 2
  }
  const ledger = loadLedger(ledgerRaw)
  if (!ledger.ok) {
    console.log(`❌ 未判定:豁免台账不可用 —— ${ledger.why}(既不记绿也不冒红)`)
    return 2
  }

  let files
  try {
    files = listFiles(face)
  } catch (e) {
    console.log(`❌ 未判定:被审文件清单取不到 —— ${String(e.message).slice(0, 120)}`)
    return 2
  }
  if (files.length === 0) {
    console.log(`❌ 未判定:${face} 面枚举到 0 个被审文件(判死不记绿)`)
    return 2
  }

  const now = Date.now()
  // 改名文件的锚点必须落在**旧路径**上:HEAD 里没有新路径 ⇒ headHits=0 会把存量读成本次新增。
  const renameFrom = new Map()
  if (face === 'index') {
    const raw = git(['diff', '--cached', '-M', '--name-status', '-z', '--diff-filter=R', 'HEAD'])
    const parts = raw.split('\0').filter(Boolean)
    for (let i = 0; i + 2 < parts.length; i += 3) renameFrom.set(parts[i + 2], parts[i + 1])
  }
  const added = []
  const staleExemptions = []
  const exempted = []
  const stock = []
  let undetermined = 0

  for (const f of files) {
    const text = readFace(face, f)
    if (text === null) {
      undetermined++
      continue
    }
    if (text.includes('\u0000')) continue
    const hits = countHits(text)
    if (hits === 0) continue
    const ex = exemptFor(ledger.entries, f, now)
    if (ex?.stale) staleExemptions.push({ f, hits, why: ex.why })
    else if (ex) exempted.push({ f, hits, kind: ex.hit.kind })
    else if (face === 'index') {
      const oldPath = renameFrom.get(f)
      const headHits = countHits(readFace('head', oldPath ?? f))
      if (hits > headHits) added.push({ f, hits, headHits, from: oldPath })
      else stock.push({ f, hits })
    } else stock.push({ f, hits })
  }

  console.log(`[禁名门] 面=${face} 被审 ${files.length} 文件(取不到内容 ${undetermined})`)
  if (exempted.length) console.log(`  豁免在位 ${exempted.length}:${exempted.map((e) => `${e.f}(${e.kind}×${e.hits})`).join(' ')}`)
  for (const e of staleExemptions) console.log(`  ⚠ 豁免失效:${e.f} ×${e.hits} —— ${e.why} ⇒ 回队列`)
  if (stock.length) {
    console.log(`  存量 ${stock.length} 文件 / ${stock.reduce((a, e) => a + e.hits, 0)} 行(只报数,§12e;升 blocking 前置 = 存量归零)`)
    stock.slice(0, 10).forEach((e) => console.log(`    · ${e.f} ×${e.hits}`))
    if (stock.length > 10) console.log(`    … 另 ${stock.length - 10} 个`)
  }

  if (added.length) {
    console.log(`❌ ${added.length} 个文件把这个名字带进本次提交(索引命中 > HEAD 命中):`)
    added.forEach((v) => console.log(`   ${v.f} ${v.headHits}→${v.hits}`))
    console.log('   出路:改用 panel 系措辞;确需保留 ⇒ 在台账登记 match/kind/reason/ticket/until')
    return 1
  }
  if (staleExemptions.length) {
    console.log(`❌ ${staleExemptions.length} 条豁免已到期/失效(§0.7 豁免会到期)`);
    return 1
  }
  console.log('✅ 本次提交未新增该名字')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((rc) => process.exit(rc))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
