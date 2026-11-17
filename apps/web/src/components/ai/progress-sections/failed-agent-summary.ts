// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 深化Q(2026-11-17):批次失败子代理折叠态归因行 —— 纯逻辑模块(单一真相源)。
// 痛点:失败归因(模式×来源双维度)已做细,但要**展开批次 + 翻到具体失败项**才能看到。
//       用户想知道"谁挂了 + 为什么",折叠态就该看到。
// 解法:从失败子代理提取一行概览 `@handle: 归因标签 + 简短原因`,批次折叠态直接列出。
// 单一真相源:提取规则只在本文件;活跃渲染(批次失败概览)import 使用。
// 设计:每条最多 1 行(handle + 已知归因标签 + 截断原因),超过 N 条折叠成"还有 X 个失败"。

import type { Subagent } from '@/hooks/use-agent-progress'
import { FAILURE_KIND_META } from './failure-kind-meta'

/** 单条失败概览(handle + 归因标签 + 简短原因) */
export interface FailedAgentSummary {
  id: string
  handle: string
  /** 归因标签(rate_limited→"限流" 等);无已知桶时为 null,只用原始原因 */
  kindLabel: string | null
  /** 原始失败原因(截断到 60 字符);无 failureReason 时为 null */
  reason: string | null
}

/** 原始原因展示上限(一行放得下,过长截断加省略号) */
const REASON_MAX = 60

/** 折叠态最多直显条数;超过则前 N 条 + "还有 X 个失败" */
export const FAILED_SUMMARY_MAX = 3

/** 截断长文本(单行放得下) */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * 从失败子代理列表提取折叠态归因概览。
 * 只取 status=failed/dead 的;每个一条,handle + 已知归因标签 + 截断原因。
 * 输入顺序保留(spawn 顺序),调用方按需截断。
 */
export function extractFailedAgentSummaries(subagents: readonly Subagent[]): FailedAgentSummary[] {
  return subagents
    .filter((s) => s.status === 'failed' || s.status === 'dead')
    .map((s) => {
      const kindLabel =
        s.failureKind && s.failureKind in FAILURE_KIND_META
          ? FAILURE_KIND_META[s.failureKind]?.label ?? null
          : null
      const reason = s.failureReason ? truncate(s.failureReason, REASON_MAX) : null
      return {
        id: s.id,
        handle: s.handle,
        kindLabel,
        reason,
      }
    })
}
