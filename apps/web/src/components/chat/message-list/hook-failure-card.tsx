// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// G-87 Hook 失败可见性卡 —— 六态渲染件(契约 → 屏幕的唯一挂载点)
//
// **立因(本仓 §0.9「造好没装车」)**:`packages/shared/src/chat/hook-failures.ts`
// (2026-09-24 立)整套判定层交付时 14/14 导出**零消费** —— 连它自己的单测之外
// 全仓没有任何一处 import,于是 hook 执行失败在界面上完全不存在:用户的 hook 挂了
// 看不到,hook 静默丢失也看不到。本件就是那句"渲染位",把它挂进消息流。
//
// **数据面现状(2026-10-29 复核,判定层头注那句"SSE 通道无 / DLQ 消费出口无"仍成立)**:
//   · hook_engine 侧有落点:`_make_log` 执行日志、`_push_dlq` 死信、`hook.failed` 事件;
//   · SSE 通道**无**:`agent_events.AGENT_SUBSCRIBE_EVENTS` 十五事件里没有 hook 执行失败
//     (最接近的 `HOOK_ERROR` = `agent_loop_v2` 的 hook 总线 `error` 事件,映射到 SSE 的
//     `error` 帧,是 LLM 主线错误而非 hook 执行结果;且它带的是 `{error}` 而非
//     hookName/event/exitCode/stderr 六字段);
//   · DLQ 消费出口**无**:`list_dlq` / `reprocess_dlq` / `clear_dlq` 生产侧 0 调用方
//     (仅 hook_engine 自身与测试);
//   · web store **无** hook 失败字段(`stores/chat.ts` 无 `hookFailures` 一类键)。
// ⇒ 本件按"有值时渲染"交付:判据与卡片就位,渲染门为 `data.length > 0`;
//   无数据时整段返回 null(**不常驻空卡**)。缺的那一环 = ai-service 把 `hook.failed`
//   补进 SSE 白名单(+ 补 exitCode/command/durationMs 字段)+ api-client 转发 + store 落桶,
//   归属数据层与 ai-service,不在本目录射程内(详见交付报告)。
//
// **判定纪律**:六态语义/色档/标题键/证据位一律由 `hookFailureView` 决定,本件只做
// "语义 → 样式"这一处映射与 DOM 摆位,端内不另写第二套 hook 失败判定。
// `resultNotRecorded` 的 `evidenceMissing=true` 必须**显式宣告"未记录最终结果"**
// (渲染件见到它就画占位说明;静默留空 = 把"没记录"伪装成"没问题")。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Ban, CheckCircle2, Clock, Loader2, HelpCircle, Wrench } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  HOOK_FAILURE_ACTIONS,
  HOOK_FAILURE_CARD_ARIA_KEY,
  HOOK_FAILURE_CARD_TITLE_KEY,
  HOOK_EVIDENCE_FIELDS,
  hookFailureView,
  hookFieldLabelKey,
  isHookStatusState,
  type HookEvidenceField,
  type HookFailureAction,
  type HookFailureContext,
  type HookStatusState,
  type HookTone,
} from '@ihui/shared/chat/hook-failures'

/** 语义色档 → 容器样式(判定层只给语义,端内只做这一处样式映射) */
const TONE_BORDER: Record<HookTone, string> = {
  neutral: 'border-border bg-muted/30',
  info: 'border-sky-500/30 bg-sky-500/5',
  warning: 'border-amber-500/40 bg-amber-500/10',
  success: 'border-emerald-500/30 bg-emerald-500/5',
  danger: 'border-destructive/40 bg-destructive/5',
}

const TONE_TEXT: Record<HookTone, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-sky-600 dark:text-sky-500',
  warning: 'text-amber-600 dark:text-amber-500',
  success: 'text-emerald-600 dark:text-emerald-500',
  danger: 'text-destructive',
}

/** 六态图标(纯装饰;语义由 `data-hook-state` + 文案承担,不靠图标辨认) */
const STATE_ICON: Record<HookStatusState, typeof AlertTriangle> = {
  succeeded: CheckCircle2,
  retryScheduled: Loader2,
  failed: AlertTriangle,
  timedOut: Clock,
  skipped: Ban,
  resultNotRecorded: HelpCircle,
}

