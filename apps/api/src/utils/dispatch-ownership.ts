// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 派单归属判据的**唯一出口**(2026-11-02,C 项收口;谓词本体 2026-11-01 由 S-ACL/S-STATS 立)。
 *
 * 回答两个问题,且只有这一份实现:
 *  ① 一条 SubagentDispatch 对某个 userId 是否可见(`isDispatchVisibleTo`);
 *  ② 按 id 取一条 + 判归属(`ownsDispatchById`,不存在与不属于你合并成同一个 false)。
 *
 * 为什么抽成独立模块:同一判据在 routes/subagent-dispatch.ts(6 个按 id 端点 +
 * /all + /active + topology/stats/queue)与 routes/subagents-extended-routes.ts
 * (`GET /subagents/:id/collaboration`)里都要用;复制一份就会漂移(§22c:判据单一份)。
 *
 * 语义边界(不在这里扩大):
 *  - 记录带 ownerUserId ⇒ 只有本人可见(跨租户不可见);
 *  - 记录**没有**该字段(本字段落地前的在途记录 / Redis 旧 hash)⇒ 按「未标注」照旧公开,
 *    **不隐藏历史**:把没标注写成"已隔离"与把泄漏写成"已修"是同一类错(§0.3)。
 *    该档是已知残余,已在 .ihui-agent/seats/S-G02.md 记明。
 *
 * 取不到与不属于你合并成同一个 false ⇒ 调用方一律 404:
 *  - 本仓既有约定就是 404(先 400 只挡 id 为空,不存在/已结束一律 404,无 403);
 *  - 403 会告诉攻击者「这个 id 真实存在,只是不属于你」⇒ 可枚举他人 id,防枚举优先。
 */

import type { SubagentDispatch } from '@ihui/shared/subagents'
import { subagentDispatchService } from '../services/subagent-dispatch-service.js'

/** 记录是否对 userId 可见(判据唯一实现;路由与测试都引这里,不在别处重写表达) */
export function isDispatchVisibleTo(dispatch: SubagentDispatch, userId: string): boolean {
  const owner = (dispatch as SubagentDispatch & { ownerUserId?: unknown }).ownerUserId
  if (typeof owner !== 'string' || owner.length === 0) return true
  return owner === userId
}

/**
 * 按 id 取派单 + 判归属(单一实现,所有按 id 端点共用)。
 * `false` = 不存在 **或** 不属于该调用方;调用方一律回 404(见文件头「防枚举」)。
 */
export function ownsDispatchById(id: string, userId: string): boolean {
  const dispatch = subagentDispatchService.findById(id)
  return dispatch !== null && isDispatchVisibleTo(dispatch, userId)
}
