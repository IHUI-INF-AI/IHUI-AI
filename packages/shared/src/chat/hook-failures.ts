// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-87 Hook 失败可见性卡 —— 六态词汇表 + 判定层(契约先行,2026-09-24 立)
//
// **定档自证结论(本票主体,改本文件前先读)**:定档 **C(部分有)** ——
// hook_engine 的失败信息**内存结构有、SSE 通道无、DLQ 消费出口无**:
//   ① 失败信息落点(有):`hook_engine.py::_execute_hook` 失败路径落两处 ——
//      · 执行日志 `_make_log`(hook_id/event/success/duration/result/error/input_payload/
//        replay/skipped),经 GET /hooks/{id}/logs 可查;
//      · DLQ 死信条目 `_push_dlq`(Redis `hooks:dlq:{hook_id}` LPUSH+LTRIM 100,
//        降级内存):{id, hookId, originalPayload, error, failedAt, retryCount}。
//      另有内部事件 orchestration_hub.emit("hook.failed", {hook_id, event, error[:200]})。
//   ② SSE 通道(无):`agent_events.py` 的 HOOK_EVENTS 白名单/AGENT_SUBSCRIBE_EVENTS
//      十五事件里**没有任何 hook 执行失败事件**;D34 的 injection_applied/retry_scheduled
//      是 LLM 主线帧(retry_scheduled = 网关 LLM 重试,非 hook 重试)。hook.failed 只进
//      orchestration_hub,不在 SSE 订阅集合,前端拿不到。
//   ③ DLQ 消费出口(无):`list_dlq`/`reprocess_dlq`/`clear_dlq` 全仓 **0 调用方**
//      (hooks.py 路由 19 个端点无一涉及 DLQ)——死信队列只写不读。
//   且 DLQ 条目缺 exitCode/command/durationMs(exitCode 无处落、command 在 hook 配置里、
//   duration 只在 log 不在 DLQ)。
// ⇒ 按任务规则 C 同 B 处理:**本票不写渲染代码**,本模块作为事件补出前的**契约先行**
//   (判定层 + 六态词汇表);渲染位与 D34 hook.failed SSE 事件的补出规格见最终报告,
//   交主会话立项。
//
// **对标关系**:
//   · Qoder `hook.status` 六态 —— 本模块逐一对应;其中 **`resultNotRecorded`
//     (未记录最终结果)** 是 Qoder 有而我方**完全没有**的终态缺省:引擎侧 DLQ Redis
//     读取失败降级返回空(hook_engine.py:1146-1149)、内存 DLQ 进程重启即丢、
//     hook.failed 事件 error 截断 200 字符 —— 凡"结果既不在日志也不在 DLQ"时,
//     不得静默留空(静默留空 = 把"没记录"伪装成"没问题"),必须显式宣告。
//   · Qoder `hook_non_blocking_error` attachment 七字段 —— 对齐为
//     `HookFailureAttachment`(hookName/hookEvent/command/stderr/exitCode/durationMs)。
//   · Trae `enterpriseHooks.toolFailure` 卡 —— 卡片语义位。
//
// 与 D71 `turn-status` / D72 `worktree-lifecycle` 同范式:常量 + 纯函数 +
// 穷尽 switch 零 default + `assertNever`。端内不得再建第二套 hook 失败判定。

import { sanitizeEvidenceText } from '../utils/redact'

/** 词包命名空间(web 侧 `useTranslations('ai.pane.hookFailures')`;本票未接线,契约先行) */
export const HOOK_FAILURES_NAMESPACE = 'ai.pane.hookFailures' as const

/**
 * Hook 执行状态六态(取值即 i18n 键片段;`ai.pane.hookFailures.state.<key>`)。
 * 与 Qoder hook.status 六态逐一对齐,每态标注我方实证落点(hook_engine.py):
 *   - succeeded         成功终态(:779 success=True → log.success)
 *   - retryScheduled    重试已排定(非终态;:789-797 重试循环 attempt/maxRetries)
 *   - failed            重试耗尽失败终态(:810-812 入 DLQ + :815-829 hook.failed 事件)
 *   - timedOut          超时失败终态(:893 webhook TimeoutException / :942 script SCRIPT_TIMEOUT)
 *   - skipped           跳过未执行终态(:1095/:1108 log.skipped 字段)
 *   - resultNotRecorded 未记录最终结果(终态缺省;DLQ 读失败降级返回空 :1146-1149)
 */
