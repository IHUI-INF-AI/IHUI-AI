/**
 * 告警投递降噪策略(规则化配置的唯一读取口,§0.6 单一真相源)。
 *
 * 只决定「同一族告警多久最多寄一封」,**不改判据语义**:breach / unjudged / 断流档
 * 仍由各尺子原样产出,收信人看到的正文、出路、读数一字不少。策略表 =
 * `scripts/data/alert-delivery-policy.json`,每条必须带 reason / owner / reviewBy;
 * 到期即不再压(失效方向回到"多喊一次",绝不静默)。
 */
import { readFileSync } from 'node:fs'

export const ALERT_DELIVERY_POLICY_FILE = 'scripts/data/alert-delivery-policy.json'

function normEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  const prefix = String(raw.prefix || '').trim()
  const cooldownMs = Number(raw.cooldownMs)
  const reason = String(raw.reason || '').trim()
  const owner = String(raw.owner || '').trim()
  const reviewBy = String(raw.reviewBy || '').trim()
  if (!id || !prefix || !Number.isFinite(cooldownMs) || cooldownMs <= 0) return null
  if (!reason || !owner || !/^\d{4}-\d{2}-\d{2}$/.test(reviewBy)) return null
  return { id, prefix, cooldownMs, reason, owner, reviewBy }
}

/** 解析策略表;坏 JSON / 坏条目一律跳过(通知层不许因配置写坏而抛)。 */
export function parseAlertDeliveryPolicy(text) {
  let arr
  try {
    arr = JSON.parse(String(text ?? ''))
  } catch {
    return { entries: [], error: '配置不是合法 JSON' }
  }
  if (!Array.isArray(arr)) return { entries: [], error: '配置顶层必须是数组' }
  const entries = []
  const invalid = []
  for (const raw of arr) {
    const e = normEntry(raw)
    if (e) entries.push(e)
    else invalid.push(String(raw && raw.id ? raw.id : raw))
  }
  return { entries, invalid }
}

/** 读文件版本(读不到 ⇒ 空表 + 原因,调用方按默认窗口继续)。 */
export function loadAlertDeliveryPolicy(file) {
  try {
    return parseAlertDeliveryPolicy(readFileSync(file, 'utf8'))
  } catch (e) {
    return { entries: [], error: `读不到策略表(${String((e && e.code) || e).slice(0, 60)})` }
  }
}

/**
 * 按告警名匹配策略(前缀命中,长前缀优先,避免宽规则压掉窄规则)。
 * 已过期 ⇒ 返回 `{ expired: true, entry }`,调用方必须报名且**不压**。
 */
export function matchAlertDeliveryPolicy(name, entries, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const n = String(name ?? '')
  const hit = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && e.prefix && n.startsWith(e.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  if (!hit) return null
  if (hit.reviewBy < today) return { expired: true, entry: hit }
  return { expired: false, entry: hit }
}
