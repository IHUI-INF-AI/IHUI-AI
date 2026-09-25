// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type {
  AgentActionAssignment,
  AgentActionResponse,
  AgentControlCapability,
} from '@ihui/types'

/**
 * AI 操控桥的「投递定址」端侧判定(共享层唯一实现,2026-09-26 立)。
 *
 * 为什么在共享层:api 的 WS 会话模型只有 userId→连接集合,`pushNotification` 结构上只能按
 * 用户广播(见 apps/api/src/routes/agent-control.ts 的定址投递注释),于是**每一条**投递都会
 * 打到该用户的所有连接上。服务端派发时在载荷里写入 `assignment{endpoint,instanceId,token}`,
 * 五个消费桥(extension / 桌面 webview 桥 / web UI 桥 / RN 桥 / 小程序桥)都必须回答同一个问题:
 * 「这条命令是不是给我的」。此前这套判定在两个桥里各写了一份(端种类字面量 + 自身实例 id
 * 取值口不同,其余逐字相同),本票再装到第三个桥就是第三份 —— 按 AGENTS §3
 * 「两处算同一件事必须共用一份实现」沉到共享层,端内只注入自己的身份。
 *
 * 刻意**不在本模块生成任何身份**:实例 id 与端种类由各端既有单点
 * (`getBridgeInstanceId()` / `getInstanceId()` / `getRnInstanceId()` / `getTaroInstanceId()`)
 * 传入,否则共享层反倒成了第二真相源。
 */

/** 本桥身份:端种类 + 自身实例 id(均由调用端提供的既有单点取值) */
export interface AgentActionSelfIdentity {
  endpoint: AgentControlCapability['endpoint']
  instanceId: string
}

/**
 * 定址判定:载荷缺 `assignment` = 旧服务端(未升级)形态,按改前**逐字**语义放行;
 * 有则须「端种类一致 ∧ 实例 id 一致」才执行 —— 只比端种类会让同端另一实例(多标签页 /
 * 多台同类型设备)抢执行,只比实例 id 会让跨档串投在 id 巧合时被误执行,故两条都要。
 */
export function isAgentActionAssignedToInstance(
  assignment: AgentActionAssignment | undefined,
  self: AgentActionSelfIdentity,
): boolean {
  if (!assignment) return true
  return assignment.endpoint === self.endpoint && assignment.instanceId === self.instanceId
}

/**
 * 非指派消息的可诊断痕迹文案(共享层单点,五桥同一句话,排障时不必按端各学一种措辞)。
 *
 * 刻意用 ASCII:本模块位于 `packages/shared/src`,在硬编码中文棘轮门(守门 70)的扫描面内,
 * 而调用端各自的中文额度已被既有文案占满 —— 为一条日志把某端顶过基线,等于把该门变成
 * 「谁碰谁被拦」。各端把这句拼在自己的 `[tag]` 前缀后面 console.warn / logger.warn 出去。
 */
export function unassignedAgentActionLogMessage(
  requestId: string,
  assignment: AgentActionAssignment | undefined,
  self: AgentActionSelfIdentity,
): string {
  return (
    'agent-control: action dropped, not assigned to this instance ' +
    `(requestId=${requestId}, assignedEndpoint=${String(assignment?.endpoint)}, ` +
    `assignedInstance=${String(assignment?.instanceId)}, self=${self.endpoint}/${self.instanceId})`
  )
}

/** requestId → 服务端派发的回执 token(仅缓存下发值,不在端内计算期望身份) */
export interface AssignmentTokenLedger {
  remember(requestId: string, token: string): void
  take(requestId: string): string | undefined
}

/**
 * 回执 token 台账:FIFO 限量,防止长跑(WS 常连)内存无界增长。
 * 淘汰策略与各桥改前一致:超限即删最早插入的一条。
 */
export function createAssignmentTokenLedger(maxEntries = 100): AssignmentTokenLedger {
  const tokens = new Map<string, string>()
  return {
    remember(requestId: string, token: string): void {
      tokens.set(requestId, token)
      if (tokens.size <= maxEntries) return
      const oldest = tokens.keys().next().value
      if (oldest !== undefined) tokens.delete(oldest)
    },
    take(requestId: string): string | undefined {
      const token = tokens.get(requestId)
      tokens.delete(requestId)
      return token
    },
  }
}

/**
 * 回执身份回显:有 ledger 记录 ⇒ 带 `responded{自报实例 + 原样回显服务端 token}`;
 * 无记录(旧服务端从未下发)⇒ 返回**原对象**,与改前逐字同形(不多一个键)。
 * 服务端据此做两段对账(token + 被指派实例),端侧不做任何身份计算。
 */
export function withRespondedIdentity(
  response: AgentActionResponse,
  ledger: AssignmentTokenLedger,
  self: AgentActionSelfIdentity,
): AgentActionResponse {
  const token = ledger.take(response.requestId)
  if (!token) return response
  return { ...response, responded: { instanceId: self.instanceId, assignmentToken: token } }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