export const HOOK_STATUS_STATES = [
  'succeeded',
  'retryScheduled',
  'failed',
  'timedOut',
  'skipped',
  'resultNotRecorded',
] as const
export type HookStatusState = (typeof HOOK_STATUS_STATES)[number]

/** 语义色档(判定层只给语义,具体样式由渲染件决定) */
export const HOOK_TONES = ['neutral', 'info', 'warning', 'success', 'danger'] as const
export type HookTone = (typeof HOOK_TONES)[number]

/** 卡片可给出的动作(`retry` = DLQ reprocess 语义位;`inspect` = 打开设置页排查) */
export const HOOK_FAILURE_ACTIONS = ['none', 'retry', 'inspect'] as const
export type HookFailureAction = (typeof HOOK_FAILURE_ACTIONS)[number]

/** attachment 明细字段(渲染层据此取 `field.<key>` 标签键) */
export const HOOK_EVIDENCE_FIELDS = [
  'hookName',
  'hookEvent',
  'command',
  'stderr',
  'exitCode',
  'durationMs',
] as const
export type HookEvidenceField = (typeof HOOK_EVIDENCE_FIELDS)[number]

/**
 * 失败上下文(引擎侧原始输入,**未经脱敏**)。
 * 对标 Qoder hook_non_blocking_error attachment 的七字段输入;`failedAt` 为可选补充。
 * 所有字符串字段**禁止裸传 stderr/command** —— 出口 `buildHookFailureAttachment`
 * 统一过 `sanitizeEvidenceText`。
 */
export interface HookFailureContext {
  readonly hookName?: string | null
  readonly hookEvent?: string | null
  readonly command?: string | null
  readonly stderr?: string | null
  readonly exitCode?: number | null
  readonly durationMs?: number | null
  readonly failedAt?: string | null
}

/**
 * 失败卡 attachment(已脱敏,可直接进 DOM/日志/工单)。
 * 形状对标 Qoder hook_non_blocking_error attachment。
 */
export interface HookFailureAttachment {
  readonly hookName: string
  readonly hookEvent: string
  /** 已过 sanitizeEvidenceText 的命令行 */
  readonly command: string
  /** 已过 sanitizeEvidenceText 的错误输出(严禁裸传原文) */
  readonly stderr: string
  readonly exitCode: number | null
  readonly durationMs: number | null
}

/** 六态 → 视图判据 */
export interface HookFailureView {
  readonly state: HookStatusState
  readonly tone: HookTone
  /** `ai.pane.hookFailures` 内的标题键 */
  readonly titleKey: string
  /** `ai.pane.hookFailures` 内的 aria-label 键(读屏用,比标题更完整) */
  readonly ariaKey: string
  /** `ai.pane.hookFailures` 内的补充说明键;null = 该态无需补充说明 */
  readonly hintKey: string | null
  /** 是否终态 */
  readonly terminal: boolean
  /** 是否渲染 attachment 明细(六字段卡) */
  readonly showsEvidence: boolean
  /**
   * 证据缺失,必须**显式宣告**"未记录"(仅 resultNotRecorded 为 true)。
   * 渲染件见到 true 时必须渲染"未记录最终结果"占位说明,**禁止静默留空** ——
   * 留空会把"没记录"伪装成"没问题"。
   */
  readonly evidenceMissing: boolean
  readonly action: HookFailureAction
  /** 已脱敏明细;resultNotRecorded 恒为 null(没有可出示的证据) */
  readonly attachment: HookFailureAttachment | null
}

const STATE_SET: ReadonlySet<string> = new Set<string>(HOOK_STATUS_STATES)

export function isHookStatusState(value: string): value is HookStatusState {
  return STATE_SET.has(value)
}

function assertNeverState(state: never): never {
  throw new Error(`未知 Hook 状态: ${String(state)}`)
}

/** 命令/stderr 出口统一脱敏;空值原样返回空串 */
function sanitizeField(value: string | null | undefined): string {
  const text = value ?? ''
  return text ? sanitizeEvidenceText(text) : ''
}

/**
 * 失败上下文 → 已脱敏 attachment(**唯一**出口;严禁调用方自行拼 stderr 原文)。
 * command/stderr 过 `sanitizeEvidenceText`(strip_ansi → 凭据/URL/邮箱/IP/路径),
 * 与 D94 交接单同一条脱敏链路。
 */
