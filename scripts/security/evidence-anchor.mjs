// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 证据链外锚(2026-11-25 立)。
 *
 * 缺的是什么:现有链是 SHA-256 链式追加(seq/prevHash/payloadHash),`verifyChain`
 * 能定位"第几条被改过"。但它证明不了**整条链没被重写** —— 本机失陷者可以按同一
 * 算法从头生成一条自洽的新链,`verifyChain` 照样判 ok。链内自证的天花板就在这。
 *
 * 外锚要解决的就是这个:把「当前链头 + 条数」按固定节律送到**本机控制不到的地方**
 * (邮件服务端),并让每封带着上一封的哈希 —— 形成一条本机删不掉的外部序列。
 * 之后任何人只要手里有两封相邻的锚邮件,就能判"这两次锚之间链被整体重写过"。
 *
 * 纪律:
 *   · 先发信成功、再写台账 —— 反了就是"发失败却记了锚",下一封的 prevAnchor 指向
 *     一封从未发出的邮件,锚链与外部存储当场脱节(对应 AGENTS「留痕必须排在落地成功之后」);
 *   · 锚邮件**不传 --alert-id**:那是去重身份,4h 窗口会把节律性锚吃掉;
 *   · 节律默认 60 分钟(`IHUI_EVIDENCE_ANCHOR_INTERVAL_MIN`),tick 每 10 分钟调一次,
 *     由本脚本自己节流 —— 挂 tick 的脚本必须自己判"该不该动手";
 *   · 无锚台账落 undetermined 而不是 ok:「从未锚过」不是绿。
 *
 * 用法:
 *   node scripts/security/evidence-anchor.mjs            # 到点就锚(不成则退出码非 0)
 *   node scripts/security/evidence-anchor.mjs --force    # 忽略节律
 *   node scripts/security/evidence-anchor.mjs --dry-run  # 只算报文不发信
 *   node scripts/security/evidence-anchor.mjs --verify   # 验锚链 + 比对当前链头
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { GENESIS, canonical, readChain, sha256, verifyChain } from './lib/evidence-chain.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
// 两条路径可被 env 覆盖:演练"链被截断/重写"时必须能指向副本 ——
// 否则只有改真链才测得到,那等于拿生产当试验场。
const CHAIN_PATH = process.env.IHUI_EVIDENCE_CHAIN_PATH
  ? resolve(process.env.IHUI_EVIDENCE_CHAIN_PATH)
  : join(ROOT, '.ihui-agent', 'state', 'evidence-chain.jsonl')
const ANCHOR_PATH = process.env.IHUI_EVIDENCE_ANCHOR_PATH
  ? resolve(process.env.IHUI_EVIDENCE_ANCHOR_PATH)
  : join(ROOT, '.ihui-agent', 'state', 'evidence-anchors.jsonl')

export const ANCHOR_STATE = Object.freeze({ OK: 'ok', BREACH: 'breach', UNDETERMINED: 'undetermined' })

export function anchorPayloadOf(entries, prevAnchorHash, ts) {
  const last = entries.length ? entries[entries.length - 1] : null
  return {
    v: 1,
    ts,
    count: entries.length,
    seq: last ? Number(last.seq) : 0,
    chainHead: last ? String(last.hash) : GENESIS,
    prevAnchor: prevAnchorHash || null,
  }
}

export function anchorHashOf(payload) {
  return sha256(canonical(payload))
}

/** 节律判据:到点才锚。取不到上次时刻 ⇒ 从未锚过 ⇒ 该锚(失效方向是"多锚一次",不是"永不锚")。 */
export function shouldAnchor({ lastTs, now = Date.now(), intervalMin = 60 } = {}) {
  if (!lastTs) return { due: true, reason: '从未锚过' }
  const t = new Date(lastTs).getTime()
  if (!Number.isFinite(t)) return { due: true, reason: '上次锚时刻无法解析,按未锚处理' }
  const elapsedMin = Math.round((now - t) / 60_000)
  // 留 5 分钟提前量:tick 是 10 分钟一格,不留提前量会稳定漏格(60 分钟锚变成 70 分钟)。
  const dueAt = Math.max(1, intervalMin - 5)
  return elapsedMin >= dueAt
    ? { due: true, reason: `距上次 ${elapsedMin} 分钟 ≥ ${dueAt}` }
    : { due: false, reason: `距上次 ${elapsedMin} 分钟,未到 ${dueAt}` }
}

export function readAnchors(path = ANCHOR_PATH) {
  if (!existsSync(path)) return { rows: [], error: null }
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)
  const rows = []
  for (let i = 0; i < lines.length; i += 1) {
    try {
      rows.push(JSON.parse(lines[i]))
    } catch {
      return { rows, error: `第 ${i + 1} 行无法解析` }
    }
  }
  return { rows, error: null }
}

