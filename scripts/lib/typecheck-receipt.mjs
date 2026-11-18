// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// T1 结论回执(tree-sha 键控的全量 typecheck 近期结论落盘)。
// 立因:票 docs/tickets/2026-11/t1-typecheck-budget-calibration-20261108.md §5 长期方案 ——
// 全量 typecheck 不再「每次推送现跑」:结论按 tree sha 落盘,推送门只读近期结论;
// 树变了即失效,超期未复跑按未命中(回落实跑),判据本体(降级/未判定/超时语义)一字未改。
// 本 lib 只做「写回执 / 读回执 / 判可用」三件事的单一实现,消费方是 check-typecheck.mjs 全量档。
// 残余风险(有意接受,与票面口径一致):tree sha 只覆盖索引面;工作树相对索引的未暂存漂移
// 正是 scope 降级判据负责消化的「并行会话噪音」,回执复用时同一判据照常重算,不新增逃逸面。
import { readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
export const RECEIPT_REL = '.ihui-agent/state/typecheck-receipt.json'
export const RECEIPT_SCHEMA_V = 1
// v2(2026-11-18):键从 `HEAD^{tree}`(整棵树)收紧到 **tsc 输入面摘要** —— 别人改 README/plan/脚本
// 不再让你的类型结论失效(实测单门 136s,占一次推送 85%)。判据强度不降:v1 仍原样接受并原样判,
// v2 额外要求「输入面摘要 + 环境指纹」都对上,取不到任一格 ⇒ 未命中回落实跑。
export const RECEIPT_SCHEMA_V2 = 2
export const RECEIPT_WRITER = 'check-typecheck.mjs'
// 缺省 12 小时:覆盖「白天多轮推送共用一次全量结论」的典型节律;夜间依赖/环境漂移由超期失效兜住。
export const RECEIPT_TTL_MIN_DEFAULT = 720

/** TTL(毫秒)。IHUI_TYPECHECK_RECEIPT_TTL_MIN 显式给定且 >0 才改档;非法值回退缺省。 */
export function receiptTtlMs(env = process.env) {
  const raw = Number(env.IHUI_TYPECHECK_RECEIPT_TTL_MIN)
  return Number.isFinite(raw) && raw > 0 ? raw * 60_000 : RECEIPT_TTL_MIN_DEFAULT * 60_000
}

/** 回执是否被显式关闭(排障用):IHUI_TYPECHECK_NO_RECEIPT=1 ⇒ 推送门回到「每次现跑」。 */
export function receiptDisabled(env = process.env) {
  return env.IHUI_TYPECHECK_NO_RECEIPT === '1'
}

/**
 * 结构校验:任何一格不成立 ⇒ 整份作废(失效方向是「回落实跑」,绝不半信半疑地复用)。
 * @returns {{ok:boolean, reason?:string}}
 */
export function validateReceipt(r) {
  if (!r || typeof r !== 'object') return { ok: false, reason: '回执缺失或非对象' }
  if (r.v === RECEIPT_SCHEMA_V2) {
    if (!/^[0-9a-f]{40}$/.test(String(r.inputDigest || '')))
      return { ok: false, reason: 'v2 inputDigest 非法' }
    if (!/^[0-9a-f]{40}$/.test(String(r.treeSha || '')))
      return { ok: false, reason: 'v2 treeSha 非法' }
    if (typeof r.envPrint !== 'string' || r.envPrint.length === 0)
      return { ok: false, reason: 'v2 envPrint 缺失' }
    if (!Number.isFinite(r.finishedAt) || r.finishedAt <= 0)
      return { ok: false, reason: 'finishedAt 缺失' }
    if (!Number.isInteger(r.exitCode) || r.exitCode < 0)
      return { ok: false, reason: 'exitCode 非法' }
    if (!Array.isArray(r.errorFiles) || r.errorFiles.some((f) => typeof f !== 'string'))
      return { ok: false, reason: 'errorFiles 非字符串数组' }
    if (r.writer !== RECEIPT_WRITER)
      return { ok: false, reason: `写入方 ${String(r.writer)} 非钩子链` }
    return { ok: true }
  }
  if (r.v !== RECEIPT_SCHEMA_V)
    return { ok: false, reason: `schema 版本 ${String(r.v)} ≠ ${RECEIPT_SCHEMA_V}/${RECEIPT_SCHEMA_V2}` }
  if (!/^[0-9a-f]{40}$/.test(String(r.treeSha || ''))) return { ok: false, reason: 'treeSha 非法' }
  if (!Number.isFinite(r.finishedAt) || r.finishedAt <= 0)
    return { ok: false, reason: 'finishedAt 缺失' }
  if (!Number.isInteger(r.exitCode) || r.exitCode < 0) return { ok: false, reason: 'exitCode 非法' }
  if (!Array.isArray(r.errorFiles) || r.errorFiles.some((f) => typeof f !== 'string')) {
    return { ok: false, reason: 'errorFiles 非字符串数组' }
  }
  if (r.writer !== RECEIPT_WRITER)
    return { ok: false, reason: `写入方 ${String(r.writer)} 非钩子链` }
  return { ok: true }
}

/** 读回执:文件不存在/解析失败/结构非法一律 null(读侧永不抛异常)。 */
export function readReceipt(absPath) {
  try {
    const raw = JSON.parse(readFileSync(absPath, 'utf8'))
    return validateReceipt(raw).ok ? raw : null
  } catch {
    return null
  }
}

/**
 * 判可用:tree sha 必须与当下面一致;时刻差必须落在 TTL 内(超期 ⇒ 未命中,回落实跑,不判绿)。
 * @returns {{ok:boolean, reason:string}}
 */
export function receiptUsable(receipt, { treeSha, inputDigest, envPrint, nowMs, ttlMs }) {
  if (!receipt) return { ok: false, reason: '无有效回执(缺失/结构非法)' }
  if (receipt.v === RECEIPT_SCHEMA_V2) {
    if (!inputDigest) return { ok: false, reason: '当下输入面摘要取不到(回落整树键/实跑)' }
    if (receipt.inputDigest !== inputDigest)
      return {
        ok: false,
        reason: `TS 输入面已变(回执 ${String(receipt.inputDigest).slice(0, 10)} ≠ 当下 ${String(inputDigest).slice(0, 10)})`,
      }
    if (typeof envPrint !== 'string' || receipt.envPrint !== envPrint)
      return { ok: false, reason: '编译器/依赖环境已变(node/ts/依赖布局指纹不同)' }
    const ageMs2 = nowMs - Number(receipt.finishedAt)
    if (!Number.isFinite(ageMs2) || ageMs2 < 0) return { ok: false, reason: '回执时刻不可解释' }
    if (ageMs2 > ttlMs) {
      return {
        ok: false,
        reason: `回执超期(${Math.round(ageMs2 / 60_000)} 分钟 > TTL ${Math.round(ttlMs / 60_000)} 分钟)`,
      }
    }
    return {
      ok: true,
      reason: `命中:TS 输入面未变、${Math.round(ageMs2 / 60_000)} 分钟前的结论`,
    }
  }
  if (!treeSha) return { ok: false, reason: '当下面 tree sha 取不到' }
  if (receipt.treeSha !== treeSha)
    return {
      ok: false,
      reason: `树已变(回执 ${String(receipt.treeSha).slice(0, 10)} ≠ 当下 ${String(treeSha).slice(0, 10)})`,
    }
  const ageMs = nowMs - Number(receipt.finishedAt)
  if (!Number.isFinite(ageMs) || ageMs < 0) return { ok: false, reason: '回执时刻不可解释' }
  if (ageMs > ttlMs) {
    return {
      ok: false,
      reason: `回执超期(${Math.round(ageMs / 60_000)} 分钟 > TTL ${Math.round(ttlMs / 60_000)} 分钟)`,
    }
  }
  return { ok: true, reason: `命中:同树、${Math.round(ageMs / 60_000)} 分钟前的结论` }
}

/** 原子写(临时文件 + rename);任何失败只让调用方知道「没写成」,绝不抛穿主流程。 */
export function writeReceipt(absPath, receipt) {
  const tmp = `${absPath}.tmp-${process.pid}`
  try {
    mkdirSync(dirname(absPath), { recursive: true })
    writeFileSync(tmp, JSON.stringify(receipt, null, 2))
    try {
      renameSync(tmp, absPath)
    } catch {
      // Windows:目标被并发读者占用时 rename 可能 EPERM ⇒ 删目标重试一次,再失败就放弃
      unlinkSync(absPath)
      renameSync(tmp, absPath)
    }
    return true
  } catch {
    try {
      unlinkSync(tmp)
    } catch {}
    return false
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