export function buildHookFailureAttachment(ctx: HookFailureContext): HookFailureAttachment {
  return {
    hookName: ctx.hookName ?? '',
    hookEvent: ctx.hookEvent ?? '',
    command: sanitizeField(ctx.command),
    stderr: sanitizeField(ctx.stderr),
    exitCode: typeof ctx.exitCode === 'number' ? ctx.exitCode : null,
    durationMs: typeof ctx.durationMs === 'number' ? ctx.durationMs : null,
  }
}

/**
 * 六态 → 视图判据的**唯一**派发点。
 *
 * switch 穷尽六态、**无 default**:漏改任一态 ⇒ `state` 无法收窄为 `never`,
 * `assertNeverState` 处编译失败(新增态必须同步补判据,否则构建拦截)。
 * `resultNotRecorded` 是显式 case(而非兜底):终态缺省必须独立判据,
 * `evidenceMissing=true` 强制渲染件显式宣告"未记录最终结果"。
 */
export function hookFailureView(
  state: HookStatusState,
  ctx: HookFailureContext | null,
): HookFailureView {
  switch (state) {
    case 'succeeded':
      return {
        state,
        tone: 'success',
        titleKey: 'state.succeeded',
        ariaKey: 'aria.succeeded',
        hintKey: null,
        terminal: true,
        showsEvidence: false,
        evidenceMissing: false,
        action: 'none',
        attachment: null,
      }
    case 'retryScheduled':
      // 重试中:非终态,必须说明"还会再来",否则用户以为已失败而重复操作
      return {
        state,
        tone: 'info',
        titleKey: 'state.retryScheduled',
        ariaKey: 'aria.retryScheduled',
        hintKey: 'hint.retryScheduled',
        terminal: false,
        showsEvidence: false,
        evidenceMissing: false,
        action: 'none',
        attachment: null,
      }
    case 'failed':
      return {
        state,
        tone: 'danger',
        titleKey: 'state.failed',
        ariaKey: 'aria.failed',
        hintKey: 'hint.failed',
        terminal: true,
        showsEvidence: true,
        evidenceMissing: false,
        action: 'retry',
        attachment: ctx ? buildHookFailureAttachment(ctx) : null,
      }
    case 'timedOut':
      return {
        state,
        tone: 'warning',
        titleKey: 'state.timedOut',
        ariaKey: 'aria.timedOut',
        hintKey: 'hint.timedOut',
        terminal: true,
        showsEvidence: true,
        evidenceMissing: false,
        action: 'retry',
        attachment: ctx ? buildHookFailureAttachment(ctx) : null,
      }
    case 'skipped':
      return {
        state,
        tone: 'neutral',
        titleKey: 'state.skipped',
        ariaKey: 'aria.skipped',
        hintKey: null,
        terminal: true,
        showsEvidence: false,
        evidenceMissing: false,
        action: 'none',
        attachment: null,
      }
    case 'resultNotRecorded':
      // 终态缺省:**没有可出示的证据本身就是必须呈现的事实**。
      // attachment 恒 null + evidenceMissing=true,渲染件必须画"未记录最终结果"
      // 的显式占位;静默留空 = 把"没记录"伪装成"没问题"。
      return {
        state,
        tone: 'warning',
        titleKey: 'state.resultNotRecorded',
        ariaKey: 'aria.resultNotRecorded',
        hintKey: 'hint.resultNotRecorded',
        terminal: true,
        showsEvidence: false,
        evidenceMissing: true,
        action: 'inspect',
        attachment: null,
      }
    default:
      return assertNeverState(state)
  }
}

// ---------- 键名生成器(渲染层/测试统一取键,禁止手写键串) ----------

/** 六态标题键(`ai.pane.hookFailures` 内) */
export function hookStatusTitleKey(state: HookStatusState): string {
  return `state.${state}`
}

/** 六态 aria-label 键(`ai.pane.hookFailures` 内) */
export function hookStatusAriaKey(state: HookStatusState): string {
  return `aria.${state}`
}

/** 六态补充说明键(`ai.pane.hookFailures` 内) */
export function hookStatusHintKey(state: HookStatusState): string {
  return `hint.${state}`
}

/** 明细字段标签键(`ai.pane.hookFailures` 内) */
export function hookFieldLabelKey(field: HookEvidenceField): string {
  return `field.${field}`
}

/** 卡片标题键(常量;五语言词包共用同一键) */
export const HOOK_FAILURE_CARD_TITLE_KEY = 'card.title' as const

/** 读屏整体 aria 键(常量) */
export const HOOK_FAILURE_CARD_ARIA_KEY = 'aria.card' as const