/**
 * 验锚:回答"这条链还是不是外面那些人看到的那条"。
 * 三条硬判据 + 一条结构判据,任一不成立都落 breach;取不到输入落 undetermined。
 */
export function verifyAnchors(chain, anchors) {
  const notes = []

  if (!Array.isArray(anchors) || anchors.length === 0) {
    return {
      state: ANCHOR_STATE.UNDETERMINED,
      notes: ['从未锚过(或锚台账为空):外部没有任何可比对的点,链的"不可否认"此刻仍只是承诺'],
    }
  }

  if (chain?.error) {
    return { state: ANCHOR_STATE.UNDETERMINED, notes: [`链读不出来: ${chain.error}`] }
  }
  const entries = chain?.entries ?? []
  const chainCheck = verifyChain(entries)
  if (!chainCheck.ok) {
    return { state: ANCHOR_STATE.BREACH, notes: [`链自证不过: ${chainCheck.reason}(第 ${(chainCheck.brokenAt ?? -1) + 1} 条)`] }
  }

  // 结构判据:锚链必须首尾相接。断一环 = 中间有一封锚被抹掉或被伪造。
  // `prevAnchor` 住在 payload 里(它是被哈希的报文体的一部分),不在台账行顶层。
  let prev = null
  for (let i = 0; i < anchors.length; i += 1) {
    const row = anchors[i]
    const expected = prev ? prev.anchorHash : null
    const actual = row?.payload?.prevAnchor ?? null
    if (actual !== expected) {
      return {
        state: ANCHOR_STATE.BREACH,
        notes: [`锚链在第 ${i + 1} 条断开:prevAnchor=${actual ?? '(空)'} 应为 ${expected ?? '(空)'}`],
      }
    }
    const recomputed = anchorHashOf(row.payload ?? {})
    if (row.anchorHash && recomputed !== row.anchorHash) {
      return { state: ANCHOR_STATE.BREACH, notes: [`锚台账第 ${i + 1} 条自身哈希不符(台账被改过)`] }
    }
    if (!row.anchorHash) return { state: ANCHOR_STATE.BREACH, notes: [`锚台账第 ${i + 1} 条缺 anchorHash`] }
    prev = row
  }

  const latest = anchors[anchors.length - 1]
  const anchoredCount = Number(latest.payload?.count ?? 0)
  const anchoredSeq = Number(latest.payload?.seq ?? -1)
  const anchoredHead = String(latest.payload?.chainHead ?? '')

  // ① 当前链条数不得少于已锚条数:变少 = 链被截断或整体重写。
  //    用 count 而不是 seq 判:链的 seq 从 0 起(末条 seq = 条数-1),拿 seq 当条数会差一。
  if (entries.length < anchoredCount) {
    return {
      state: ANCHOR_STATE.BREACH,
      notes: [`链被截断/重写:最新锚已锚到 ${anchoredCount} 条,当前只有 ${entries.length} 条`],
    }
  }
  // ② 已锚位置上的 hash 必须与锚记录一致:变了 = 链被整体重写成一条同样自洽的假链。
  if (anchoredCount > 0 && String(entries[anchoredSeq]?.hash) !== anchoredHead) {
    return {
      state: ANCHOR_STATE.BREACH,
      notes: [`链被改写:第 ${anchoredSeq} 条(0 起)实为 ${String(entries[anchoredSeq]?.hash).slice(0, 12)}…,锚记录是 ${anchoredHead.slice(0, 12)}…`],
    }
  }

  notes.push(`锚链完整 ${anchors.length} 环;最新锚 count=${anchoredCount} seq=${anchoredSeq} head=${anchoredHead.slice(0, 12)}…`)
  if (entries.length > anchoredCount) notes.push(`链在锚后新增 ${entries.length - anchoredCount} 条(待下次锚固定)`)
  return { state: ANCHOR_STATE.OK, notes }
}

function buildMailBody(payload, hash) {
  return [
    '证据链外锚',
    '',
    `链头 chainHead: ${payload.chainHead}`,
    `条数 count: ${payload.count}`,
    `序号 seq: ${payload.seq}`,
    `锚时刻 ts: ${payload.ts}`,
    '',
    `本封锚哈希: ${hash}`,
    `上一锚哈希: ${payload.prevAnchor ?? '(首锚,无前序)'}`,
    '',
    '怎么用这条锚:',
    '拿上一封锚邮件的「本封锚哈希」与本封的「上一锚哈希」逐字比对 —— 必须相等。',
    '不相等,即说明两次锚之间本机链路被整体重写过。',
    '(单条改写由链内 SHA-256 自证;整条重写只能靠这条外部序,本机删不掉已发出的邮件。)',
    '',
    '锚台账: .ihui-agent/state/evidence-anchors.jsonl',
    '验锚命令: node scripts/security/evidence-anchor.mjs --verify',
  ].join('\n')
}

