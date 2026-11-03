// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 派单归属判据的**唯一出口**(2026-11-02,C 项收口;谓词本体 2026-11-01 由 S-ACL/S-STATS 立)。
 * 2026-11-02 收尾:fail-open 档(无归属 ⇒ 公开)**已关闭**,改为 fail-closed(仅管理面)。
 *
 * 回答三个问题,且只有这一份实现:
 *  ① 一条 SubagentDispatch 对某个 userId 是否可见(`isDispatchVisibleTo`);
 *  ② 按 id 取一条 + 判归属(`ownsDispatchById`,不存在与不属于你合并成同一个 false);
 *  ③ 当前请求是否管理面(`isAdminViewer`,复用 require-permission 的唯一管理员口径)。
 *
 * 为什么抽成独立模块:同一判据在 routes/subagent-dispatch.ts(6 个按 id 端点 +
 * /all + /active + topology/stats/queue)与 routes/subagents-extended-routes.ts
 * (`GET /subagents/:id/collaboration`)里都要用;复制一份就会漂移(§22c:判据单一份)。
 *
 * 语义边界(顺序契约,不得颠倒):
 *  - 记录带 ownerUserId ⇒ 只有本人可见(跨租户不可见);
 *  - 记录**没有**该字段 ⇒ **不再公开**:普通用户按不存在处理(路由仍回 404,防枚举),
 *    系统管理员可见。启动装载时服务会先回填(conversation → agentTask → thread 兄弟),
 *    回填成功即回到「本人可见」;三源都推不出的才标 `ownership='orphan'`,与本档同判。
 *  - **先回填、后收紧**:回填发生在 `_loadActiveDispatches` 的 `runtimes.set` 之前,
 *    路由读不到尚未推导归属的记录 —— 不存在「代码已收紧、旧记录还没回填」的窗口。
 *
 * 取不到与不属于你合并成同一个 false ⇒ 调用方一律 404:
 *  - 本仓既有约定就是 404(先 400 只挡 id 为空,不存在/已结束一律 404,无 403);
 *  - 403 会告诉攻击者「这个 id 真实存在,只是不属于你」⇒ 可枚举他人 id,防枚举优先。
 */

import type { FastifyRequest } from 'fastify'
import type { SubagentDispatch } from '@ihui/shared/subagents'
import { subagentDispatchService } from '../services/subagent-dispatch-service.js'
import { isSystemAdmin } from '../plugins/require-permission.js'

/**
 * 当前请求是否系统管理员(roleId >= 1,任意管理员)。
 * 管理员口径的唯一出口在 plugins/require-permission.ts(`isSystemAdmin`);这里只做
 * 「派单读侧使用哪条通道」的封装:人用 JWT 链路,`includeInternalChannel: false`
 * (internal token 不得打开管理面,与 requireAdmin 同语义)。
 */
export function isAdminViewer(request: FastifyRequest): boolean {
  return isSystemAdmin(request, { includeInternalChannel: false })
}

/**
 * 记录是否对 userId 可见(判据唯一实现;路由与测试都引这里,不在别处重写表达)。
 *
 * @param isAdmin 仅当调用方是系统管理员时为 true(经 `isAdminViewer` 取得,不手写 roleId 比较)
 */
export function isDispatchVisibleTo(
  dispatch: SubagentDispatch,
  userId: string,
  isAdmin = false,
): boolean {
  const owner = dispatch.ownerUserId
  if (typeof owner === 'string' && owner.length > 0) return owner === userId
  // 无归属:回填失败的 orphan / 未回填旧档 —— 一律只给管理面,不再对全部登录用户公开。
  return isAdmin
}

/**
 * 按 id 取派单 + 判归属(单一实现,所有按 id 端点共用)。
 * `false` = 不存在 **或** 不属于该调用方;调用方一律回 404(见文件头「防枚举」)。
 */
export function ownsDispatchById(id: string, userId: string, isAdmin = false): boolean {
  const dispatch = subagentDispatchService.findById(id)
  return dispatch !== null && isDispatchVisibleTo(dispatch, userId, isAdmin)
}
