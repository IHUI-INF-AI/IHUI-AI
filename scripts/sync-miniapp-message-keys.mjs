#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 器物:必须打印逐语计划与结论行 */
/**
 * sync-miniapp-message-keys.mjs —— 「共享屏要用、而本端词包整块查无」的词条逐字搬运器。
 *
 * 立因(2026-11-03):`check-miniapp-mirror-fidelity.mjs` 的 packAbsent 维(本端包 ∪ shared 都查无
 * 该命名空间 ⇒ 那一屏全部文案取不到)是**跨端驾驶舱连日复发的那道红**(mirror-pack-namespace-missing,
 * 11-03 现读 09:20 与 10:32 两轮同身份各冒一次)。尺子的头注把出路写成"人工从 messages/mobile-rn
 * 或 shared 逐字搬",而全仓无器物 ⇒ 每次都要人当场手抄五语言 JSON,红隔一天又长回来(§0.9 判据在、
 * 工具缺 = 没有)。本器把这格变成机械动作:只搬**已存在的译文**,一个字母也不代拟。
 *
 * 铁律:
 *   ① 零复算判据(§0.6):"缺哪些命名空间/哪些键"全部取自 check-miniapp-mirror-fidelity 自己的
 *      `--json` 出口(packAbsent + rows.sharedKeys),本层不另写一套取词尺。
 *   ② 只补空、绝不覆盖(同 lib/env 回填那条纪律):本端包已有该键 ⇒ 跳过并计数,不改一个字。
 *   ③ 基准侧取不到 ⇒ unresolvable 点名,不冒绿(§0.3);搬运值必须与基准侧逐字节相等(搬完回读自证)。
 *   ④ 写盘前过归属闸(lib/git-paths.mjs 的 ownershipGate 单源):该路径工作树副本脏 ⇒ held,不写。
 *   ⑤ 只做最小插入(不整篇重排):在既有 JSON 文本里定位插入点,逐文件插入后必须 JSON.parse 复验,
 *      复验不过整文件还原并不落地(prettier 重排 19 万字节文件 = 无关巨型 diff)。
 *
 * 用法:`node scripts/sync-miniapp-message-keys.mjs [--apply] [--json] [--self-test]`
 * 落库:只写工作树并申报落点账本,提交交 sweepCrossEndLandingLeg / auto-commit-quiet 收。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { atomicWriteFileSync } from './lib/atomic-write.mjs'
import { appendLanding } from './lib/cross-end-landing-ledger.mjs'
import { ownershipGate } from './lib/git-paths.mjs'
import { gitRaw } from './lib/face-reader.mjs'

/** 实测工作树 blob 的 oid;取不到返回 null(调用方不得把 null 当"已核验")。命令借单源 gitRaw。 */
export function worktreeBlobOid(rel, root = ROOT) {
  try {
    return String(gitRaw(['hash-object', '--', rel], root))
      .trim()
      .toLowerCase()
  } catch {
    return null
  }
}

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '..')

export const CROSS_END_LEG = 'miniapp-message-keys'
export const LANGS = Object.freeze(['zh-CN', 'zh-TW', 'en', 'ja', 'ko'])
/** 基准侧优先序:RN 包(共享屏文案的出生地)→ shared → web。取到即停,逐字搬。 */
export const BASELINE_PACKS = Object.freeze(['mobile-rn', 'shared', 'web'])
export const TARGET_PACK = 'miniapp-taro'

const packRel = (pack, lang) => `packages/i18n/messages/${pack}/${lang}.json`

/**
 * 从还原度门自己的 --json 出口取出"本端整块查无的命名空间"。
 * 真形状现读:`rows[].sharedKeys` 是**计数**(不是键数组),门只把 packAbsent 命名空间逐枚给出 ⇒
 * 搬运面 = 基准侧该命名空间的**整块内容**。这不是偷懒:packAbsent 的定义就是"那一屏全部文案
 * 取不到",而"哪些键属于该屏"属尺子的取词判据,本层重算一遍 = 第二份真相源(§0.6 禁)。
 */