/** 发信:经唯一邮件出口(§5e,禁止自拼 SMTP)。不传 --alert-id —— 锚必须每封都寄。 */
function sendAnchorMail(payload, hash) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const script = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
  if (!existsSync(tsx) || !existsSync(script)) return { ok: false, reason: 'tsx 或通知脚本不在位(未判定)' }

  const msgPath = join(ROOT, '.ihui-agent', 'tmp', 'evidence-anchor-mail.txt')
  mkdirSync(dirname(msgPath), { recursive: true })
  writeFileSync(msgPath, `${buildMailBody(payload, hash)}\n`, 'utf8')

  const r = spawnSync(
    process.execPath,
    [tsx, script, '--title', `证据链外锚 seq=${payload.seq} — ${payload.ts}`, '--severity', 'info', '--source', 'ihui/evidence-anchor', '--environment', 'production', '--message-file', msgPath, '--strict'],
    { cwd: ROOT, encoding: 'utf8', timeout: 120_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 },
  )
  return {
    ok: r.status === 0,
    reason: r.status === 0 ? '' : String(r.stderr ?? r.stdout ?? '').trim().split(/\r?\n/).slice(-2).join(' | '),
  }
}

function main() {
  const argv = process.argv.slice(2)
  const chain = readChain(CHAIN_PATH)
  const { rows: anchors, error: anchorsError } = readAnchors()

  if (argv.includes('--verify')) {
    const v = verifyAnchors(chain, anchorsError ? [] : anchors)
    const icon = { [ANCHOR_STATE.OK]: '✅', [ANCHOR_STATE.BREACH]: '❌', [ANCHOR_STATE.UNDETERMINED]: '⚠️' }[v.state]
    console.log(`${icon} [evidence-anchor] ${v.state}`)
    for (const n of v.notes) console.log(`   · ${n}`)
    if (anchorsError) console.log(`   · 锚台账读取错: ${anchorsError}`)
    return v.state === ANCHOR_STATE.OK ? 0 : v.state === ANCHOR_STATE.BREACH ? 1 : 2
  }

  if (chain.error) {
    console.log(`⚠️ [evidence-anchor] 未判定:链读不出来 ${chain.error}`)
    return 2
  }
  if (anchorsError) {
    console.log(`⚠️ [evidence-anchor] 未判定:锚台账读不出来 ${anchorsError}`)
    return 2
  }

  const last = anchors.length ? anchors[anchors.length - 1] : null
  const intervalMin = Number(process.env.IHUI_EVIDENCE_ANCHOR_INTERVAL_MIN || 60)
  const gate = shouldAnchor({ lastTs: last?.payload?.ts, intervalMin })
  if (!gate.due && !argv.includes('--force')) {
    console.log(`· [evidence-anchor] 跳过 · ${gate.reason}`)
    return 0
  }

  const payload = anchorPayloadOf(chain.entries, last?.anchorHash ?? null, new Date().toISOString())
  const hash = anchorHashOf(payload)

  if (argv.includes('--dry-run')) {
    console.log(`· [evidence-anchor] dry-run · seq=${payload.seq} count=${payload.count} head=${payload.chainHead.slice(0, 12)}… hash=${hash.slice(0, 12)}…`)
    console.log(buildMailBody(payload, hash))
    return 0
  }

  const sent = sendAnchorMail(payload, hash)
  if (!sent.ok) {
    console.log(`⚠️ [evidence-anchor] 未判定:锚邮件未发出(${sent.reason})—— 不写台账`)
    return 2
  }
  mkdirSync(dirname(ANCHOR_PATH), { recursive: true })
  appendFileSync(ANCHOR_PATH, `${JSON.stringify({ payload, anchorHash: hash })}\n`, 'utf8')
  console.log(`✅ [evidence-anchor] 已锚 seq=${payload.seq} count=${payload.count} head=${payload.chainHead.slice(0, 12)}… hash=${hash.slice(0, 12)}…`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main()

export const __test__ = {
  anchorPayloadOf,
  anchorHashOf,
  shouldAnchor,
  readAnchors,
  verifyAnchors,
  ANCHOR_STATE,
  CHAIN_PATH,
  ANCHOR_PATH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
