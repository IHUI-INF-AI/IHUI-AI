// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 族级窗口判据(2026-11-03 立) —— 三个"没有族策略覆盖"的信封口共用这一份实现:
 *   · deploy/win/ihui-monitor.ps1      监控巡检告警(经 alert-dedup.ps1 的 PS 桥)
 *   · deploy/win/ihui-deploy.ps1       部署失败告警(经 alert-dedup.ps1 的 PS 桥)
 *   · scripts/check-credential-health.mjs 凭据巡检告警(直接 import)
 *
 * 口径与 scripts/lib/alert-delivery-policy.mjs **同源**:
 *   · 策略表仍是 `scripts/data/alert-delivery-policy.json`(前缀命中、长前缀优先、reviewBy 到期失效);
 *   · 本模块只补"同族 24h 至多一封"的窗口状态,不重写匹配规则,也不改各尺子的判据/正文/severity。
 *
 * 单一真相源纪律:
 *   · 族名由调用方按「URL 的 host+path」或「告警类别名」产出,**绝不用 URL 全串**
 *     (全串里的 query/状态词/连续确认次数每轮都在变 ⇒ 每轮换族 ⇒ 窗口结构上永不命中);
 *   · 状态按**族名**分槽(不是按策略条目),所以同一前缀下的不同 URL path / 不同类别互不误伤;
 *   · 首封必达:没有该族记录 ⇒ 放行;记录已满 24h ⇒ 放行;策略读不到/状态读不懂 ⇒ 放行
 *     (方向永远是"多喊一次",绝不静默);
 *   · 压住必须计数落盘(n/lastSuppressedMs),下一次放行时正文才有"压了几封"的账可写。
 *
 * 调用顺序纪律(与 git-guardian 的 policyHold 同构):**族窗口必须在该发信器自己的
 * 4h/逐项去重之前判定**。先过族窗口再做去重登记,24h 窗口届满时那格去重时间戳才不会
 * 被窗口期内的每轮重报顶新 —— 否则"跨 24h 恢复"会被自己的 4h 窗再压一轮。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadAlertDeliveryPolicy, matchAlertDeliveryPolicy } from './alert-delivery-policy.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

/** 默认族窗口状态:仓库根下运行态目录(与 git-guardian 的 notify 状态同址)。 */
export const ALERT_FAMILY_STATE_FILE = resolve(
  HERE,
  '..',
  '..',
  '.ihui-agent',
  'state',
  'alert-family-window.json',
)

/** 默认策略表:与 alert-delivery-policy.mjs 的单一真相源同一份文件。 */
export const ALERT_FAMILY_POLICY_FILE = resolve(HERE, '..', 'data', 'alert-delivery-policy.json')

/** 状态条目最多留 7 天,防止按 path 分槽后无限增长。 */
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

function asciiOnly(text) {
  return String(text ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .slice(0, 120)
}

/**
 * 读族窗口状态。三态严格分开:文件不存在=无历史;读不出=undetermined;读得出=分槽表。
 * 返回 { found, families, error };error 非空时调用方必须 fail-open(照发)。
 */
export function readAlertFamilyState(file = ALERT_FAMILY_STATE_FILE) {
  if (!existsSync(file)) return { found: false, families: {}, error: '' }
  let obj
  try {
    obj = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    return {
      found: true,
      families: {},
      error: `状态文件读不出: ${String((e && e.message) || e).slice(0, 80)}`,
    }
  }
  const raw = obj && typeof obj === 'object' ? obj.families : null
  if (!raw || typeof raw !== 'object') {
    return { found: true, families: {}, error: '状态文件缺少 families 表' }
  }
  const families = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue
    const firstMs = Number(value.firstMs)
    if (!Number.isFinite(firstMs)) continue
    const n = Number(value.n)
    const lastSuppressedMs = Number(value.lastSuppressedMs)
    families[key] = {
      firstMs,
      firstTs: String(value.firstTs || ''),
      n: Number.isFinite(n) ? n : 0,
      lastSuppressedMs: Number.isFinite(lastSuppressedMs) ? lastSuppressedMs : 0,
    }
  }
  return { found: true, families, error: '' }
}

/** 原子写(临时名 + rename),避免并发读者读到半截 JSON。写失败返回 { ok:false,error }。 */
function writeAlertFamilyState(families, file, nowMs) {
  const pruned = {}
  for (const [key, value] of Object.entries(families)) {
    if (!value || !Number.isFinite(value.firstMs)) continue
    if (nowMs - value.firstMs > PRUNE_AFTER_MS) continue
    pruned[key] = value
  }
  try {
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
    writeFileSync(tmp, JSON.stringify({ version: 1, families: pruned }), 'utf8')
    renameSync(tmp, file)
    return { ok: true, error: '' }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).slice(0, 100) }
  }
}

/**
 * 判定这一族现在该不该寄。
 * 返回 { action:'send'|'suppress', why, ageMs, cooldownMs, entryId, suppressed, count?, stateError? }
 *   why 取值: first / window-hit / window-expired / no-policy / policy-expired / state-undetermined /
 *            missing-family。除 window-hit 外一律 action='send'(fail-open)。
 */
