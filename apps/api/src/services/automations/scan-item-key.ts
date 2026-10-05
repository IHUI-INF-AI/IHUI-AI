// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扫描条目复合键(ScanItem.key)的协议层 —— 构造与解析成对导出(G-998157)。
 *
 * 为什么要"成对":此前拼在 github-client 三处、拆在 orchestrator 一处,键格式又在
 * types.ts 与 routes/automations.ts 的注释里各抄一遍。改一侧忘另一侧不会报错,
 * 只会静默错配(比如分支名里拿到的是标题片段而不是序号)。
 *
 * 契约:
 * - 形态:`<source>:<seq>`,source ∈ SCAN_ITEM_KEY_SOURCES,seq 为一整段非空十进制数字串;
 * - 构造侧(buildScanItemKey)只接受合法 source 与单段 seq,否则抛错 —— 拼错要炸在写入点;
 * - 解析侧(parseScanItemKey)对任何不合规输入**一律返回 null**:无冒号、空段(`issue:`)、
 *   段数不符(`a:b:c`)、未知前缀(`foo:1`)、非数字序号(`issue:abc`)、非字符串。绝不返回
 *   空串或 `'x'` 之类占位符 —— 占位符会让下游把"键坏了"当成"序号是 x",错配一路走到底。
 *
 * G-1058624:判据只此一份。带原因的拒绝结果(describeScanItemKeyIssue)与只要值的
 * parseScanItemKey 共用同一个 parseScanItemKeyDetailed —— 路由层要的不再是"过/不过",
 * 而是"为什么不过"(400 错误信息必须点名未知前缀/序号非数字,而不是笼统格式错)。
 * 若在调用侧自行细分原因,就等于又抄了一份判据,故此处对外成对导出。
 *
 * 本文件是键格式的唯一真源:types.ts / routes/automations.ts 的注释只引用
 * SCAN_ITEM_KEY_FORMAT,不再各自抄一遍格式。
 */

import type { ScanSource } from './types.js'

/** 复合键的合法前缀全集(= 三源,与 ScanSource 同源)。 */
export const SCAN_ITEM_KEY_SOURCES = [
  'issue',
  'code-scanning',
  'workflow-run',
] as const satisfies readonly ScanSource[]

/** 键格式的唯一描述:文档注释引用本常量,禁止再抄第二份。 */
export const SCAN_ITEM_KEY_FORMAT = '<source>:<seq>(source ∈ issue | code-scanning | workflow-run)'

/** 解析结果:前缀 + 原始序号段(保持字符串,不做数值化 —— run id 可能超出安全整数)。 */
export interface ScanItemKey {
  source: ScanSource
  seq: string
}

function isScanSource(value: string): value is ScanSource {
  return (SCAN_ITEM_KEY_SOURCES as readonly string[]).includes(value)
}

/**
 * 构造复合键(github-client 三处拼接的唯一入口)。
 * seq 只允许单段非空(不含 ':'),否则抛错:写入点必须自己看见自己的错。
 */
export function buildScanItemKey(source: ScanSource, seq: number | string): string {
  if (!isScanSource(source)) {
    throw new Error(`[automations] 未知来源,拒绝构造条目键:${String(source)}`)
  }
  const raw = typeof seq === 'number' ? String(seq) : seq
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(`[automations] 序号必须是非空十进制数字串,拒绝构造条目键:${source}:${raw}`)
  }
  return `${source}:${raw}`
}

/**
 * 判定结果:要么带上拆好的键,要么带一句能直接回给调用方的拒绝原因。
 * 原因文案里必须点名拒绝类别(未知前缀 / 序号非数字 / 段数不对 …),
 * 不许退化成笼统的"格式错" —— 调用方只有拿到原因才知道该怎么改。
 */
type ScanItemKeyVerdict =
  | { ok: true; value: ScanItemKey }
  | { ok: false; reason: string }

/**
 * **唯一的判据实现**:build / parse / describe 三条对外路径全部经由本函数。
 * 任何"路由层比协议层宽松"的偏差都只可能源于有人绕过本函数另写判据。
 */
function parseScanItemKeyDetailed(key: unknown): ScanItemKeyVerdict {
  if (typeof key !== 'string') {
    return { ok: false, reason: '任务键必须是字符串' }
  }
  const parts = key.split(':')
  // 段数必须恰为 2:无冒号(1 段)与段数超(≥3 段)一并拒掉,但原因要分开说
  if (parts.length === 1) {
    return { ok: false, reason: `任务键缺少冒号,应为 ${SCAN_ITEM_KEY_FORMAT}` }
  }
  if (parts.length !== 2) {
    return { ok: false, reason: `任务键段数应为 2 段(实际 ${parts.length} 段),应为 ${SCAN_ITEM_KEY_FORMAT}` }
  }
  const source = parts[0] ?? ''
  const seq = parts[1] ?? ''
  if (source === '') {
    return { ok: false, reason: `任务键前缀为空,应为 ${SCAN_ITEM_KEY_FORMAT}` }
  }
  if (!isScanSource(source)) {
    return {
      ok: false,
      reason: `任务键未知前缀"${source}",合法前缀仅 ${SCAN_ITEM_KEY_SOURCES.join(' | ')}`,
    }
  }
  if (!/^[0-9]+$/.test(seq)) {
    return { ok: false, reason: `任务键序号非数字:"${seq}",须为十进制数字串` }
  }
  return { ok: true, value: { source, seq } }
}

/**
 * 解析复合键(orchestrator 拆分与一切读键处的唯一入口)。
 * 不合规一律 null —— 显式失败优于静默错值。
 */
export function parseScanItemKey(key: string): ScanItemKey | null {
  const verdict = parseScanItemKeyDetailed(key)
  return verdict.ok ? verdict.value : null
}

/**
 * G-1058624:只问"为什么不行",不返回拆好的键 —— 供路由层等边界处产出可读的 400 文案。
 * 通过 ⇒ null;不通过 ⇒ 点名拒绝类别的短句。
 * 判据与 parseScanItemKey 同源(同一 parseScanItemKeyDetailed),不允许调用侧自行细分原因。
 */
export function describeScanItemKeyIssue(raw: unknown): string | null {
  const verdict = parseScanItemKeyDetailed(raw)
  return verdict.ok ? null : verdict.reason
}