export function needsFromFidelity(fidelityJson) {
  const rows = Array.isArray(fidelityJson?.rows) ? fidelityJson.rows : []
  const set = new Set()
  for (const r of rows) for (const ns of r.packAbsent || []) set.add(ns)
  return [...set].sort()
}

/** 逐语取值:整块搬 —— 基准侧该命名空间每一枚键都进计划;本端已有的跳过;全查无 ⇒ 点名。 */
export function planMoves(namespaces, readPack) {
  const moves = []
  const unresolvable = []
  for (const ns of namespaces) {
    for (const lang of LANGS) {
      const have = readPack(TARGET_PACK, lang)
      let baseline = null
      let from = null
      for (const pack of BASELINE_PACKS) {
        const j = readPack(pack, lang)
        if (j?.[ns] && typeof j[ns] === 'object') {
          baseline = j[ns]
          from = pack
          break
        }
      }
      if (baseline === null) {
        unresolvable.push(`${ns}@${lang}`)
        continue
      }
      for (const [key, value] of Object.entries(baseline)) {
        if (typeof value !== 'string') continue
        if (have?.[ns]?.[key] !== undefined) continue // 只补空:已有 ⇒ 一个字母不动
        moves.push({ ns, key, lang, value, from })
      }
    }
  }
  return { moves, unresolvable }
}

/**
 * 在既有 JSON 文本里做最小插入:命名空间不存在 ⇒ 根对象末尾追加;存在 ⇒ 在该对象末尾追加键。
 * 返回 null = 插入点定位失败(调用方必须放弃该文件,不得整篇重排)。
 */