export function decideAlertFamilyWindow({
  family,
  stateFile = ALERT_FAMILY_STATE_FILE,
  policyFile = ALERT_FAMILY_POLICY_FILE,
  nowMs = Date.now(),
  today = '',
} = {}) {
  const name = String(family || '').trim()
  if (!name) {
    return {
      action: 'send',
      why: 'missing-family',
      suppressed: false,
      ageMs: 0,
      cooldownMs: 0,
      entryId: '',
    }
  }
  const policy = loadAlertDeliveryPolicy(policyFile)
  const hit = matchAlertDeliveryPolicy(name, policy.entries, {
    today: today || new Date(nowMs).toISOString().slice(0, 10),
  })
  if (!hit) {
    return {
      action: 'send',
      why: 'no-policy',
      suppressed: false,
      ageMs: 0,
      cooldownMs: 0,
      entryId: '',
    }
  }
  const entry = hit.entry
  if (hit.expired) {
    return {
      action: 'send',
      why: 'policy-expired',
      suppressed: false,
      ageMs: 0,
      cooldownMs: entry.cooldownMs,
      entryId: entry.id,
    }
  }
  const state = readAlertFamilyState(stateFile)
  if (state.error) {
    return {
      action: 'send',
      why: 'state-undetermined',
      suppressed: false,
      ageMs: 0,
      cooldownMs: entry.cooldownMs,
      entryId: entry.id,
      stateError: state.error,
    }
  }
  const prev = state.families[name]
  if (prev) {
    const ageMs = nowMs - prev.firstMs
    if (ageMs >= 0 && ageMs < entry.cooldownMs) {
      prev.n = Number(prev.n || 0) + 1
      prev.lastSuppressedMs = nowMs
      state.families[name] = prev
      writeAlertFamilyState(state.families, stateFile, nowMs)
      return {
        action: 'suppress',
        why: 'window-hit',
        suppressed: true,
        ageMs,
        cooldownMs: entry.cooldownMs,
        entryId: entry.id,
        count: prev.n,
      }
    }
    return {
      action: 'send',
      why: 'window-expired',
      suppressed: false,
      ageMs,
      cooldownMs: entry.cooldownMs,
      entryId: entry.id,
    }
  }
  return {
    action: 'send',
    why: 'first',
    suppressed: false,
    ageMs: 0,
    cooldownMs: entry.cooldownMs,
    entryId: entry.id,
  }
}

/**
 * 投递**成功后**记窗口起点。失败不记 —— 首封没能送达时,下一轮必须还能重试。
 * 返回 { ok, error }。
 */
export function commitAlertFamilyDelivery({
  family,
  stateFile = ALERT_FAMILY_STATE_FILE,
  nowMs = Date.now(),
} = {}) {
  const name = String(family || '').trim()
  if (!name) return { ok: false, error: 'missing-family' }
  const state = readAlertFamilyState(stateFile)
  if (state.error) return { ok: false, error: state.error }
  const families = { ...state.families }
  families[name] = {
    firstMs: nowMs,
    firstTs: new Date(nowMs).toISOString(),
    n: 0,
    lastSuppressedMs: 0,
  }
  return writeAlertFamilyState(families, stateFile, nowMs)
}

/** 凭据巡检的族名:失效与恢复是**两族**(恢复通知不得被失效窗口压住)。 */
export function credentialAlertFamily({ recovered = false } = {}) {
  return recovered ? '凭据巡检:类别=recovered' : '凭据巡检:类别=credential-fail'
}

// ── CLI(供 PowerShell 侧调用;stdout 只输出 ASCII,PS 5.1 的代码页不会把它读坏)──────────
function argValue(argv, flag, fallback = '') {
  const i = argv.indexOf(flag)
  return i > 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const CLI_MODES = new Set(['check', 'commit'])
const cliMode = process.argv[2]

if (CLI_MODES.has(cliMode)) {
  try {
    const argv = process.argv.slice(2)
    // PS 5.1 的 argv 代码页对中文不可靠 ⇒ PowerShell 侧一律传 UTF-8 的 base64,
    // 这里解回原文;直接命令行调用仍可用 --family。
    const familyB64 = argValue(argv, '--family-b64')
    const family = familyB64
      ? Buffer.from(familyB64, 'base64').toString('utf8')
      : argValue(argv, '--family')
    const stateFile = argValue(argv, '--state', ALERT_FAMILY_STATE_FILE)
    const policyFile = argValue(argv, '--policy', ALERT_FAMILY_POLICY_FILE)
    const nowArg = argValue(argv, '--now')
    const nowMs = nowArg ? Date.parse(nowArg) : Date.now()
    if (cliMode === 'check') {
      const r = decideAlertFamilyWindow({
        family,
        stateFile,
        policyFile,
        nowMs: Number.isFinite(nowMs) ? nowMs : Date.now(),
      })
      process.stdout.write(
        JSON.stringify({
          action: r.action,
          why: r.why,
          ageMs: Math.max(0, Math.round(Number(r.ageMs) || 0)),
          cooldownMs: Math.round(Number(r.cooldownMs) || 0),
          entryId: r.entryId,
          count: r.count || 0,
        }) + '\n',
      )
      process.exit(r.action === 'suppress' ? 3 : 0)
    }
    const r = commitAlertFamilyDelivery({ family, stateFile, nowMs: Date.now() })
    process.stdout.write(JSON.stringify({ action: 'commit', ok: !!r.ok, error: asciiOnly(r.error) }) + '\n')
    process.exit(r.ok ? 0 : 5)
  } catch (e) {
    // 判据自身崩了也必须 fail-open:宁可多喊一次,绝不把真故障压成静音。
    process.stdout.write(
      JSON.stringify({ action: 'send', why: 'gate-error', error: asciiOnly((e && e.message) || e) }) + '\n',
    )
    process.exit(0)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
