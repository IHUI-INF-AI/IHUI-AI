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
 *
 * ── 第二输入面:`--face=code-fallback`(2026-11-06 立;默认面 `pack` 的行为与结论行一字未改)──
 *
 * 立因:上面那条铁律链吃不到另一型缺口 —— 代码里写成 `tt('some.key', '中文兜底串')` 的调用,
 * 键在词包里全查无,可 zh 值就写在代码兜底参数里(packAbsent 维只看命名空间,永远不命中这一型;
 * 另一把尺子 check-i18n-keys 的取材面也数不全)。后果是非中文用户在这些位置看到简体中文兜底串。
 * 本面把这格变成机械动作,并且**只搬 zh-CN 一个语言**:
 *   ① zh-CN 落键:兜底串从代码里取(定位 = _i18n-scan-helpers 的 STATIC_T_RE 既有实现,
 *      遮注释/串 = lib/code-mask 的 scanSpans,括号配平切参 = lib/route-registration-extract 的
 *      findMatchingBracket/splitTopLevelArgs/parsePathArg,取值面 = HEAD blob 清单+内容同轮;
 *      本层零新正则、零私有分词器,§0.6/§22c)。取值取不到(第二参非字面量/括号不配平/空串)
 *      ⇒ unresolvable 逐枚点名不折 0(§0.3)。
 *   ② 其余四语(zh-TW/en/ja/ko)**只进"待定向翻译"队列并如实报数,本器绝不生成翻译**:
 *      AGENTS §19 要求"新增状态词必须同批补齐五语言",而本仓同时禁止把 en 值当 ko/ja 填、
 *      禁止 fix-i18n-parity 那种写空字符串的假绿 —— 翻译有真实来源只能是定向翻译流水线
 *      (i18n-diff 出 pending 清单 → AI agent 翻译 → i18n-apply 写回),其落地红拦已由门
 *      2f-miniapp-taro(blocking, stagedTriggers=packages/i18n/messages/miniapp-taro/) 在册。
 *      本器若再对"队列非空"自冒红,只是把同一道债数两遍并在周期腿上造恒红(§12e/§5e-1),
 *      所以裁决是:**队列非空 ⇒ 本器 exit 0**,但结论行与 --json 必须把 `待译=`/translateQueue
 *      逐枚点名报数(安静 = 失明,本仓最高频失效型)。"queued" 是独立 state,绝不写成 "clean"。
 *   ③ 键在运行面(本端 ∪ shared)任一语已存在 ⇒ 一律不动(只补空、绝不覆盖,铁律②同条纪律);
 *      键在基准侧(mobile-rn/web)zh 已有真译文 ⇒ 归 baselineHas 桶点名 ⇒ 那是默认面 --key 道
 *      的活(搬整句现成译文比代码兜底串更好),本面不抢道、不代搬。
 *   归属闸(铁律④)与最小插入+JSON.parse 复验(铁律⑤)同样生效;写盘只到工作树 zh-CN.json,
 *      落库交同一条收编腿,申报走具名腿 `miniapp-code-fallback`(不污染默认腿的 awaiting-landing 判定)。
 *
 * 用法(第二面):`node scripts/sync-miniapp-message-keys.mjs --face=code-fallback [--key ns.key ...] [--apply] [--json]`
 *   --key 是这一面的清单入口(与默认面同一把 parseKeyArgs):给了就只处理点名键,不给则处理全量现读候选。
 * 退出码(第二面):0 = clean/pending(预演)/已落盘且队列如实报数;1 = 写了盘但申报未竟全功;
 *   2 = 取材面取不到(代码面/pack 面,未判定)、--face 值不合法、枚举到 0 个可扫源码、
 *   或(无盘可落时)unresolvable 点名。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { atomicWriteFileSync } from './lib/atomic-write.mjs'
import { appendLanding, readLanding } from './lib/cross-end-landing-ledger.mjs'
import { ownershipGate } from './lib/git-paths.mjs'
import { gitRaw } from './lib/face-reader.mjs'
// ── code-fallback 面的取材件(全部是仓内既有唯一实现,本层不另造第二把尺,§0.6/§22c)──
import { catBatch } from './lib/face-reader.mjs'
import { scanSpans } from './lib/code-mask.mjs'
import { findMatchingBracket, splitTopLevelArgs, parsePathArg, lineOfIdx } from './lib/route-registration-extract.mjs'
import { STATIC_T_RE, headScannableRels } from './_i18n-scan-helpers.mjs'
import { pickByPath } from './lib/rn-carried-keys.mjs'

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

/**
 * 搬运面 = 整块缺失的命名空间(字符串项)∪ 显式点名的单键({ns, keys})。
 * 后者补的是本尺的一处盲区:packAbsent 只判**顶层命名空间存在性**,已有块里少了某一枚键
 * 它照报绿 ⇒ 端内页面接了共享键却取不到词(2026-11-03 实测 modelEdit.readOnlyHint 即此型)。
 */
export function planMoves(items, readPack) {
  const moves = []
  const unresolvable = []
  for (const item of items) {
    const ns = typeof item === 'string' ? item : item.ns
    const only = typeof item === 'string' ? null : item.keys
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
        unresolvable.push(only ? `${ns}.${only.join('/')}` : `${ns}@${lang}`)
        continue
      }
      const satisfied = new Set()
      for (const [key, value] of Object.entries(baseline)) {
        // 值可以是字符串,也可以是整块子对象(edu/learnPaymentConfirmPage 这类嵌套命名空间)。
        // 旧形态只收 depth-1 字符串 ⇒ 纯嵌套的命名空间永远 0 枚可搬,而还原度门按 HEAD 照旧报
        // packAbsent ⇒ 这道红永远靠机器消不掉(2026-11-05 实测:edu、learnPaymentConfirmPage 即此型)。
        if (only) satisfied.add(key)
        if (only && !only.includes(key)) continue
        if (have?.[ns]?.[key] !== undefined) {
          satisfied.add(key)
          continue // 只补空:已有 ⇒ 一个字母不动(子树已存在也不整片覆盖)
        }
        moves.push({ ns, key, lang, value, from })
      }
      // 显式点名的键若在基准侧与本端都取不到 ⇒ 逐语点名,不能静默数成 0 枚就当搬过(§0.3)
      if (only)
        for (const k of only)
          if (!satisfied.has(k) && have?.[ns]?.[k] === undefined) unresolvable.push(`${ns}.${k}@${lang}`)
    }
  }
  return { moves, unresolvable }
}

