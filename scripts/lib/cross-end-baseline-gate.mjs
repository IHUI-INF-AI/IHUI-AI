// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cross-end-baseline-gate.mjs — 「存量固化基线 + 只拦新增/恶化」的共用纯判定。
 *
 * 立因(2026-11-06):跨端漂移尺与文案尺原本只有"只读体检"形态(现读存量非 0 ⇒ 恒 exit 1),
 * 于是它们只能被"人想起来"跑,永远进不了提交链。本库把判定拆成两步:
 *   ① 存量写进仓内基线文件(带 owner/expires/evidence/why,格式与既有台账一致);
 *   ② 每次判定只比"现读有没有比基线更坏",存量只报数。
 * 这样同一条尺既能做 commit 面 advisory,也能做 push 面 blocking,且不会造恒红(§12e)。
 *
 * 三态(§0.3):基线读不到 / 缺某维 / 现读不是有限数 ⇒ undetermined(不记绿也不冒红)。
 * 判据是可复算纯函数:同一 values + 同一 baseline ⇒ 同一结论,不读时钟、不读环境变量。
 */

import { readFileSync } from 'node:fs'

/** 取不到基线 ⇒ null + 原因,绝不折成"基线为 0"(否则现读第一次量到就被当成恶化) */
export function readBaseline(absPath) {
  try {
    const baseline = JSON.parse(readFileSync(absPath, 'utf8'))
    if (!baseline || typeof baseline !== 'object' || !baseline.dims || typeof baseline.dims !== 'object') {
      return { ok: false, baseline: null, why: `${absPath} 缺 dims 对象` }
    }
    return { ok: true, baseline, why: null }
  } catch (e) {
    return { ok: false, baseline: null, why: `基线读不出:${String(e?.message ?? e).slice(0, 120)}` }
  }
}

/** 现读值不是有限数 ⇒ 该维本轮没判(不得写 0) */
function finiteOrNull(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {Record<string, unknown>} values 现读值(平坦 key→number)
 * @param {object} baseline readBaseline().baseline
 * @param {[string, 'up'|'down', string][]} directions [键, 变坏方向, 人读标签]
 * @returns {{state:'ok'|'regressed'|'undetermined', regressions:object[], missing:string[], why?:string}}
 */
export function judgeBaseline({ values, baseline, directions }) {
  if (!baseline || typeof baseline !== 'object' || !baseline.dims) {
    return { state: 'undetermined', regressions: [], missing: [], why: '基线不可用' }
  }
  const regressions = []
  const missing = []
  for (const [key, dir, label] of directions) {
    // 基线没有这一维 ⇒ 该维不参与判定(基线与判据的键集必须显式同步,而不是猜)
    if (!(key in baseline.dims)) continue
    const base = finiteOrNull(baseline.dims[key])
    const now = finiteOrNull(values[key])
    if (base === null) {
      missing.push(`${key}(基线维取不到数)`)
      continue
    }
    if (now === null) {
      missing.push(key)
      continue
    }
    if (dir === 'up' ? now > base : now < base) {
      regressions.push({ dim: key, label, direction: dir, baseline: base, current: now, delta: now - base })
    }
  }
  if (missing.length > 0) {
    // 取不到输入面就是未判定:不许把"没读到"当成"没恶化"(§0.3)
    return { state: 'undetermined', regressions, missing, why: `取不到输入:${missing.join(',')}` }
  }
  return { state: regressions.length > 0 ? 'regressed' : 'ok', regressions, missing: [] }
}

/** 人读一行:把回归维拼成可直接贴进报告/告警的正文 */
export function describeRegressions(judged) {
  if (judged.state === 'undetermined') return `未判定:${judged.why ?? '输入面取不到'}`
  if (judged.state === 'ok') return '未发现相对基线的新增/恶化'
  return judged.regressions
    .map((r) => `${r.label} ${r.baseline} → ${r.current}(${r.delta > 0 ? '+' : ''}${r.delta})`)
    .join(' ｜ ')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
