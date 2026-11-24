// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { DEFAULT_SCAN_TICKET_TTL_MS } from './constants'
import { SCAN_TICKET_KIND } from './constants'
import { evaluateBulkThreshold } from './threshold'
import type { BulkDeleteDecision, BulkDeleteScanTicket, DeleteCandidate, DigestFn } from './types'

/**
 * 两阶段护栏(check → approve)。凭据 = 本次扫描结果的摘要,
 * approve 相必须与**当次重新扫描**逐字节对账 —— 口头保证("我确认要删")不构成放行输入。
 */

/** 规范形:路径+大小逐条排序拼接;sizeBytes 取不到写 '?',不猜 0 */
export function canonicalizeScan(candidates: readonly DeleteCandidate[]): string {
  return candidates
    .map((c) => `${c.path}\t${c.sizeBytes ?? '?'}`)
    .sort()
    .join('\n')
}

/** 凭据形态校验(纯结构,不判内容) */
export function isScanTicketShape(value: unknown): value is BulkDeleteScanTicket {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v['kind'] === SCAN_TICKET_KIND &&
    typeof v['scanId'] === 'string' &&
    v['scanId'].length > 0 &&
    typeof v['fingerprint'] === 'string' &&
    v['fingerprint'].length > 0 &&
    typeof v['deleteCount'] === 'number' &&
    Number.isFinite(v['deleteCount']) &&
    (v['deleteCount'] as number) > 0 &&
    typeof v['createdAtIso'] === 'string'
  )
}

/** 调用方回传形态宽容解析:对象 / JSON 串均可;解析不合法 ⇒ null(由调用方定 blocked/undetermined) */
export function parseScanTicketInput(raw: unknown): BulkDeleteScanTicket | null {
  if (raw === undefined || raw === null || raw === '') return null
  if (isScanTicketShape(raw)) return raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed.startsWith('{')) return null
    try {
      const parsed: unknown = JSON.parse(trimmed)
      return isScanTicketShape(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

function digestSafely(digest: DigestFn, canonical: string): string | null {
  try {
    const out = digest(canonical)
    return typeof out === 'string' && out.length > 0 ? out : null
  } catch {
    return null
  }
}

/** check 相:对当前扫描签发凭据;摘要器不可用 ⇒ undetermined(不冒领凭据) */
export function buildScanTicket(
  candidates: readonly DeleteCandidate[],
  digest: DigestFn,
  opts: { scanId: string; nowIso: string },
): { ticket: BulkDeleteScanTicket } | { verdict: 'undetermined'; reason: string } {
  const fingerprint = digestSafely(digest, canonicalizeScan(candidates))
  if (fingerprint === null) {
    return {
      verdict: 'undetermined',
      reason: '扫描凭据摘要不可用(digest 失败或空产出):未判定不记绿',
    }
  }
  return {
    ticket: {
      kind: SCAN_TICKET_KIND,
      scanId: opts.scanId,
      fingerprint,
      deleteCount: candidates.length,
      createdAtIso: opts.nowIso,
    },
  }
}

/** approve 相对账:凭据缺失/过期/形态坏 ⇒ blocked;重扫对不上 ⇒ blocked;摘要器坏 ⇒ undetermined */
export function verifyApproval(
  ticketInput: unknown,
  rescan: readonly DeleteCandidate[] | null | undefined,
  digest: DigestFn,
  opts: { nowIso: string; ttlMs?: number },
):
  | { ok: true; ticket: BulkDeleteScanTicket }
  | { ok: false; verdict: 'blocked' | 'undetermined'; reason: string } {
  if (!Array.isArray(rescan)) {
    return {
      ok: false,
      verdict: 'undetermined',
      reason: 'approve 相重新扫描取不到候选集:未判定不记绿',
    }
  }
  const ticket = parseScanTicketInput(ticketInput)
  if (!ticket) {
    return {
      ok: false,
      verdict: 'blocked',
      reason: 'approve 凭据缺失或形态不合法:必须原样回传 check 相签发的扫描凭据',
    }
  }
  const created = Date.parse(ticket.createdAtIso)
  const now = Date.parse(opts.nowIso)
  if (!Number.isFinite(created) || !Number.isFinite(now)) {
    return {
      ok: false,
      verdict: 'blocked',
      reason: '凭据或当前时刻不可解析:按过期处理,请重新 check',
    }
  }
  const ttl = opts.ttlMs ?? DEFAULT_SCAN_TICKET_TTL_MS
  if (now - created > ttl) {
    return { ok: false, verdict: 'blocked', reason: `扫描凭据已过期(TTL ${ttl}ms):请重新 check` }
  }
  const current = digestSafely(digest, canonicalizeScan(rescan))
  if (current === null) {
    return { ok: false, verdict: 'undetermined', reason: 'approve 相摘要器不可用:未判定不记绿' }
  }
  if (current !== ticket.fingerprint) {
    return {
      ok: false,
      verdict: 'blocked',
      reason: '凭据与本次扫描结果不一致(候选集已变化):请重新 check 并回传新凭据',
    }
  }
  return { ok: true, ticket }
}

/** 总入口:阈值判定 + (达阈值时)approve 相对账。任何一维未判定 ⇒ 整体未判定。 */
export function evaluateBulkDelete(input: {
  candidates: readonly DeleteCandidate[] | null | undefined
  digest: DigestFn
  scanId: string
  nowIso: string
  ticketInput?: unknown
  threshold?: number
  sampleSize?: number
  displayCap?: number
  ttlMs?: number
  expectedCount?: number
}): BulkDeleteDecision {
  const base = evaluateBulkThreshold(input.candidates, {
    threshold: input.threshold,
    sampleSize: input.sampleSize,
    displayCap: input.displayCap,
    expectedCount: input.expectedCount,
  })
  if (base.verdict === 'undetermined') return base
  if (base.verdict === 'clean') return base

  // 达阈值:进入 approve 相对账
  if (
    input.candidates === undefined ||
    input.candidates === null ||
    !Array.isArray(input.candidates)
  ) {
    return base
  }
  const candidates = input.candidates
  const issued = buildScanTicket(candidates, input.digest, {
    scanId: input.scanId,
    nowIso: input.nowIso,
  })
  if ('verdict' in issued) {
    return { ...base, verdict: 'undetermined', reason: issued.reason, ticket: undefined }
  }
  if (input.ticketInput === undefined || input.ticketInput === null || input.ticketInput === '') {
    return { ...base, ticket: issued.ticket }
  }
  const verified = verifyApproval(input.ticketInput, candidates, input.digest, {
    nowIso: input.nowIso,
    ttlMs: input.ttlMs,
  })
  if (!verified.ok) {
    return { ...base, verdict: verified.verdict, reason: verified.reason, ticket: issued.ticket }
  }
  return {
    ...base,
    verdict: 'clean',
    requiresApproval: true,
    reason: `approve 相对账通过(凭据与本次扫描逐字节一致):放行 ${base.deleteCount} 项`,
    ticket: verified.ticket,
    approved: true,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