/**
 * 「缺口仍在、而计划=0 且基准侧并非查无」这一格必须有自己的名字(2026-11-05 立)。
 *
 * 立因:`needs` 出自还原度门按 **HEAD** 判的 packAbsent,而本器的写盘只到 **工作树**(落库交
 * `sweepCrossEndLandingLeg` 收)。于是上一轮写完到收编落地之间,计划恒为 0 —— 旧形态把这一格折成
 * `state:'unresolvable'` 而 `unresolvable` 数组**一条也不点名**,等于把「刚写完、缺收编那一跳」说成
 * 「取不到」。驾驶舱与 `--json` 消费方读不出真相 ⇒ 同一道红隔 30 分钟复现一次而无人动手。
 * 失效方向仍是「多要一次定向说明」(§0.10):判不出就逐枚点名并 exit 2,绝不冒绿也绝不冒错名。
 *
 * 输入全是调用方现读的事实,本层不再取任何一面(§0.6 零复算:账本形态与 blob 比对口径归 lib):
 *   present     —— `${ns}@${lang}`:本端**工作树**副本里该命名空间已是对象(在位)
 *   declared    —— 已在落点账本以本腿名申报、且申报 blob 逐字等于当前工作树 blob 的语言
 *   ledgerError —— 账本读不出 ⇒ 一律未判定(取不到不猜)
 */
export function classifyNoop({ needs, present, declared, ledgerError }) {
  if (ledgerError) return { state: 'undetermined', exit: 2, named: [`账本取不到:${ledgerError}`] }
  if (!needs.length) return { state: 'clean', exit: 0, named: [] }
  const missing = []
  const undeclared = []
  for (const ns of needs)
    for (const lang of LANGS) {
      const face = `${ns}@${lang}`
      if (!present.includes(face)) missing.push(face)
      if (!declared.includes(lang)) undeclared.push(lang)
    }
  // 本端副本里没有该块却既无搬运计划也无点名 ⇒ 计划面与判据面对不上,是真「判不出」
  if (missing.length) return { state: 'undetermined', exit: 2, named: missing }
  // 内容在盘上而本腿账本无相符申报 ⇒ 不是「我写的等收编」,不能替别人认领(归属未知 ⇒ 不猜)
  if (undeclared.length)
    return {
      state: 'undetermined',
      exit: 2,
      named: [...new Set(undeclared)].map((l) => `本端副本已含而本腿账本无相符申报:${l}`),
    }
  return { state: 'awaiting-landing', exit: 0, named: [], pending: declared.length }
}

/** 从账本正文里挑出「本腿为该语言申报过、且 oid 逐字等于当前工作树 blob」的语言。 */
export function declaredLangsFromLedger({ rows, leg = CROSS_END_LEG, oidByLang, targetPack = TARGET_PACK }) {
  const out = []
  for (const [lang, oid] of Object.entries(oidByLang ?? {})) {
    if (!oid) continue
    const rel = packRel(targetPack, lang)
    if (rows.some((r) => r.leg === leg && r.path === rel && r.blobOid === oid)) out.push(lang)
  }
  return out
}

/** 本端工作树副本是否已含该命名空间(对象在位即算;与还原度门的 packAbsent 同一档语义)。 */
export function presentFaces(needs, readPack, targetPack = TARGET_PACK) {
  const out = []
  for (const ns of needs)
    for (const lang of LANGS) {
      const j = readPack(targetPack, lang)
      if (j?.[ns] && typeof j[ns] === 'object') out.push(`${ns}@${lang}`)
    }
  return out
}

/** 把 --key ns.key(可重复)折成显式搬运项;形状不对当场拒绝,不静默忽略。 */
export function parseKeyArgs(argv) {
  const byNs = new Map()
  const bad = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--key') continue
    const raw = argv[i + 1]
    const at = typeof raw === 'string' ? raw.indexOf('.') : -1
    if (typeof raw !== 'string' || at <= 0 || at === raw.length - 1) {
      bad.push(String(raw))
      continue
    }
    const ns = raw.slice(0, at)
    const key = raw.slice(at + 1)
    const list = byNs.get(ns) || []
    list.push(key)
    byNs.set(ns, list)
  }
  return { items: [...byNs.entries()].map(([ns, keys]) => ({ ns, keys })), bad }
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
  // 逐行按落点缩进重排:整块子对象必须与词包既有的 2 空格阶梯一致,否则 prettier 一改就造出
  // 与正确性无关的巨型 diff(内联 {"a":1} 形态会被展开,格式棘轮按"本次改动文件"判 ⇒ 平白添红)。
  const renderEntry = (pad, k, v) => {
    const head = `${pad}${JSON.stringify(k)}: `
    if (v === null || typeof v !== 'object') return `${head}${JSON.stringify(v)}`
    return JSON.stringify(v, null, 2)
      .split('\n')
      .map((line, i) => (i === 0 ? `${head}${line}` : `${pad}${line}`))
      .join('\n')
  }
  if (nsOpen === -1) {
    // 整块缺失 ⇒ 必须发**嵌套对象**:"career" 作为顶层命名空间不存在时,尺子的 packAbsent 维照旧命中
    const tail = body.replace(/\s*$/, '')
    const add = entries.map(([k, v]) => renderEntry('    ', k, v)).join(',\n')
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
  const add = entries.map(([k, v]) => renderEntry(pad, k, v)).join(',\n')
  return `${text.slice(0, nsOpen + 1)}${trimmed}${sep}\n${add}\n${closeIndent}${text.slice(close)}`
}

