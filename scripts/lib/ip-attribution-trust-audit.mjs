// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ip-attribution-trust-audit.mjs — 守护巡检"IP 归属判定是否仍可被头左右"格的**审计层**(2026-10-28 立)。
 *
 * 为什么住 lib:git-guardian.mjs 顶着门 103 C1 的 6000 行天花板,本格按 `registry-sync-audit`
 * /`lint-staged-pin-audit` 的同一条先例把逻辑归位 lib,守护只留薄接线(§0.6 判据一份实现)。
 *
 * 尺子 = `scripts/check-ip-attribution-trust.mjs`(三态与归族判据住那里);本层只做:
 * 节流(默认 60min)→ 派发 `--json` → 分档 → 红档经**唯一到人通道** notifyGuardRed。
 *
 * 告警身份 = 类别(`ip-attribution-trust`),**不带**条目数/具体 IP —— 表里多加一项就会换身份,
 * 那是 §5e-3/门 224 禁的抖量。恢复通知按"状态翻转"发一封,连续轮数只进出正文。
 * unjudged 只写日志不寄信(未判定不等于故障),但绝不记成 ok。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

export const IP_TRUST_INTERVAL_MS = Number(process.env.IHUI_IP_TRUST_INTERVAL_MS || 60 * 60 * 1000)
export const IP_TRUST_TICK_FILE = join(ROOT, '.ihui-agent/state/ip-attribution-trust-tick.json')

/** 节流纯函数：取不到 tick ⇒ 该跑（与 publicProbeDue / registrySyncHealthDue 同一条底线）。 */
export function ipTrustAuditDue(nowMs, tickMs, intervalMs = IP_TRUST_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

/** 把尺子的 --json 末行解析成分档结论；解析不出来 ⇒ unjudged（不当 ok，也不当 breach）。 */
export function parseIpTrustVerdict(stdout) {
  const lines = String(stdout ?? '')
    .split(/[\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (lines.length === 0) return { state: 'unjudged', reason: '尺子无输出 ⇒ 未判定' }
  try {
    const parsed = JSON.parse(lines[lines.length - 1])
    if (parsed?.state !== 'ok' && parsed?.state !== 'breach' && parsed?.state !== 'unjudged') {
      return { state: 'unjudged', reason: `尺子返回的档位认不出：${String(parsed?.state)}` }
    }
    return parsed
  } catch {
    return { state: 'unjudged', reason: '尺子末行不是 JSON ⇒ 未判定' }
  }
}

/**
 * 是否该寄信：只在**状态翻转**时寄（ok→breach 报红、breach→ok 报恢复）。
 * 同一状态连续多轮 ⇒ 压住，避免"一直在报警"(§5e-1/门 224 同源)。
 */
export function shouldNotifyIpTrust(prevState, nextState) {
  if (nextState === 'breach' && prevState !== 'breach') return 'finding'
  if (nextState === 'ok' && prevState === 'breach') return 'recovered'
  return null
}

export function runIpAttributionTrustAudit({
  now = Date.now(),
  intervalMs = IP_TRUST_INTERVAL_MS,
  tickFile = IP_TRUST_TICK_FILE,
  logger = (t) => console.log(t),
  notify = null,
  runner = null,
} = {}) {
  const script = join(ROOT, 'scripts/check-ip-attribution-trust.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ IP 归属信任:尺子不在位(scripts/check-ip-attribution-trust.mjs)⇒ 本轮跳过,不记为已探测')
    return { ran: false, why: '尺子不在位' }
  }

  let lastTick = NaN
  let prevState = null
  try {
    const raw = JSON.parse(readFileSync(tickFile, 'utf8'))
    lastTick = Date.parse(String(raw.at ?? ''))
    prevState = raw.state ?? null
  } catch {
    /* 没跑过 */
  }
  if (!ipTrustAuditDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }

  let stdout = ''
  let rc = 0
  try {
    stdout =
      runner === null
        ? execFileSync(process.execPath, [script, '--json'], {
            cwd: ROOT,
            encoding: 'utf8',
            timeout: 30_000,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          })
        : runner(script)
  } catch (e) {
    // 尺子对 breach 退 1、对 unjudged 退 2 —— 两者都带着 --json 结论行，不能当"跑挂了"
    stdout = String(e?.stdout ?? '')
    rc = typeof e?.status === 'number' ? e.status : 2
    if (!stdout.trim()) {
      logger(`⚠️ IP 归属信任:尺子无输出(exit ${e?.status ?? '?'})⇒ 本轮未判定,不记绿`)
      return { ran: false, why: '尺子无输出' }
    }
  }

  const verdict = parseIpTrustVerdict(stdout)
  rc = verdict.state === 'breach' ? 1 : verdict.state === 'unjudged' ? 2 : 0
  const action = shouldNotifyIpTrust(prevState, verdict.state)

  try {
    writeFileSync(tickFile, JSON.stringify({ at: new Date(now).toISOString(), state: verdict.state, rc }), 'utf8')
  } catch (e) {
    logger(`⚠️ IP 归属信任:节流台账写不下去(${e?.message ?? e})⇒ 下轮仍会复探,不静默`)
  }

  if (verdict.state === 'breach') {
    logger(`🔴 IP 归属信任 breach：${verdict.reason}`)
    if (action === 'finding' && notify) {
      notify(
        'IP 归属判定可被客户端头伪造（admin 分段/封禁/限流同一根）',
        `读数：${verdict.reason}\n出路：${verdict.fix ?? '先改 cf-connecting-ip 再保留 TRUSTED_PROXIES 项'}\n` +
          '实测三态见 apps/api/src/config/index.ts 的 TRUSTED_PROXIES 头注；取证：node scripts/check-ip-attribution-trust.mjs',
        { alertId: 'ip-attribution-trust' },
      )
    } else if (action === null && prevState === 'breach') {
      logger('ℹ️ IP 归属信任：仍是 breach（同一身份已被压住，不重复寄信）')
    }
  } else if (verdict.state === 'ok') {
    if (action === 'recovered') {
      logger('✅ IP 归属信任已转回 ok')
      if (notify) {
        notify('已恢复：IP 归属判定不再可被头伪造', `尺子读数：${verdict.reason}`, {
          alertId: 'ip-attribution-trust',
        })
      }
    } else {
      logger(`✅ IP 归属信任 ok（60min 节流内不再复探）`)
    }
  } else {
    logger(`⚠️ IP 归属信任未判定：${verdict.reason}（未判定 ≠ 通过，也不寄信）`)
  }

  return { ran: true, state: verdict.state, action, reason: verdict.reason }
}

export const __test__ = {
  ipTrustAuditDue,
  parseIpTrustVerdict,
  shouldNotifyIpTrust,
  runIpAttributionTrustAudit,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
