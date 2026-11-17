// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 深化N(2026-11-17):子代理展示排序 —— 纯逻辑模块(单一真相源)。
// 痛点:多子代理并行时,运行中的、失败的、完成的按原始 spawn 顺序混在一起,
// 用户要在长列表里自己翻找"正在跑的"和"出错的"。
// 解法:按状态优先级稳定排序 —— 待审批 > 运行中 > 失败 > 完成;同级保持原顺序(不跳)。
// 单一真相源:排序规则只在本文件定义,渲染层 import 使用,禁止端内另写第二份排序。

import type { Subagent, SubagentStatus } from '@/hooks/use-agent-progress'

/**
 * 状态优先级(数值越小越靠前):
 *   pendingApproval(1) —— 需要用户立即处理,置顶
 *   running/spawned(2) —— 正在执行,用户最关心进度
 *   failed/dead(3)     —— 已失败,需要关注原因
 *   done(4)            —— 已完成,归档靠后
 *   其余/未知(5)        —— 兜底,不猜
 */
const STATUS_PRIORITY: Record<SubagentStatus, number> = {
  done: 4,
  running: 2,
  spawned: 2,
  failed: 3,
  dead: 3,
}

/** 取某子代理的排序优先级(pendingApproval 优先于一切;未知状态兜底为 5) */
function priorityOf(s: Subagent): number {
  if (s.pendingApproval) return 1
  return STATUS_PRIORITY[s.status] ?? 5
}

/**
 * 子代理展示排序:待审批 > 运行中 > 失败 > 完成;同级保持原顺序(稳定排序)。
 * 纯函数,不改原数组;返回新数组。
 * 稳定性保证:用 index 做次级键,确保同优先级子代理不因排序跳动(React key 稳定,不闪)。
 */
export function sortSubagentsForDisplay(subagents: readonly Subagent[]): Subagent[] {
  return subagents
    .map((s, idx) => ({ s, idx }))
    .sort((a, b) => {
      const pa = priorityOf(a.s)
      const pb = priorityOf(b.s)
      if (pa !== pb) return pa - pb
      return a.idx - b.idx // 同级保持原顺序(稳定,不跳)
    })
    .map(({ s }) => s)
}
