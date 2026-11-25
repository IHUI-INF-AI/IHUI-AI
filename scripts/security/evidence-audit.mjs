// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 证据链对账哨兵(2026-11-25 立)。
//
// `evidence-anchor.mjs --verify` 已经能答"链还是不是外面那些人看到的那条",但它是个
// **要人去跑**的命令 —— 链被整体重写、或锚停止增长,没人去跑就没人会发现。
//
// 这里补两件:
//   ① 挂 tick,10 分钟一格自动对账;
//   ② 补两条 --verify 本身没有的判据:
//      · 锚停摆:锚龄 > 节律的 2 倍。锚一停,外部序列就不再增长 —— 攻击者先让锚停摆,
//        之后有的是时间慢慢重写链,而外部手里只有旧锚,看不到新变化。
//      · 锚严重落后:链条数比已锚多出 maxLag 以上 ⇒ 外部可核验窗口远小于实际链。
//
// 三条既有硬判据(截断 / 已锚位置被改写 / 锚链断开)仍由 verifyAnchors 负责 ——
// 本层不写第二份判据(§0.6 单一真相源)。
//
// 用法:
//   node scripts/security/evidence-audit.mjs            # 打印结论,不发信
//   node scripts/security/evidence-audit.mjs --alert    # 非 ok 时走唯一邮件出口
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { readChain } from './lib/evidence-chain.mjs'
import { ANCHOR_STATE, readAnchors, verifyAnchors } from './evidence-anchor.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CHAIN_PATH = process.env.IHUI_EVIDENCE_CHAIN_PATH
  ? resolve(process.env.IHUI_EVIDENCE_CHAIN_PATH)
  : join(ROOT, '.ihui-agent', 'state', 'evidence-chain.jsonl')

export const AUDIT_STATE = Object.freeze({ OK: 'ok', BREACH: 'breach', STALE: 'stale', UNDETERMINED: 'undetermined' })
export const AUDIT_DEFAULT_INTERVAL_MIN = 60
export const AUDIT_DEFAULT_MAX_LAG = 2000
export const AUDIT_STALE_FACTOR = 2

/**
 * 三态判定。取不到输入一律 undetermined —— 不拿"没锚过"当绿,也不拿"读不出"当红。
 */
export function judgeAudit({
  chain,
  anchors,
  now = Date.now(),
  intervalMin = AUDIT_DEFAULT_INTERVAL_MIN,
  maxLag = AUDIT_DEFAULT_MAX_LAG,
} = {}) {
  const v = verifyAnchors(chain, anchors)
  const base = {
    chainCount: Array.isArray(chain?.entries) ? chain.entries.length : 0,
    anchorCount: Array.isArray(anchors) ? anchors.length : 0,
  }
  if (v.state === ANCHOR_STATE.BREACH) return { ...base, state: AUDIT_STATE.BREACH, notes: v.notes }
  if (v.state !== ANCHOR_STATE.OK) return { ...base, state: AUDIT_STATE.UNDETERMINED, notes: v.notes }

  const last = anchors[anchors.length - 1]
  const anchoredAt = Date.parse(String(last?.payload?.ts ?? ''))
  const anchoredCount = Number(last?.payload?.count ?? 0)
  const lag = base.chainCount - anchoredCount
  const notes = [...v.notes]

  if (!Number.isFinite(anchoredAt)) {
    return { ...base, state: AUDIT_STATE.UNDETERMINED, notes: [...notes, '最新锚的时刻读不出来(锚台账可能被改过)'], lag }
  }

  const ageMin = Math.round((now - anchoredAt) / 60_000)
  const staleAfterMin = intervalMin * AUDIT_STALE_FACTOR
  let state = AUDIT_STATE.OK
  if (ageMin > staleAfterMin) {
    state = AUDIT_STATE.STALE
    notes.push(`锚已停 ${ageMin} 分钟(节律 ${intervalMin} 分钟,容忍 ${staleAfterMin} 分钟)—— 外部序列停止增长,这段链没有任何外部可核验点`)
  }
  if (lag > maxLag) {
    state = AUDIT_STATE.STALE
    notes.push(`链比最新锚多 ${lag} 条(容忍 ${maxLag})—— 锚严重落后,外部窗口远小于实际链`)
  }
  return { ...base, state, notes, lag, ageMin, lastAnchorTs: last?.payload?.ts ?? null, anchoredCount }
}

