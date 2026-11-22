// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 首页/dashboard 用量聚合出口的"必须面/可选面"双语义降级判定(G-652)。
 *
 * 两种失败必须走两条不同形的输出路径,绝不允许把"后端报错"伪装成"零用量":
 *  (a) 可选面 transport 失败(网络断开/429/超时/5xx)⇒ 仅该区清空 + dropped 计数行
 *      ("暂不可用 + 失败 N 次"),其余区域照常;
 *  (b) HTTP 200 但信封 code!=0(后端业务报错)⇒ 整体上抛/整体红(返回 fatal 形状,
 *      调用方渲染整体错误块),绝不降级成零或清空。
 * 必须面 transport 失败同 (b) 整体红 —— 必须面没有"降级清区"资格。
 *
 * 判定依据(@ihui/api-client client.ts fetchApi 的回包事实):
 *  - HTTP 200 + envelope.code!=0 → ApiResult{success:false, status:200};
 *  - HTTP 4xx(如 429)→ ApiResult{success:false, status:4xx};
 *  - 网络断/超时 → normalizeErrorToResult → success:false 无 status;
 *  即 status===200 的失败分支 = 信封失败(后端报错),其余失败分支 = transport 失败。
 *
 * 本文件全部为纯函数:失败计数由调用方持有(priorFailures 进、failureCounts 出),
 * 不在模块级藏状态。
 */

import type { ApiResult } from '@ihui/types'

/** 失败语义:transport=网络/429/超时/5xx;envelope=HTTP200 信封 code!=0(后端报错) */
export type UsageFaceFailureReason = 'transport' | 'envelope'

/** 单个用量面的产出:ok 或已分类失败(查询未就绪由调用方传 null,不算失败) */
export type UsageFaceOutcome<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'failed'; reason: UsageFaceFailureReason; message: string }

/**
 * ApiResult → 用量面产出(双语义判定核心)。
 * 只有 status===200 的失败分支才是"后端报错"(envelope);其余一律 transport。
 */
export function toUsageFaceOutcome<T>(result: ApiResult<T>): UsageFaceOutcome<T> {
  if (result.success) return { kind: 'ok', data: result.data }
  if (result.status === 200) {
    return { kind: 'failed', reason: 'envelope', message: result.error }
  }
  return { kind: 'failed', reason: 'transport', message: result.error }
}

export interface UsageFaceInput<T = unknown> {
  /** 面标识(如 'user-stats' / 'wallet-balance') */
  id: string
  /** 必须面:任何失败都整体红,无降级资格;可选面:仅 transport 失败降级清区 */
  mandatory: boolean
  /** 查询未就绪(加载中)传 null/undefined —— 不算失败,不计数 */
  outcome: UsageFaceOutcome<T> | null | undefined
}

/** 可选面 transport 失败后"区域清空 + 计数行"的一行 */
export interface UsageFaceDroppedRow {
  faceId: string
  message: string
  /** 累计失败次数(含本次),渲染"失败 N 次" */
  count: number
}

export interface UsageFaceSectionReady<T = unknown> {
  faceId: string
  mandatory: boolean
  status: 'ready'
  data: T
}

export interface UsageFaceSectionPending {
  faceId: string
  mandatory: boolean
  status: 'pending'
}

export interface UsageFaceSectionUnavailable {
  faceId: string
  mandatory: boolean
  status: 'unavailable'
  message: string
}

export type UsageFaceSection =
  | UsageFaceSectionReady
  | UsageFaceSectionPending
  | UsageFaceSectionUnavailable

/**
 * 聚合结果 —— 两条路径的形状判然不同(验收要求"不得同形"):
 *  - aggregate(降级形状):sections(ready/pending/unavailable)+ dropped 计数行 +
 *    failureCounts(调用方持久化,下一轮作 priorFailures 传回);
 *  - fatal(整体红形状):只有失败面定位 + reason + message,没有 sections/dropped。
 */
export type UsageFaceAggregate =
  | {
      shape: 'aggregate'
      sections: UsageFaceSection[]
      dropped: UsageFaceDroppedRow[]
      failureCounts: Record<string, number>
    }
  | {
      shape: 'fatal'
      faceId: string
      reason: UsageFaceFailureReason
      mandatory: boolean
      message: string
    }

/**
 * 双语义聚合:先裁整体红(任意面 envelope / 必须面 transport),再裁降级形状
 * (可选面 transport → 该区清空 + dropped 计数行)。
 * priorFailures:调用方持有的上轮累计失败计数;本次成功的面归零(恢复即清账)。
 */
export function aggregateUsageFaces(
  faces: readonly UsageFaceInput[],
  priorFailures: Record<string, number> = {},
): UsageFaceAggregate {
  for (const face of faces) {
    const outcome = face.outcome
    if (!outcome || outcome.kind !== 'failed') continue
    // (b) HTTP200 信封失败(后端报错)任意面,或必须面 transport 失败:整体上抛形状
    if (outcome.reason === 'envelope' || face.mandatory) {
      return {
        shape: 'fatal',
        faceId: face.id,
        reason: outcome.reason,
        mandatory: face.mandatory,
        message: outcome.message,
      }
    }
  }

  const sections: UsageFaceSection[] = []
  const dropped: UsageFaceDroppedRow[] = []
  const failureCounts: Record<string, number> = { ...priorFailures }
  for (const face of faces) {
    const outcome = face.outcome
    if (!outcome) {
      sections.push({ faceId: face.id, mandatory: face.mandatory, status: 'pending' })
      continue
    }
    if (outcome.kind === 'ok') {
      failureCounts[face.id] = 0
      sections.push({
        faceId: face.id,
        mandatory: face.mandatory,
        status: 'ready',
        data: outcome.data,
      })
      continue
    }
    // 可选面 transport 失败:该区清空 + 计数行(绝不显示 0)
    const count = (failureCounts[face.id] ?? 0) + 1
    failureCounts[face.id] = count
    sections.push({
      faceId: face.id,
      mandatory: face.mandatory,
      status: 'unavailable',
      message: outcome.message,
    })
    dropped.push({ faceId: face.id, message: outcome.message, count })
  }
  return { shape: 'aggregate', sections, dropped, failureCounts }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