/** 找顶层 "ns": { 的开括号位置(字符串感知扫描;词包是纯 JSON,无注释)。 */
function findNsOpen(body, ns) {
  const name = JSON.stringify(ns)
  let depth = 0 // 顶层键 = 深度 1;同名嵌套块(devEnter.modelEdit)不得被当成目标(2026-11-03 实测)
  let i = 0
  while (i < body.length) {
    const c = body[i]
    if (c === '"') {
      const end = skipString(body, i)
      if (depth === 1 && body.slice(i, end) === name) {
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
    if (c === '{') depth++
    else if (c === '}') depth--
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

/**
 * 现读事实 ⇒ 交给纯裁决器。账本读不到一律按「取不到」交给 classifyNoop 的 ledgerError 分支,
 * 不回落另一个面、也不把"读不出"折成"没申报"(§0.4 同面同轮 / §0.3 不冒绿)。
 */
export function judgeNoop(needs, { root = ROOT } = {}) {
  const present = presentFaces(needs, defaultReadPack)
  const ledger = readLanding({ face: 'worktree', root })
  if (!ledger.ok)
    return classifyNoop({ needs, present, declared: [], ledgerError: String(ledger.reason).slice(0, 120) })
  const oidByLang = {}
  for (const lang of LANGS) oidByLang[lang] = worktreeBlobOid(packRel(TARGET_PACK, lang), root)
  return classifyNoop({
    needs,
    present,
    declared: declaredLangsFromLedger({ rows: ledger.lines ?? [], oidByLang }),
  })
}

export function runFidelityJson() {
  const script = join(HERE, 'check-miniapp-mirror-fidelity.mjs')
  try {
    const out = execFileSync(process.execPath, [script, '--json'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    })
    return JSON.parse(out.toString('utf8'))
  } catch (e) {
    return { __error: String(e?.message ?? e).split('\n')[0].slice(0, 160) }
  }
}

// ════════════════ code-fallback 面(2026-11-06 立;立因/边界/退出码裁决见文件头注)════════════════
export const FACES = Object.freeze(['pack', 'code-fallback'])
export const CROSS_END_LEG_CODE_FALLBACK = 'miniapp-code-fallback'
export const CODE_FALLBACK_SCAN_TARGETS = Object.freeze(['apps/miniapp-taro/src'])
/** 运行取词面 = 本端 ∪ shared(与还原度门 PACK_RELS 前两行同一语义;mobile-rn/web 只作基准侧)。 */
export const RUNTIME_PACKS = Object.freeze([TARGET_PACK, 'shared'])
/** 哨兵键名:借既有 insertIntoJson 往"任意深度块末尾追加"时用的临时根包装(不会进真文件,复验不过即弃)。 */
const FB_SENTINEL = 'IHUI_CODE_FB_ROOT'

/** --face 取值判定(唯一一处;main 的未知旗扫描只免整旗误报,不复判合法性,§0.6)。 */
export function parseFaceArg(argv) {
  const given = argv.filter((a) => typeof a === 'string' && a.startsWith('--face='))
  if (given.length > 1 && new Set(given).size > 1)
    return { face: null, error: `--face 给了多个不同值(${given.join(' ')}),互斥不回落` }
  if (given.length === 0) return { face: 'pack', error: null }
  const v = given[0].slice('--face='.length)
  if (!FACES.includes(v))
    return { face: null, error: `--face=${JSON.stringify(v)} 不在册(可用:${FACES.join(' / ')})` }
  return { face: v, error: null }
}

/**
 * JS 字符串字面量体的转义解码(单遍;未知退路 = **保字符**,方向是"不丢字不折 0")。
 * 为什么不算第二把尺:STATIC_T_RE / parsePathArg 只负责**定位与分类**,三家既有件都不解码转义;
 * 这一小段是把"已取到的字面量体"变成可与 JSON 值逐字节比较的字符串的必要收尾,无判定语义。
 */
export function decodeStringLiteral(raw) {
  const s = String(raw ?? '')
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== '\\' || i + 1 >= s.length) {
      out += c
      continue
    }
    const n = s[++i]
    switch (n) {
      case 'n': out += '\n'; break
      case 'r': out += '\r'; break
      case 't': out += '\t'; break
      case 'b': out += '\b'; break
      case 'f': out += '\f'; break
      case 'v': out += '\v'; break
      case 'x': {
        const hx = s.slice(i + 1, i + 3)
        if (/^[0-9a-fA-F]{2}$/.test(hx)) { out += String.fromCharCode(parseInt(hx, 16)); i += 2 }
        else out += n
        break
      }
      case 'u': {
        if (s[i + 1] === '{') {
          const end = s.indexOf('}', i + 2)
          if (end > i + 1) {
            try { out += String.fromCodePoint(parseInt(s.slice(i + 2, end), 16)); i = end }
            catch { out += n }
          } else out += n
        } else {
          const hx = s.slice(i + 1, i + 5)
          if (/^[0-9a-fA-F]{4}$/.test(hx)) { out += String.fromCharCode(parseInt(hx, 16)); i += 4 }
          else out += n
        }
        break
      }
      case '\n': break // 行接续转义
      default: out += n // \' \" \` \\ 等"转义即该字符"的形态;其余未知 ⇒ 保字符
    }
  }
  return out
}

/**
 * 从一段源码文本提取 `t/tt/tr('ns.key', '兜底串')` 的键与兜底串。
 * 定位 = STATIC_T_RE(死键审计族的既有唯一取词尺,§22c 复用不另造);
 * 噪声排除 = lib/code-mask 的 scanSpans(注释与字符串字面量整段;测试②的反向对照靠它);
 * 取参 = lib/route-registration-extract 的 findMatchingBracket + splitTopLevelArgs + parsePathArg
 * (仓内唯一"括号配平取实参"实现 —— 本仓记过"括号不配对读错"与"正则截行首身份",这里都不再犯)。
 * 未闭合串/模板串按串吞到行尾/EOF ⇒ 可能**少认**真命中,方向是保守不是冒拿。
 */
export function extractCodeFallbackHits(text) {
  const hits = []
  const unresolvable = []
  if (typeof text !== 'string' || text === '') return { hits, unresolvable }
  const noise = scanSpans(text).filter(
    (s) => s.kind === 'line' || s.kind === 'block' || s.kind === 'string',
  )
  for (const m of text.matchAll(STATIC_T_RE)) {
    const idx = m.index
    if (noise.some((s) => idx >= s.start && idx < s.end)) continue
    const key = m[1]
    const line = lineOfIdx(text, idx)
    const open = text.indexOf('(', idx)
    if (open === -1) {
      unresolvable.push({ key, line, why: '取到键却找不到调用左括号' })
      continue
    }
    const close = findMatchingBracket(text, open, '(', ')')
    if (close === -1) {
      unresolvable.push({ key, line, why: '调用括号不配平 ⇒ 拒绝猜实参' })
      continue
    }
    const args = splitTopLevelArgs(text.slice(open + 1, close))
    if (args.length < 2) continue // 单参调用:没有兜底串可搬,不属于本型(不算取值失败)
    const a0 = parsePathArg(args[0])
    if (a0.kind !== 'literal' || a0.value !== key) {
      unresolvable.push({ key, line, why: `首参与定位键逐字不等(解出形态 ${a0.kind})` })
      continue
    }
    const a1 = parsePathArg(args[1])
    if (a1.kind !== 'literal') {
      unresolvable.push({ key, line, why: `第二参(兜底串)不是静态可判定字符串字面量(形态 ${a1.kind})` })
      continue
    }
    const fb = decodeStringLiteral(a1.value)
    if (fb.trim() === '') {
      unresolvable.push({ key, line, why: '兜底串为空 ⇒ 无值可搬' })
      continue
    }
    hits.push({ key, fb, line })
  }
  return { hits, unresolvable }
}

/**
 * 在 JSON 文本 host 内找 "key" 对应**块**(花括号值)的开/闭位置。
 * 与默认面 findNsOpen 的差别只有一格:冒号后第一个非空白必须是 '{' —— 值是标量(字符串等)时
 * 判 scalar,而不是"抓到后面某个不相关的 { 就当本键的块"。老面行为一字未动(老路径没被动过);
 * 新面吃这条更严的判序,失效方向 = 拒绝写入并点名(scalar 占位 ⇒ 不覆盖不猜)。
 */
function locateBlock(host, key) {
  const name = JSON.stringify(key)
  let depth = 0
  let i = 0
  while (i < host.length) {
    const c = host[i]
    if (c === '"') {
      const end = skipString(host, i)
      if (depth === 1 && host.slice(i, end) === name) {
        const colonRel = host.slice(end).search(/\S/)
        const at = end + (colonRel === -1 ? 0 : colonRel)
        if (host[at] === ':') {
          let j = at + 1
          while (j < host.length && /\s/.test(host[j])) j++
          if (host[j] !== '{') return { state: 'scalar' }
          const close = matchCloseBrace(host, j)
          return close === -1 ? { state: 'broken' } : { state: 'open', open: j, close }
        }
      }
      i = end
      continue
    }
    if (c === '{') depth++
    else if (c === '}') depth--
    i++
  }
  return { state: 'absent' }
}

/** 借既有 insertIntoJson 往"任意深度块"的末尾追加 pairs;经哨兵根包装,写盘前必被 JSON.parse 复验。 */
function appendIntoBlock(blockInner, pairs) {
  const w2 = `{\n  "${FB_SENTINEL}": {${blockInner}}\n}\n`
  const out = insertIntoJson(w2, FB_SENTINEL, pairs)
  if (out === null) return null
  const body = out.slice(0, out.lastIndexOf('}'))
  const f = locateBlock(body, FB_SENTINEL)
  if (f.state !== 'open') return null
  return out.slice(f.open + 1, f.close) // 更新后的块 inner
}

/**
 * 深度路径版最小插入:`dottedKey = segs[0].…segs[n]`,沿路径下潜到**最深既有块**;
 * 缺的整段以嵌套对象一次 graft(整块值走 renderEntry 的 2 空格阶梯,与默认面同一格式纪律);
 * 叶已存在(块/标量都算)⇒ skipped,绝不覆盖。返回 {ok,skipped,text} 或 {ok:false,why}。
 * 组合的全是本文件既有原语(locateBlock 族扫描 / matchCloseBrace / insertIntoJson),零第二台引擎。
 */
export function insertLeafPath(text, dottedKey, value) {
  const segs = String(dottedKey ?? '').split('.')
  if (segs.length < 2 || segs.some((s) => s === ''))
    return { ok: false, why: `键形不是点分 ns.…leaf:${dottedKey}` }
  const rootClose = text.lastIndexOf('}')
  if (rootClose < 0) return { ok: false, why: '根闭括号定位失败' }
  const buildNested = (start) => {
    if (start >= segs.length) return value
    const node = {}
    let cur = node
    for (let j = start; j < segs.length - 1; j++) cur = (cur[segs[j]] = {})
    cur[segs.at(-1)] = value
    return node
  }
  let host = text.slice(0, rootClose) // 根内容区(含根开括号、不含根闭括号;顶层键落在深度 1)
  let absOpen = -1 // 当前块 '{' 的绝对下标(-1 = 根)
  let absClose = rootClose // 当前块 '}' 的绝对下标
  for (let d = 0; d < segs.length - 1; d++) {
    const f = locateBlock(host, segs[d])
    if (f.state === 'broken') return { ok: false, why: `"${segs[d]}" 块括号不配平 ⇒ 拒绝猜` }
    if (f.state === 'scalar') return { ok: false, why: `"${segs[d]}" 已存在但不是对象 ⇒ 不覆盖不猜` }
    if (f.state === 'absent') {
      if (d === 0) {
        // 顶层命名空间整块缺失:与默认面同一出口(根末追加嵌套块);entries 是**块内容**,
        // 故取 [[segs[1], 其余子树]],不得再把 segs[0] 包一层(否则造出 "ns":{"ns":{…}} 混血形)
        const next = insertIntoJson(text, segs[0], [[segs[1], buildNested(2)]])
        return next === null ? { ok: false, why: '根末插入点定位失败' } : { ok: true, skipped: false, text: next }
      }
      const upd = appendIntoBlock(host.slice(1, host.length - 1), [[segs[d], buildNested(d + 1)]])
      if (upd === null) return { ok: false, why: '缺失层的块末插入点定位失败' }
      return { ok: true, skipped: false, text: text.slice(0, absOpen + 1) + upd + text.slice(absClose) }
    }
    const base = d === 0 ? 0 : absOpen // host 起点:根档 = 0;下潜档 = 当前块 '{' 的绝对下标
    absOpen = base + f.open
    absClose = base + f.close
    host = text.slice(absOpen, absClose + 1) // 带自身花括号 ⇒ 块内键恒落在深度 1
  }
  const leaf = segs.at(-1)
  const lf = locateBlock(host, leaf)
  if (lf.state !== 'absent') return { ok: true, skipped: true, text } // 只补空:叶已在 ⇒ 一字不动
  if (absOpen === -1) return { ok: false, why: '叶父块定位异常(不应到达)' }
  const upd = appendIntoBlock(host.slice(1, host.length - 1), [[leaf, value]])
  if (upd === null) return { ok: false, why: '叶插入点定位失败' }
  return { ok: true, skipped: false, text: text.slice(0, absOpen + 1) + upd + text.slice(absClose) }
}

/**
 * code-fallback 面的计划裁决(纯函数:items/readPack 由调用方现读注入,测试与生产共用这一份)。
 * 桶位(逐枚点名,绝不折 0):
 *   moves          —— 每键仅 zh-CN 一枚(值 = 代码兜底串逐字);
 *   translateQueue —— 四语待定向翻译(本轮新落键 ×4 语,与历史已落而四语仍缺的键);**只报不译**;
 *   unresolvable   —— 取值失败(括号不配平/第二参非字面量/空兜底…),逐枚点名;
 *   fbConflict     —— 同键两处兜底串不等 ⇒ 拒绝择一;
 *   baselineHas    —— 基准侧 zh 有真译文 ⇒ 归默认面 --key 道(搬整句译文优于代码兜底串),本面不抢道;
 *   resolved       —— 运行面五语齐 ⇒ 与本型无关。
 */
export function planCodeFallback({
  items,
  readPack,
  onlyKeys = null,
  langs = LANGS,
  runtimePacks = RUNTIME_PACKS,
  baselinePacks = BASELINE_PACKS,
}) {
  const hits = []
  const unresolvable = []
  for (const it of items ?? []) {
    const r = extractCodeFallbackHits(it.text)
    for (const h of r.hits) hits.push({ ...h, rel: it.rel })
    for (const u of r.unresolvable) unresolvable.push({ ...u, rel: it.rel })
  }
  const byKey = new Map()
  const fbConflict = []
  for (const h of hits) {
    const prev = byKey.get(h.key)
    if (!prev) {
      byKey.set(h.key, h)
      continue
    }
    if (prev.fb !== h.fb)
      fbConflict.push({
        key: h.key,
        at: [prev.rel, h.rel],
        why: '两处兜底串不逐字相等 ⇒ 拒绝择一、拒绝猜',
      })
  }
  for (const c of fbConflict) byKey.delete(c.key)
  let scopedUnresolvable = unresolvable
  let scopedConflict = fbConflict
  if (onlyKeys) {
    for (const k of [...byKey.keys()]) if (!onlyKeys.has(k)) byKey.delete(k)
    scopedUnresolvable = unresolvable.filter((u) => onlyKeys.has(u.key))
    scopedConflict = fbConflict.filter((c) => onlyKeys.has(c.key))
  }
  const outOfScope =
    unresolvable.length + fbConflict.length - scopedUnresolvable.length - scopedConflict.length
  const packRoots = {}
  const packMissing = []
  for (const lang of langs)
    for (const p of runtimePacks) {
      const j = readPack(p, lang)
      if (j === null || j === undefined || typeof j !== 'object') packMissing.push(`${p}/${lang}`)
      packRoots[`${p}/${lang}`] = j
    }
  const baselineZh = {}
  const baselineUnread = []
  for (const p of baselinePacks) {
    if (runtimePacks.includes(p)) continue // shared 既是基准也是运行面,归运行面判(不重复数)
    const j = readPack(p, 'zh-CN')
    if (j === null || j === undefined || typeof j !== 'object') baselineUnread.push(`${p}/zh-CN`)
    baselineZh[p] = j
  }
  const runtimeHas = (lang, key) =>
    runtimePacks.some((p) => {
      const j = packRoots[`${p}/${lang}`]
      return j && typeof j === 'object' && pickByPath(j, key) !== undefined
    })
  const fullyResolved = (key) => langs.every((l) => runtimeHas(l, key))
  // —— unresolvable/conflict 的点名射程收窄(2026-11-06 实测口径修正)——
  // 取值取不到只有在"该键确实有缺口"时才是本型的债;键五语已齐时,读不出兜底串只是死代码形态,
  // 把它点名 = 给周期腿造与本次内容无关的恒红(§12e)。仍**如实报数**(hidden 两桶),不折 0。
  const namedUnresolvable = []
  const unresolvableResolved = []
  const unresolvableCovered = []
  for (const u of scopedUnresolvable) {
    if (packMissing.length) {
      namedUnresolvable.push(u)
      continue
    }
    if (byKey.has(u.key)) {
      unresolvableCovered.push(u) // 同键另有可判定字面量位 ⇒ 计划面已由那枚取值,本枚只报数
      continue
    }
    if (fullyResolved(u.key)) {
      unresolvableResolved.push(u)
      continue
    }
    namedUnresolvable.push(u)
  }
  const namedConflict = []
  const conflictResolved = []
  for (const c of scopedConflict) {
    if (packMissing.length || !fullyResolved(c.key)) namedConflict.push(c)
    else conflictResolved.push(c)
  }
  const moves = []
  const translateQueue = []
  const resolved = []
  const baselineHas = []
  for (const [key, h] of [...byKey.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (packMissing.length) continue // 运行面取不到 ⇒ 整轮未判定,不产计划(调用方据 packMissing exit 2)
    const present = langs.filter((l) => runtimeHas(l, key))
    if (present.length === langs.length) {
      resolved.push(key)
      continue
    }
    if (present.includes('zh-CN')) {
      // zh 已在面上:本器一个字不动;四语缺谁,队列点名谁(如实报数)
      translateQueue.push({
        key,
        missingLangs: langs.filter((l) => l !== 'zh-CN' && !runtimeHas(l, key)),
        status: 'zh-already-present',
      })
      continue
    }
    const bp = baselinePacks.find(
      (p) => !runtimePacks.includes(p) && baselineZh[p] && pickByPath(baselineZh[p], key) !== undefined,
    )
    if (bp) {
      baselineHas.push({ key, from: `${bp}/zh-CN`, exit: '默认面 --key 逐字搬真译文(优于代码兜底串)' })
      continue
    }
    moves.push({
      ns: key.split('.')[0],
      key,
      lang: 'zh-CN',
      value: h.fb,
      from: 'code-fallback',
      src: `${h.rel}:${h.line}`,
    })
    translateQueue.push({ key, missingLangs: langs.filter((l) => l !== 'zh-CN'), status: 'after-landing' })
  }
  return {
    moves,
    translateQueue,
    unresolvable: namedUnresolvable.map((u) => ({ ...u, face: `${u.rel}:${u.line}` })),
    fbConflict: namedConflict,
    unresolvableResolved: unresolvableResolved.map((u) => `${u.rel}:${u.line} ${u.key}`),
    unresolvableCovered: unresolvableCovered.map((u) => `${u.rel}:${u.line} ${u.key}`),
    conflictResolved: conflictResolved.map((c) => c.key),
    baselineHas,
    resolved,
    packMissing,
    baselineUnread,
    outOfScope,
    inScopeKeys: byKey.size,
  }
}

/**
 * code-fallback 面的写盘(只写 zh-CN 一份 pack;全部判据走既有出口):
 * 归属闸(铁律④)⇒ held 不写;只补空(逐枚以**最新盘面**复核,铁律②);
 * 最小插入 + 整文件 JSON.parse 复验 + 回读值与兜底串逐字节相等(铁律⑤/③);
 * 任一 failed ⇒ 整文件不写(全有或全无,与默认面同一失效方向);写成功后才申报落点账本(具名腿)。
 * io 注入面仅供镜像测试(生产路径走默认 io:ownershipGate/atomicWriteFileSync/worktreeBlobOid/appendLanding)。
 */
export function landCodeFallback({ moves, root = ROOT, io = null }) {
  const _io = io ?? {
    gate: ownershipGate({ root }),
    read: (rel) => readFileSync(join(root, rel), 'utf8'),
    write: (rel, text) => atomicWriteFileSync(join(root, rel), text, { encoding: 'utf8' }),
    hash: (rel) => worktreeBlobOid(rel, root),
    append: (entries) => appendLanding(entries, { root }),
  }
  const rel = packRel(TARGET_PACK, 'zh-CN')
  const reason = _io.gate ? _io.gate.blocked(rel) : null
  if (reason)
    return {
      state: 'held',
      rel,
      held: [rel],
      why: String(reason),
      landed: [],
      skipped: [],
      failed: [],
      written: false,
    }
  let text
  let parsed
  try {
    text = _io.read(rel)
    parsed = JSON.parse(text)
  } catch (e) {
    return {
      state: 'failed',
      rel,
      landed: [],
      skipped: [],
      failed: [`${rel} 读面/解析失败:${String(e?.message ?? e).slice(0, 80)}`],
      written: false,
    }
  }
  const landed = []
  const skipped = []
  const failed = []
  for (const mv of moves) {
    if (pickByPath(parsed, mv.key) !== undefined) {
      skipped.push(mv.key)
      continue // 只补空:以最新盘面复核,不凭计划阶段旧读数
    }
    const r = insertLeafPath(text, mv.key, mv.value)
    if (!r.ok) {
      failed.push(`${mv.key}:${r.why}`)
      continue
    }
    if (r.skipped) {
      skipped.push(mv.key)
      continue
    }
    let check
    try {
      check = JSON.parse(r.text)
    } catch (e) {
      failed.push(`${mv.key}:插入后 JSON.parse 复验失败(${String(e?.message ?? e).slice(0, 60)})`)
      continue
    }
    if (pickByPath(check, mv.key) !== mv.value) {
      failed.push(`${mv.key}:回读值与兜底串不逐字节相等`)
      continue
    }
    text = r.text
    parsed = check
    landed.push(mv.key)
  }
  if (landed.length === 0)
    return { state: failed.length ? 'failed' : 'noop', rel, landed, skipped, failed, written: false }
  if (failed.length)
    return { state: 'refused', rel, landed, skipped, failed, written: false } // 全有或全无
  _io.write(rel, text)
  let ledger = { appended: 0, deduped: 0, rejected: [], failed: null }
  const oid = _io.hash ? _io.hash(rel) : null
  if (!oid) ledger.failed = '落点 blob 取不到'
  else {
    try {
      ledger = {
        ...ledger,
        ..._io.append([
          {
            at: new Date().toISOString(),
            leg: CROSS_END_LEG_CODE_FALLBACK,
            path: rel,
            blobOid: oid,
          },
        ]),
      }
    } catch (e) {
      ledger = { ...ledger, appended: 0, deduped: 0, rejected: [], failed: String(e?.message ?? e).slice(0, 120) }
    }
  }
  return { state: 'landed', rel, landed, skipped, failed, written: true, ledger, oid }
}

/** 结论行(形状锁:landing=/held=/ledger=/leg= 令牌齐备,与默认面同被派发体解析)。 */
export function buildCodeFallbackVerdictLine({
  landing,
  planned,
  held,
  written,
  ledgerState,
  translateQueue,
  unresolvable,
  fbConflict,
  baselineHas,
  outOfScope,
  hiddenReport = 0,
}) {
  return (
    `结论 landing=${landing}` +
    ` 计划=${planned}` +
    ` held=${held}` +
    ` 写出=${written}` +
    ` leg=${CROSS_END_LEG_CODE_FALLBACK}` +
    ` ledger=${ledgerState}` +
    ` 待队列=${translateQueue}` +
    ` 未判定=${unresolvable + fbConflict}` +
    ` 基准侧已有=${baselineHas}` +
    ` 射程外报数=${outOfScope}` +
    ` 死形态报数=${hiddenReport}` +
    ` landingPath=.ihui-agent/state/cross-end-landing.jsonl`
  )
}

async function mainCodeFallback({ apply, asJson, keyItems }) {
  // 取材:代码面 = HEAD blob(清单 ls-tree + 内容一次 cat-file --batch,同面同轮 §0.4;取不到不回落磁盘)
  let items
  try {
    const rels = headScannableRels(ROOT, CODE_FALLBACK_SCAN_TARGETS)
    if (rels.length === 0) {
      console.error(
        `❌ HEAD 面在 [${CODE_FALLBACK_SCAN_TARGETS.join(', ')}] 枚举到 0 个可扫源码 ⇒ 未判定(枚举到 0 判死不记绿)`,
      )
      process.exit(2)
    }
    const specs = rels.map((r) => `HEAD:${r}`)
    const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: 120000 })
    items = []
    const unreadable = []
    for (let i = 0; i < rels.length; i++) {
      const t = got.get(specs[i])
      if (typeof t === 'string') items.push({ rel: rels[i], text: t })
      else unreadable.push(rels[i])
    }
    if (unreadable.length) {
      console.error(
        `❌ ${unreadable.length} 个枚举条目取不到 blob 正文(${unreadable.slice(0, 10).join(', ')}…) ⇒ 未判定,不回落磁盘`,
      )
      process.exit(2)
    }
  } catch (e) {
    console.error(`❌ 代码面取材失败(未判定,不冒绿):${String(e?.message ?? e).split('\n')[0].slice(0, 160)}`)
    process.exit(2)
  }
  const onlyKeys = keyItems.length
    ? new Set(keyItems.flatMap((k) => k.keys.map((kk) => `${k.ns}.${kk}`)))
    : null
  const plan = planCodeFallback({ items, readPack: defaultReadPack, onlyKeys })
  if (plan.packMissing.length) {
    console.error(
      `❌ 运行词包面取不到(${plan.packMissing.slice(0, 10).join(', ')}${plan.packMissing.length > 10 ? ' …' : ''})⇒ 未判定,不盲产计划`,
    )
    process.exit(2)
  }
  const queueCount = plan.translateQueue.length
  const blocked = plan.unresolvable.length + plan.fbConflict.length
  const hidden =
    (plan.unresolvableResolved?.length ?? 0) +
    (plan.unresolvableCovered?.length ?? 0) +
    (plan.conflictResolved?.length ?? 0)
  const state = plan.moves.length
    ? 'pending'
    : blocked
      ? 'unresolvable'
      : queueCount
        ? 'queued'
        : 'clean'
  let landRes = null
  if (plan.moves.length && apply) landRes = landCodeFallback({ moves: plan.moves })
  if (asJson) {
    console.log(
      JSON.stringify({
        leg: CROSS_END_LEG_CODE_FALLBACK,
        face: 'code-fallback',
        state: landRes && landRes.state === 'landed' ? 'landed' : state,
        planned: plan.moves.length,
        landed: landRes?.landed ?? [],
        skipped: landRes?.skipped ?? [],
        held: landRes ? landRes.held.length : 0,
        unresolvable: plan.unresolvable.map((u) => `${u.face} ${u.key}(${u.why})`),
        fbConflict: plan.fbConflict.map((c) => `${c.key}@${c.at.join(',')}`),
        unresolvableResolved: plan.unresolvableResolved,
        unresolvableCovered: plan.unresolvableCovered,
        conflictResolved: plan.conflictResolved,
        baselineHas: plan.baselineHas.map((b) => `${b.key}←${b.from}`),
        translateQueue: plan.translateQueue,
        outOfScope: plan.outOfScope,
        baselineUnread: plan.baselineUnread,
        applied: apply,
      }),
    )
    if (blocked && !plan.moves.length) process.exit(2)
    if (landRes && (landRes.state === 'refused' || landRes.state === 'failed')) process.exit(1)
    if (landRes && landRes.state === 'held') return // held = 让路(未判定别的车道的事),不冒红
    return
  }
  console.log(
    `🧭 code-fallback 面:取材 = HEAD(${CODE_FALLBACK_SCAN_TARGETS.join(', ')}),写盘面 = ${TARGET_PACK}/zh-CN 工作树`,
  )
  for (const m of plan.moves)
    console.log(`   zh-CN\t${m.key}\t← ${m.src}\t${JSON.stringify(m.value).slice(0, 40)}`)
  if (plan.unresolvable.length) {
    console.log(`⚠️ 取值未判定,逐枚点名不折 0(${plan.unresolvable.length} 枚):`)
    for (const u of plan.unresolvable.slice(0, 20)) console.log(`   ${u.face} ${u.key} ⇒ ${u.why}`)
  }
  if (plan.fbConflict.length) {
    console.log(`⚠️ 同键两处兜底串不等 ⇒ 拒绝择一(${plan.fbConflict.length} 枚):`)
    for (const c of plan.fbConflict.slice(0, 20)) console.log(`   ${c.key} @ ${c.at.join(' / ')}`)
  }
  if (hidden)
    console.log(
      `ℹ️ 死形态报数 ${hidden} 枚(键五语已齐或同键另有可判定位,取值失败与本型无关 ⇒ 只报数不点名不拦门):${[
        ...plan.unresolvableResolved.slice(0, 6),
        ...plan.unresolvableCovered.slice(0, 6),
      ]
        .slice(0, 10)
        .join(', ')}${hidden > 10 ? ' …' : ''}`,
    )
  if (plan.baselineHas.length)
    console.log(
      `ℹ️ 基准侧 zh 已有真译文 ⇒ 归默认面 --key 道(${plan.baselineHas.length} 枚):${plan.baselineHas
        .slice(0, 10)
        .map((b) => `${b.key}←${b.from}`)
        .join(', ')}`,
    )
  if (queueCount) {
    console.log(
      `📮 待定向翻译队列 ${queueCount} 键(本器不生成翻译;出口 = i18n-diff 出 pending → agent 译 → i18n-apply,提交链由门 2f-miniapp-taro 拦):`,
    )
    for (const q of plan.translateQueue.slice(0, 20))
      console.log(`   ${q.key} 缺 ${q.missingLangs.join('/')}`)
  }
  if (!plan.moves.length) {
    console.log('─'.repeat(64))
    console.log(
      buildCodeFallbackVerdictLine({
        landing: 0,
        planned: 0,
        held: 0,
        written: 0,
        ledgerState: 'ok',
        translateQueue: queueCount,
        unresolvable: plan.unresolvable.length,
        fbConflict: plan.fbConflict.length,
        baselineHas: plan.baselineHas.length,
        outOfScope: plan.outOfScope,
        hiddenReport: hidden,
      }),
    )
    if (blocked) {
      console.error(`❌ unresolvable/conflict(逐枚点名,不代拟不冒绿,共 ${blocked} 枚)⇒ 未判定 exit 2`)
      process.exit(2)
    }
    if (queueCount)
      console.log(
        'ℹ️ 队列非空 ≠ 本器失败:zh 面无需搬(已在或不归本型),四语译文由定向翻译流水线结清(裁决依据见文件头注②)⇒ 如实报数并按 0 出',
      )
    return
  }
  if (!apply) {
    console.log(`(预演模式,未写盘;加 --apply 落地。计划 ${plan.moves.length} 键,队列 ${queueCount} 键)`)
    return
  }
  const ap = landRes?.ledger ?? { appended: 0, deduped: 0, rejected: [], failed: '落点账本未达(未写盘)' }
  const landing = (ap.appended ?? 0) + (ap.deduped ?? 0)
  const bad = []
  if (landRes.state === 'held') bad.push(`归属闸 held:${landRes.why}`)
  if (landRes.state === 'refused' || landRes.state === 'failed') bad.push(`未写:${landRes.failed.join(' | ')}`)
  if (ap.rejected?.length) bad.push(`账本拒收:${ap.rejected.map((r) => `${r.path}(${r.reason})`).join(' ')}`)
  if (ap.failed) bad.push(`账本写入异常:${ap.failed}`)
  if (landRes.written && !landRes.oid) bad.push('落点 blob 取不到')
  console.log('─'.repeat(64))
  console.log(
    buildCodeFallbackVerdictLine({
      landing,
      planned: plan.moves.length,
      held: landRes.state === 'held' ? 1 : 0,
      written: landRes.written ? 1 : 0,
      ledgerState: bad.length ? 'unjudged' : 'ok',
      translateQueue: queueCount,
      unresolvable: plan.unresolvable.length,
      fbConflict: plan.fbConflict.length,
      baselineHas: plan.baselineHas.length,
      outOfScope: plan.outOfScope,
      hiddenReport: hidden,
    }),
  )
  if (bad.length) {
    console.error(`❌ ${bad.join(' | ')}`)
    if (landRes.state === 'held') return // 让路不是失败:不冒红,也不称已搬(§0.3 不猜)
    process.exit(1)
  }
  if (blocked)
    console.log(
      `⚠ 另有 ${blocked} 枚取值未判定(已点名;本轮已落 ${landRes.landed.length} 键,下一轮仍会点名直至结清)`,
    )
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
  const unknown = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--key') {
      i++ // 它的值由 parseKeyArgs 校形状,不在这里当未知旗
      continue
    }
    // --face=<值> 的合法性由 parseFaceArg 统一判(同一件事只许一处判,§0.6);这里只免"整旗误报"
    if (a.startsWith('--face=')) continue
    if (!KNOWN.has(a)) unknown.push(a)
  }
  if (unknown.length) {
    console.error(`❌ 未知参数 ${unknown.join(' ')} ⇒ 不接受静默忽略(周期腿会把它读成"预演")`)
    process.exit(2)
  }
  const { items: keyItems, bad: badKeys } = parseKeyArgs(argv)
  if (badKeys.length) {
    console.error(`❌ --key 形状必须是一个点分的 ns.key,收到:${badKeys.join(' ')}`)
    process.exit(2)
  }

  // 第二输入面在这一点分岔;默认面(pack)其后整条路径(还原度门取材、needsFromFidelity、
  // planMoves、judgeNoop、写盘与结论行)保持一字未动 —— 它被 sweepMiniappMessageKeysLeg /
  // sync-cross-end-cascade 以固定参数派发,改默认 = 给别人的车道造恒红(§12e)。
  const faceSpec = parseFaceArg(argv)
  if (faceSpec.error) {
    console.error(`❌ ${faceSpec.error} ⇒ 拒绝执行(不静默回落,形态同两面旗同给 exit 2)`)
    process.exit(2)
  }
  if (faceSpec.face === 'code-fallback') return mainCodeFallback({ apply, asJson, keyItems })

  const fidelity = runFidelityJson()
  if (fidelity.__error) {
    console.error(`❌ 还原度门取不到(未判定,不冒绿):${fidelity.__error}`)
    process.exit(2)
  }
  const needs = needsFromFidelity(fidelity)
  const units = [...needs, ...keyItems]
  const { moves, unresolvable } = planMoves(units, defaultReadPack)
  // 计划=0 而缺口仍在 ⇒ 这一格到底是「等收编」还是「判不出」,只有对着账本与盘上副本才答得出
  const noop =
    units.length && !moves.length && !unresolvable.length ? judgeNoop(needs) : null
  if (asJson) {
    console.log(
      JSON.stringify({
        leg: CROSS_END_LEG,
        state:
          units.length === 0
            ? 'clean'
            : moves.length
              ? 'pending'
              : unresolvable.length
                ? 'unresolvable'
                : noop.state,
        namespaces: needs,
        explicitKeys: keyItems.map((k) => `${k.ns}.${k.keys.join(',')}`),
        planned: moves.length,
        unresolvable,
        pendingLanding: noop?.pending ?? 0,
        named: noop?.named ?? [],
        applied: apply,
      }),
    )
    if (!moves.length) process.exit(noop ? noop.exit : unresolvable.length ? 2 : 0)
    if (!apply) return
  }
  if (!units.length) {
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
    const verdict = noop ?? judgeNoop(needs)
    console.log('─'.repeat(64))
    console.log(
      `结论 landing=0(新登记 0/在册去重 0) 计划=0 held=0 写出=0 leg=${CROSS_END_LEG} ledger=ok` +
        ` needs=${needs.length}` +
        ` 状态=${verdict.state}` +
        ` 待收编=${verdict.pending ?? 0}` +
        ` 未判定=${verdict.state === 'undetermined' || unresolvable.length ? 'unresolvable' : '0'}` +
        ` 基准侧查无=${unresolvable.length}` +
        ` landingPath=.ihui-agent/state/cross-end-landing.jsonl`,
    )
    const named = unresolvable.length ? unresolvable : verdict.named
    if (named.length)
      console.error(
        `❌ ${verdict.state}(逐枚点名,不代拟不冒绿,共 ${named.length} 枚):${named.slice(0, 20).join(', ')}`,
      )
    if (verdict.state === 'awaiting-landing')
      console.log(
        `ℹ️ 本腿上一轮的产出已在盘上并申报入账,缺的是收编那一跳(还原度门按 HEAD 判)⇒ 交 sweepCrossEndLandingLeg/auto-commit-quiet;本轮不重搬、不冒绿`,
      )
    if (verdict.exit) process.exit(verdict.exit)
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
      const got = parsed?.[ns]?.[key]
      const same =
        value !== null && typeof value === 'object'
          ? JSON.stringify(got) === JSON.stringify(value)
          : got === value
      if (!same) {
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
  classifyNoop,
  declaredLangsFromLedger,
  presentFaces,
  parseKeyArgs,
  insertIntoJson,
  findNsOpen,
  matchCloseBrace,
  LANGS,
  BASELINE_PACKS,
  TARGET_PACK,
  // ── code-fallback 面(§22c:镜像测试只 import 这一份生产判据,零复制)──
  FACES,
  CROSS_END_LEG_CODE_FALLBACK,
  CODE_FALLBACK_SCAN_TARGETS,
  RUNTIME_PACKS,
  parseFaceArg,
  decodeStringLiteral,
  extractCodeFallbackHits,
  insertLeafPath,
  planCodeFallback,
  landCodeFallback,
  buildCodeFallbackVerdictLine,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