const MAIL_HOWTO = [
  '怎么处置:',
  '  breach ⇒ 链被截断或改写。先取证(链文件 mtime、主机三查、最近登录与进程),不要先动链文件 ——',
  '            动一下就抹掉了唯一的现场。',
  '  stale  ⇒ 锚停摆或严重落后。先查 tick 与发信:锚邮件发不出去时 evidence-anchor 会 exit 2 且',
  '            **不写台账**(这是刻意的,写进去等于记了一封从未发出的锚)。',
  '',
  '对账命令: node scripts/security/evidence-audit.mjs',
  '验锚命令: node scripts/security/evidence-anchor.mjs --verify',
]

export function buildMailBody(r) {
  return [
    `证据链对账 ${r.state}`,
    '',
    `链条数 chainCount: ${r.chainCount}`,
    `已锚条数 anchoredCount: ${r.anchoredCount ?? 0}`,
    `落后 lag: ${r.lag ?? 0}`,
    `最新锚时刻: ${r.lastAnchorTs ?? '(无)'}`,
    `锚龄: ${r.ageMin ?? '(未判定)'} 分钟`,
    '',
    ...r.notes.map((n) => `· ${n}`),
    '',
    ...MAIL_HOWTO,
  ].join('\n')
}

/** 经唯一邮件出口(§5e,禁止自拼 SMTP)。--alert-id 用稳定语义身份,不拼条数与时序。 */
function sendAuditMail(r) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const script = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
  if (!existsSync(tsx) || !existsSync(script)) return { ok: false, reason: 'tsx 或通知脚本不在位(未判定)' }

  const msgPath = join(ROOT, '.ihui-agent', 'tmp', 'evidence-audit-mail.txt')
  mkdirSync(dirname(msgPath), { recursive: true })
  writeFileSync(msgPath, `${buildMailBody(r)}\n`, 'utf8')

  const res = spawnSync(
    process.execPath,
    [
      tsx,
      script,
      '--title',
      `证据链对账 ${r.state} — 链 ${r.chainCount} 条 / 已锚 ${r.anchoredCount ?? 0} 条`,
      '--severity',
      r.state === AUDIT_STATE.BREACH ? 'critical' : 'warning',
      '--source',
      'ihui/evidence-audit',
      '--environment',
      'production',
      '--message-file',
      msgPath,
      '--strict',
      '--alert-id',
      `evidence-audit-${r.state}`,
      '--dedupe-hours',
      '4',
    ],
    { cwd: ROOT, encoding: 'utf8', timeout: 120_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 },
  )
  return {
    ok: res.status === 0,
    reason: res.status === 0 ? '' : String(res.stderr ?? res.stdout ?? '').trim().split(/\r?\n/).slice(-2).join(' | '),
  }
}

function main() {
  const argv = process.argv.slice(2)
  const chain = readChain(CHAIN_PATH)
  const { rows, error } = readAnchors()
  if (error) {
    console.log(JSON.stringify({ state: AUDIT_STATE.UNDETERMINED, notes: [`锚台账读不出来: ${error}`] }, null, 2))
    return 2
  }
  const intervalMin = Number(process.env.IHUI_EVIDENCE_ANCHOR_INTERVAL_MIN || AUDIT_DEFAULT_INTERVAL_MIN)
  const maxLag = Number(process.env.IHUI_EVIDENCE_AUDIT_MAX_LAG || AUDIT_DEFAULT_MAX_LAG)
  const r = judgeAudit({ chain, anchors: rows, intervalMin, maxLag })

  const mail = argv.includes('--alert') && r.state !== AUDIT_STATE.OK ? sendAuditMail(r) : null
  console.log(JSON.stringify({ ...r, alerted: mail ? mail.ok : false, mailReason: mail && !mail.ok ? mail.reason : null }, null, 2))
  return r.state === AUDIT_STATE.OK ? 0 : r.state === AUDIT_STATE.UNDETERMINED ? 2 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main()

export const __test__ = { judgeAudit, buildMailBody }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
