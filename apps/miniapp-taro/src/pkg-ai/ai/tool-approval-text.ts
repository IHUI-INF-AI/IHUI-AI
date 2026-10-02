// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D136(2026-10-01 立):小程序端工具审批的**纯逻辑层**(三档口径 / 决策载荷 / 队列 / 已处理记录)。
 *
 * 住在 `.ts` 而不是组件里,和端内 `cards/goal-line.ts`、`cards/tool-line.ts`、
 * `permission-tier-text.ts` 同一姿势:组件只做薄渲染,判档与取词这一层可被 vitest 直接喂数据
 * 断言(本端 vitest environment 是 'node',@tarojs/components 不可渲染 ⇒ "卡片真的渲染了
 * 什么"只能钉在这份返回值上,它进 JSX 的哪一行由常驻测试的源码接线断言钉住)。
 *
 * 三档对齐 web(`apps/web/src/components/ai/tool-approval-dialog.tsx` 的 SCOPE_OPTIONS =
 * once / session / always)逐档同值,取词更直接复用**同一把共享键**
 * (`editor.toolApproval.scopeOnce|scopeSession|scopeAlways`,现读
 * `packages/i18n/messages/shared/zh-CN.json` 已在位)⇒ 端内不抄第二份措辞。
 * 拒绝档不带 scope:scope 只描述"授权落到哪一档",拒绝不落任何授权
 * (与 @ihui/types ToolApprovalScope 语义一致;web 用 `decision==='approve'` 条件展开,
 * 本端把这一条固化成两个独立的构造函数,不给端内留"忘了去掉 scope"的写法)。
 */
import type { ToolApprovalScope } from '@ihui/types'

/** 端内取词函数(与 useTt 的 tt 同签名:键 + 端内中文兜底)。 */
export type TranslateWithFallback = (key: string, fallback: string) => string

/** 审批决策两档(与 @ihui/types ToolApprovalDecision 同字面)。 */
export type ApprovalDecision = 'approve' | 'reject'

/** 一条审批请求的渲染视图(载荷字段来自 src/lib/tool-approval-frame.ts 的认领层)。 */
export interface ApprovalRequestView {
  approvalId: string
  toolName: string
  toolCallId: string
  argsPreview: string
  dangerLevel: 'high' | 'medium' | 'low'
  sessionId?: string
}

/**
 * 三档授权作用域 —— 与 web 逐档对齐,键就是 web 用的那三把共享键。
 * 默认落 `once`(最小特权),与 web 的 `useState<ToolApprovalScope>('once')` 同口径。
 */
export const APPROVAL_SCOPE_TIERS: ReadonlyArray<{
  scope: ToolApprovalScope
  key: string
  fallback: string
}> = [
  { scope: 'once', key: 'editor.toolApproval.scopeOnce', fallback: '允许一次' },
  { scope: 'session', key: 'editor.toolApproval.scopeSession', fallback: '允许此对话' },
  { scope: 'always', key: 'editor.toolApproval.scopeAlways', fallback: '始终允许' },
]

/** 默认档(最小特权)。 */
export const DEFAULT_APPROVAL_SCOPE: ToolApprovalScope = 'once'

/** 档位键 → 共享/端内措辞;缺键回落到端内中文,绝不吐 raw key。 */
export function resolveApprovalTierLabels(
  tt: TranslateWithFallback,
): Array<{ scope: ToolApprovalScope; label: string }> {
  return APPROVAL_SCOPE_TIERS.map((tier) => ({
    scope: tier.scope,
    label: tt(tier.key, tier.fallback),
  }))
}

/** 危险档措辞(后端英文枚举不得直接贴到界面,与 permission-tier-text 同一禁令)。 */
const DANGER_LEVEL_TEXT: Record<ApprovalRequestView['dangerLevel'], { key: string; zh: string }> = {
  high: { key: 'ai.toolApproval.dangerHigh', zh: '高危' },
  medium: { key: 'ai.toolApproval.dangerMedium', zh: '中危' },
  low: { key: 'ai.toolApproval.dangerLow', zh: '低危' },
}

export function resolveDangerLevelText(
  level: ApprovalRequestView['dangerLevel'],
  tt: TranslateWithFallback,
): string {
  const entry = DANGER_LEVEL_TEXT[level] ?? DANGER_LEVEL_TEXT.high
  return tt(entry.key, entry.zh)
}

/** 卡片其余取词(端内命名空间 ai.toolApproval.*,兜底与 zh-CN 词包逐字同)。 */
export interface ApprovalTexts {
  title: string
  description: string
  argsPreview: string
  approve: string
  reject: string
  scopeLabel: string
  statusSending: string
  settledApprove: string
  settledReject: string
  sendFailed: string
  /** 排队条数("{count}" 由调用方替换;与 web 的 pendingCount 同语义) */
  pendingCount: string
  manualOverride: string
  manualOverrideDesc: string
  recordsTitle: string
}

const APPROVAL_TEXT_TABLE: ReadonlyArray<{ out: keyof ApprovalTexts; key: string; zh: string }> = [
  { out: 'title', key: 'ai.toolApproval.title', zh: '工具审批' },
  {
    out: 'description',
    key: 'ai.toolApproval.description',
    zh: 'AI 请求执行以下高危操作,请确认是否允许',
  },
  { out: 'argsPreview', key: 'ai.toolApproval.argsPreview', zh: '参数预览' },
  { out: 'approve', key: 'ai.toolApproval.approve', zh: '批准' },
  { out: 'reject', key: 'ai.toolApproval.reject', zh: '拒绝' },
  { out: 'scopeLabel', key: 'editor.toolApproval.scopeLabel', zh: '授权范围' },
  { out: 'statusSending', key: 'ai.toolApproval.statusSending', zh: '正在送出决策' },
  {
    out: 'settledApprove',
    key: 'ai.toolApproval.settledApprove',
    zh: '已批准:该操作将执行',
  },
  {
    out: 'settledReject',
    key: 'ai.toolApproval.settledReject',
    zh: '已拒绝:该操作未执行',
  },
  {
    out: 'sendFailed',
    key: 'ai.toolApproval.sendFailed',
    zh: '决策未能送出,该操作不会执行',
  },
  { out: 'manualOverride', key: 'ai.toolApproval.manualOverride', zh: '人工放行' },
  {
    out: 'manualOverrideDesc',
    key: 'ai.toolApproval.manualOverrideDesc',
    zh: '拒绝后仍可手动放行本条(服务端仍在等待时生效)',
  },
  { out: 'recordsTitle', key: 'ai.toolApproval.recordsTitle', zh: '本轮已处理的审批' },
  { out: 'pendingCount', key: 'ai.toolApproval.pendingCount', zh: '还有 {count} 条待你决策' },
]

export function resolveApprovalTexts(tt: TranslateWithFallback): ApprovalTexts {
  const out = {} as ApprovalTexts
  for (const row of APPROVAL_TEXT_TABLE) {
    const value = tt(row.key, row.zh)
    // 缺键时 tt 会给出 raw key(词包未刷新/离线包过期)⇒ 回落端内中文,界面不出 raw key
    out[row.out] = value === row.key ? row.zh : value
  }
  return out
}

/**
 * 决策回传载荷(与 @ihui/api-client `postToolApprovalResponse` 的入参同形 —— 本端不另立第二套
 * 上行字段口径;sessionId 缺席时给空串,由回传那一腿自己判失败,端内不猜)。
 */
export interface ApprovalDecisionPayload {
  sessionId: string
  approvalId: string
  decision: ApprovalDecision
  scope?: ToolApprovalScope
  reason?: string
}

/**
 * 批准载荷:三档之一**必带**(显式送 once,防后端缺省把授权放大 —— web 注释同一条理由)。
 */
export function buildApprovePayload(
  request: Pick<ApprovalRequestView, 'approvalId' | 'sessionId'>,
  scope: ToolApprovalScope,
  reason?: string,
): ApprovalDecisionPayload {
  const trimmed = typeof reason === 'string' ? reason.trim() : ''
  return {
    sessionId: request.sessionId ?? '',
    approvalId: request.approvalId,
    decision: 'approve',
    scope,
    ...(trimmed !== '' ? { reason: trimmed } : {}),
  }
}

/**
 * 拒绝载荷:**不带 scope**(拒绝不落任何授权;把 once 顺手带上去等于偷偷授权一次)。
 * 判据常驻测试:`'scope' in buildRejectPayload(req) === false`。
 */
export function buildRejectPayload(
  request: Pick<ApprovalRequestView, 'approvalId' | 'sessionId'>,
  reason?: string,
): ApprovalDecisionPayload {
  const trimmed = typeof reason === 'string' ? reason.trim() : ''
  return {
    sessionId: request.sessionId ?? '',
    approvalId: request.approvalId,
    decision: 'reject',
    ...(trimmed !== '' ? { reason: trimmed } : {}),
  }
}

/**
 * 结算态三档 —— 界面必须说清真值,不得把"按了按钮"读成"生效了":
 *  - approved / rejected:回传被服务端接受(该轮等待方被唤醒,工具执行 / 不执行);
 *  - send-failed:回传这一腿失败(传输不可达或服务端非 2xx)。此时**不得**显示"已处理",
 *    因为那一侧多半会走到 120s 超时按拒绝兜底 —— 用户必须看得见"没送出"这件事本身。
 */
export type ApprovalOutcome = 'approved' | 'rejected' | 'send-failed'

export interface ApprovalRecord {
  approvalId: string
  /** 回传端点寻址用(人工放行重送这一条时必须有它,不能靠页面临时状态猜) */
  sessionId?: string
  toolName: string
  decision: ApprovalDecision
  /** 仅 approve 生效时有值;reject 恒 undefined(与载荷同一纪律,记录里也不留 scope) */
  scope?: ToolApprovalScope
  outcome: ApprovalOutcome
  /** 第几次人工放行(0 = 还没走过人工放行出口) */
  overrideCount: number
}

/** 已处理记录是否仍留着"人工放行"出口:除已生效的批准外都在列(§30 拒批后须留人工口子)。 */
export function offersManualOverride(record: ApprovalRecord): boolean {
  return record.outcome !== 'approved'
}

/** 记录行的正文(进渲染的那一句;按三档各说各的事实,不合成一句通用文案)。 */
export function summarizeApprovalRecord(
  record: ApprovalRecord,
  texts: ApprovalTexts,
): { text: string; tone: 'ok' | 'warn' | 'danger' } {
  switch (record.outcome) {
    case 'approved':
      return { text: texts.settledApprove, tone: 'ok' }
    case 'rejected':
      return { text: texts.settledReject, tone: 'danger' }
    case 'send-failed':
    default:
      return { text: texts.sendFailed, tone: 'warn' }
  }
}

/** 队列上限(超出即丢最旧一条并留一行记录说明"没展示过"):宁可少展示,不可静默丢)。 */
const QUEUE_CAP = 8

/** 入队:同 approvalId 去重;返回同一引用表示没变(小程序 setData 语义下无谓新引用即无谓重渲染)。 */
export function enqueueApprovalRequest<T extends { approvalId: string }>(
  queue: readonly T[],
  request: T,
): readonly T[] {
  if (!request?.approvalId) return queue
  if (queue.some((r) => r.approvalId === request.approvalId)) return queue
  const next = [...queue, request]
  return next.length > QUEUE_CAP ? next.slice(next.length - QUEUE_CAP) : next
}

/** 摘掉某条(决策已送出后从队列移除,记录另存)。 */
export function dequeueApprovalRequest<T extends { approvalId: string }>(
  queue: readonly T[],
  approvalId: string,
): readonly T[] {
  return queue.filter((r) => r.approvalId !== approvalId)
}

/** 记录表上限(只留最近 12 条,防长会话把卡片撑成第二份消息流)。 */
const RECORD_CAP = 12

/**
 * 写记录:同 approvalId 覆盖(人工放行会把记录从 rejected 推进到新的 outcome,
 * 并累计 overrideCount),新记录插到最前。**记录住在页级 state,不住在卡里** ——
 * RN 那一版就是被测试逼出来的:关掉浮层后什么痕迹都不剩,用户仍然不知道发生过一次决策。
 */
export function appendApprovalRecord(
  records: readonly ApprovalRecord[],
  record: ApprovalRecord,
): readonly ApprovalRecord[] {
  const prev = records.find((r) => r.approvalId === record.approvalId)
  const merged: ApprovalRecord = prev
    ? { ...record, overrideCount: record.overrideCount + prev.overrideCount }
    : record
  const rest = records.filter((r) => r.approvalId !== record.approvalId)
  return [merged, ...rest].slice(0, RECORD_CAP)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