export function insertIntoJson(text, ns, entries) {
  const rootClose = text.lastIndexOf('}')
  if (rootClose < 0) return null
  const body = text.slice(0, rootClose)
  const nsOpen = findNsOpen(body, ns)
  if (nsOpen === -1) {
    // 整块缺失 ⇒ 必须发**嵌套对象**:"career" 作为顶层命名空间不存在时,尺子的 packAbsent 维照旧命中
    const tail = body.replace(/\s*$/, '')
    const add = entries
      .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(',\n')
    const sep = tail.endsWith('{') ? '' : ','
    return `${tail}${sep}\n  ${JSON.stringify(ns)}: {\n${add}\n  }\n}\n`
  }
  const close = matchCloseBrace(text, nsOpen)
  if (close === -1) return null
  const inner = text.slice(nsOpen + 1, close)
  const indented = inner.match(/\n([ \t]+)"/)
  const pad = indented ? indented[1] : '    '
  const trimmed = inner.replace(/\s+$/, '')
  const closeIndent = inner.slice(trimmed.length).match(/[ \t]*$/)[0]
  // 空块({} 与 { \n })既没有内容也不带尾逗号 ⇒ 补第一枚键不得加逗号(trimmed 为空串时 endsWith 恒假)
  const sep = trimmed.length === 0 || trimmed.endsWith('{') ? '' : ','
  const add = entries.map(([k, v]) => `${pad}${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')
  return `${text.slice(0, nsOpen + 1)}${trimmed}${sep}\n${add}\n${closeIndent}${text.slice(close)}`
}

/** 找顶层 "ns": { 的开括号位置(字符串感知扫描;词包是纯 JSON,无注释)。 */
function findNsOpen(body, ns) {
  const name = JSON.stringify(ns)
  let i = 0
  while (i < body.length) {
    const c = body[i]
    if (c === '"') {
      const end = skipString(body, i)
      if (body.slice(i, end) === name) {
        const colon = body.slice(end).search(/\S/)
        const at = end + (colon === -1 ? 0 : colon)
        if (body[at] === ':') {
          const brace = body.indexOf('{', at)
          return brace === -1 ? -1 : brace
        }
      }
      i = end
      continue
    }
    i++
  }
  return -1
}

function skipString(s, start) {
  let i = start + 1
  while (i < s.length) {
    if (s[i] === '\\') i += 2
    else if (s[i] === '"') return i + 1
    else i++
  }
  return s.length
}

/** 从 open 处的 { 配平到对应 } 的下标;配不平 ⇒ -1(调用方放弃,不猜)。 */
function matchCloseBrace(s, open) {
  let depth = 0
  let i = open
  while (i < s.length) {
    const c = s[i]
    if (c === '"') {
      i = skipString(s, i)
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

function defaultReadPack(pack, lang) {
  const rel = packRel(pack, lang)
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return null
  try {
    return JSON.parse(readFileSync(abs, 'utf8'))
  } catch {
    return null
  }
}

export function runFidelityJson() {
  const script = join(HERE, 'check-miniapp-mirror-fidelity.mjs')
  try {
    const out = execFileSync(process.execPath, [script, '--json'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
    return JSON.parse(out.toString('utf8'))
  } catch (e) {
    return { __error: String(e?.message ?? e).split('\n')[0].slice(0, 160) }
  }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const { runSelfTest } = await import('./tests/sync-miniapp-message-keys.test.mjs')
    process.exit(runSelfTest())
  }
  const apply = argv.includes('--apply')
  const asJson = argv.includes('--json')
  // 未知旗一律拒绝:静默忽略会让周期腿把打错的 --apply 当成"预演不写盘",每轮空转报绿(空转守卫)
  const KNOWN = new Set(['--apply', '--json', '--self-test'])
  const unknown = argv.filter((a) => !KNOWN.has(a))
  if (unknown.length) {
    console.error(`❌ 未知参数 ${unknown.join(' ')} ⇒ 不接受静默忽略(周期腿会把它读成"预演")`)
    process.exit(2)
  }

  const fidelity = runFidelityJson()
  if (fidelity.__error) {
    console.error(`❌ 还原度门取不到(未判定,不冒绿):${fidelity.__error}`)
    process.exit(2)
  }
  const needs = needsFromFidelity(fidelity)
  const { moves, unresolvable } = planMoves(needs, defaultReadPack)
  if (asJson) {
    console.log(
      JSON.stringify({
        leg: CROSS_END_LEG,
        state: needs.length ? (moves.length ? 'pending' : 'unresolvable') : 'clean',
        namespaces: needs,
        planned: moves.length,
        unresolvable,
        applied: apply,
      }),
    )
    if (!moves.length) process.exit(unresolvable.length ? 2 : 0)
    if (!apply) return
  }
  if (!needs.length) {
    console.log(
      `结论 landing=0 无变化=0 held=0 写出=0 leg=${CROSS_END_LEG} ledger=ok needs=0 未判定=0(本端词包无整块缺口)`,
    )
    return
  }
  if (!asJson) {
    console.log(`📚 词包搬运计划(基准侧 ${BASELINE_PACKS.join('→')} → ${TARGET_PACK})`)
    for (const m of moves)
      console.log(`   ${m.lang}\t${m.ns}.${m.key}\t← ${m.from}\t${JSON.stringify(m.value).slice(0, 40)}`)
    if (unresolvable.length)
      console.log(`⚠️ 基准侧全查无 ⇒ 不搬不代拟(${unresolvable.length} 枚):${unresolvable.join(', ')}`)
  }
  if (!moves.length) {
    console.log(
      `结论 landing=0 无变化=0 held=0 写出=0 leg=${CROSS_END_LEG} ledger=ok needs=${needs.length} 未判定=${unresolvable.length ? 'unresolvable' : '0'}`,
    )
    if (unresolvable.length) process.exit(2)
    return
  }
  if (!apply) {
    console.log(`(预演模式,未写盘;加 --apply 落地。计划 ${moves.length} 枚)`)
    return
  }

  const gate = ownershipGate({ root: ROOT })
  const byLang = new Map()
  for (const m of moves) {
    const list = byLang.get(m.lang) || []
    list.push([m.key, m.value, m.ns])
    byLang.set(m.lang, list)
  }
  const written = []
  const held = []
  const failed = []
  for (const [lang, list] of byLang) {
    const rel = packRel(TARGET_PACK, lang)
    const reason = gate.blocked(rel)
    if (reason) {
      held.push(rel)
      console.log(`🔒 held(归属未明 ⇒ 不写):${reason}`)
      continue
    }
    const before = readFileSync(join(ROOT, rel), 'utf8')
    const byNs = new Map()
    for (const [key, value, ns] of list) {
      const e = byNs.get(ns) || []
      e.push([key, value])
      byNs.set(ns, e)
    }
    let text = before
    let ok = true
    for (const [ns, entries] of byNs) {
      const next = insertIntoJson(text, ns, entries)
      if (next === null) {
        ok = false
        break
      }
      text = next
    }
    if (!ok) {
      failed.push(`${rel}(插入点定位失败 ⇒ 整文件不动)`)
      continue
    }
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      failed.push(`${rel}(回读 JSON.parse 失败:${String(e.message).slice(0, 60)})`)
      continue
    }
    // 搬完逐枚回读自证:必须与基准侧取值逐字节相等,否则不算搬过(§0.14)
    for (const [key, value, ns] of list) {
      if (parsed?.[ns]?.[key] !== value) {
        failed.push(`${rel}(${ns}.${key} 回读值与基准侧不一致)`)
        ok = false
      }
    }
    if (!ok) continue
    atomicWriteFileSync(join(ROOT, rel), text, { encoding: 'utf8' })
    written.push(rel)
    console.log(`✓ 已写 ${rel}(补 ${list.length} 枚,零覆盖)`)
  }

  const entries = []
  const unhashable = []
  for (const rel of written) {
    const oid = worktreeBlobOid(rel, ROOT)
    if (oid) entries.push({ at: new Date().toISOString(), leg: CROSS_END_LEG, path: rel, blobOid: oid })
    else unhashable.push(rel)
  }
  let ap = { appended: 0, deduped: 0, rejected: [] }
  try {
    ap = appendLanding(entries, { root: ROOT })
  } catch (e) {
    ap = { appended: 0, deduped: 0, rejected: [], failed: String(e?.message ?? e).slice(0, 120) }
  }
  const landing = ap.appended + ap.deduped
  const bad = []
  if (ap.rejected?.length) bad.push(`账本拒收:${ap.rejected.map((r) => `${r.path}(${r.reason})`).join(' ')}`)
  if (ap.failed) bad.push(`账本写入异常:${ap.failed}`)
  if (unhashable.length) bad.push(`落点 blob 取不到:${unhashable.join(' ')}`)
  if (failed.length) bad.push(`未写:${failed.join(' | ')}`)
  const ledgerState = bad.length ? 'unjudged' : 'ok'
  console.log('─'.repeat(64))
  console.log(
    `结论 landing=${landing}(新登记 ${ap.appended}/在册去重 ${ap.deduped})` +
      ` 计划=${moves.length}` +
      ` held=${held.length}` +
      (gate.ok ? '' : ' ownership=unjudged') +
      ` 写出=${written.length}` +
      ` leg=${CROSS_END_LEG}` +
      ` ledger=${ledgerState}` +
      ` 基准侧查无=${unresolvable.length}` +
      ` landingPath=.ihui-agent/state/cross-end-landing.jsonl`,
  )
  if (bad.length) {
    console.error(`❌ 写了盘但申报未竟全功 ⇒ 不按成功交出去:${bad.join(' | ')}`)
    process.exit(1)
  }
  if (!gate.ok) process.exit(2)
}

export const __test__ = {
  needsFromFidelity,
  planMoves,
  insertIntoJson,
  findNsOpen,
  matchCloseBrace,
  LANGS,
  BASELINE_PACKS,
  TARGET_PACK,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