/**
 * 一条待渲染的 hook 失败记录:状态 + 引擎侧原始上下文。
 * 形状刻意与 `hookFailureView(state, ctx)` 的入参逐字段对齐 ——
 * 宿主只需把 SSE/日志拿到的原始帧填进来,脱敏由 shared 层出口统一做。
 */
export interface HookFailureRecord {
  /** 六态之一(取值即 `ai.pane.hookFailures.state.<key>` 的键片段) */
  state: HookStatusState
  /** 失败上下文(未脱敏原文;`buildHookFailureAttachment` 会统一过 sanitizeEvidenceText) */
  context?: HookFailureContext | null
  /** 记录稳定键(宿主给;缺失时退化为下标,仅用于 React key —— 不进任何判据) */
  id?: string
}

export interface HookFailureCardProps {
  /** hook 执行记录。空数组/缺省 ⇒ 整段不渲染(不得常驻空卡) */
  records?: readonly HookFailureRecord[] | null
  /** 动作回调。数据面在调用方,卡片只负责触发;不传则不渲染动作按钮 */
  onAction?: (action: HookFailureAction, record: HookFailureRecord) => void
  className?: string
}

/**
 * 消息 `meta.hookFailures` → 卡片记录(**纯函数,零 IO**)。
 *
 * **为什么读 `meta` 而不是新增 store 字段**:`ChatMessage.meta` 是既有的
 * `Record<string, unknown>` 旁路袋(与水合侧 `metadata.*` 逐字段对应),历史回放路径
 * 早已用它承载 fallback/retryNotice/queueItems 一类"这一轮发生过什么"的事实。
 * hook 失败天然是**某一轮某一条回答**的附属事实,归属这个袋子;新增会话级 store 桶
 * 反而要另配一条水合链,且跨轮会把上一轮的失败挂到这一轮头上。
 *
 * 判据纪律:
 *   · 形状不信任何一项 —— 非数组 ⇒ `[]`(整段不渲染);条目非对象 ⇒ 跳过;
 *   · `state` 必须过 shared 的 `isHookStatusState` 收窄,**认不出的状态一律丢弃**,
 *     不猜、不兜底成 `resultNotRecorded`(那是"未记录"这一格的真事实,不能被赝品占用);
 *   · 上下文只透传原始字段,脱敏由 `hookFailureView` → `buildHookFailureAttachment` 统一做,
 *     本函数**不得**先把 stderr/command 拼成任何文本。
 */
export function hookFailureRecordsFromMeta(meta: unknown): HookFailureRecord[] {
  if (!meta || typeof meta !== 'object') return []
  const raw = (meta as Record<string, unknown>).hookFailures
  if (!Array.isArray(raw)) return []

  const out: HookFailureRecord[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    const state = item.state
    if (typeof state !== 'string' || !isHookStatusState(state)) continue
    const ctx: HookFailureContext = {
      hookName: typeof item.hookName === 'string' ? item.hookName : null,
      hookEvent: typeof item.hookEvent === 'string' ? item.hookEvent : null,
      command: typeof item.command === 'string' ? item.command : null,
      stderr: typeof item.stderr === 'string' ? item.stderr : null,
      exitCode: typeof item.exitCode === 'number' ? item.exitCode : null,
      durationMs: typeof item.durationMs === 'number' ? item.durationMs : null,
      failedAt: typeof item.failedAt === 'string' ? item.failedAt : null,
    }
    out.push({
      state,
      context: ctx,
      id: typeof item.id === 'string' ? item.id : undefined,
    })
  }
  return out
}

/**
 * 证据字段取值:`attachment` 上同名字段(六字段与 `HookFailureAttachment` 逐一对应)。
 * 空串 / null 一律视为**该字段没有证据**,由渲染层跳过 —— 不渲染空标签。
 */
function evidenceText(
  attachment: NonNullable<ReturnType<typeof hookFailureView>['attachment']>,
  field: HookEvidenceField,
): string {
  const raw = attachment[field]
  if (field === 'exitCode' || field === 'durationMs') {
    return typeof raw === 'number' ? String(raw) : ''
  }
  return typeof raw === 'string' ? raw : ''
}

export function HookFailureCard({
  records,
  onAction,
  className,
}: HookFailureCardProps): React.JSX.Element | null {
  const t = useTranslations('ai.pane.hookFailures')
  // 渲染门:无数据 ⇒ 整段不出现(不是空卡、不是占位)。判定面在数据层,此处只判"有没有"。
  if (!records || records.length === 0) return null

  return (
    <div
      role="group"
      aria-label={t(HOOK_FAILURE_CARD_ARIA_KEY)}
      className={cn('flex w-full flex-col gap-1', className)}
      data-testid="hook-failure-card"
      data-hook-failure-count={records.length}
    >
      <span className="px-1 text-[11px] text-muted-foreground" data-hook-card-title>
        {t(HOOK_FAILURE_CARD_TITLE_KEY)}
      </span>
      {records.map((record, index) => (
        <HookFailureRow key={record.id ?? index} record={record} onAction={onAction} />
      ))}
    </div>
  )
}

function HookFailureRow({
  record,
  onAction,
}: {
  record: HookFailureRecord
  onAction?: (action: HookFailureAction, record: HookFailureRecord) => void
}): React.JSX.Element {
  const t = useTranslations('ai.pane.hookFailures')
  // 唯一派发点:六态语义/色档/标题键/动作位全部来自 shared(穷尽 switch 零 default)
  const view = hookFailureView(record.state, record.context ?? null)
  const Icon = STATE_ICON[view.state]

  // 只有卡片真正认识的动作才上屏(穷尽三型,新增动作漏接此处 ⇒ 编译期收窄失败)
  const knownAction: HookFailureAction | null = (() => {
    switch (view.action) {
      case 'none':
        return null
      case 'retry':
      case 'inspect':
        return HOOK_FAILURE_ACTIONS.includes(view.action) ? view.action : null
    }
  })()

  return (
    <div
      className={cn('flex flex-col gap-1 rounded-md border px-3 py-2', TONE_BORDER[view.tone])}
      data-testid="hook-failure-row"
      data-hook-state={view.state}
      data-hook-tone={view.tone}
      data-hook-terminal={view.terminal ? 'true' : 'false'}
      data-hook-evidence-missing={view.evidenceMissing ? 'true' : 'false'}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', TONE_TEXT[view.tone])} aria-hidden="true" />
        <span
          className={cn('text-xs font-medium', TONE_TEXT[view.tone])}
          data-testid="hook-failure-state"
          data-hook-state-label={view.state}
        >
          {t(view.titleKey)}
        </span>
        {view.hintKey ? (
          <span className="text-[11px] text-muted-foreground/80" data-hook-hint>
            {t(view.hintKey)}
          </span>
        ) : null}
        <span className="sr-only" data-hook-aria>
          {t(view.ariaKey)}
        </span>
      </div>

      {/* `resultNotRecorded`:证据缺失本身就是必须呈现的事实 —— 显式宣告"未记录",
          绝不静默留空(静默留空 = 把"没记录"伪装成"没问题")。
          "未记录"这件事由 `state.resultNotRecorded` 标题宣告,本行只补**后果**
          (无法确认成败、不要当作已通过)—— 不重复标题与 hint 已说过的话。 */}
      {view.evidenceMissing ? (
        <p
          className="text-[11px] leading-relaxed text-muted-foreground"
          data-testid="hook-failure-evidence-missing"
          data-hook-evidence-missing-note
        >
          {t('evidenceMissing')}
        </p>
      ) : null}

      {view.showsEvidence && view.attachment ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
          {HOOK_EVIDENCE_FIELDS.map((field) => {
            const value = evidenceText(view.attachment!, field)
            if (!value) return null
            return (
              <React.Fragment key={field}>
                <dt className="text-muted-foreground" data-hook-field-label={field}>
                  {t(hookFieldLabelKey(field))}
                </dt>
                <dd
                  className="break-all font-mono text-foreground/80"
                  data-hook-field-value={field}
                >
                  {value}
                </dd>
              </React.Fragment>
            )
          })}
        </dl>
      ) : null}

      {knownAction && onAction ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAction(knownAction, record)}
            data-testid="hook-failure-action"
            data-hook-action={knownAction}
            className="inline-flex items-center gap-1 rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Wrench className="h-3 w-3" aria-hidden="true" />
            <span>{t(`action.${knownAction}`)}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default HookFailureCard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
