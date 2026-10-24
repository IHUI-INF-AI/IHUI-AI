// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D77 对话流业务表单的**渲染宿主**(2026-09-25 立,G-106)—— 消息流内一张卡对应一条 form_request。
//
// 装车链(缺一即"造好没装车"):
//   ai-service form_request 帧
//     → @ihui/api-client `onFormRequest`(packages/api-client/src/client.ts tryParseFormRequest)
//     → apps/web send-message.ts 写 useBusinessFormStore
//     → **本组件**在 MessageList 每条消息的 MessageItem 之后渲染 BusinessFormCard
//     → 用户批准/拒绝 → buildFormResponseEvent() → postFormResponse() 上行 form_response
//
// 数据面纪律(同判定层):本组件不取数、不写库,只把用户应答回传给发起帧的会话通道
// (与 tool-delegate → postToolResult 同一条 ai-service 会话通道)。
// 拒绝理由输入框放在卡片**外侧**是有意的:卡片(apps/web/src/components/ai/business-form-card.tsx)
// 的判定层与状态机属既有资产,本票不改它的 props 形态;理由只在 host 的应答组装处参与。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { buildFormResponseEvent, fetchAiServiceJson, postFormResponse } from '@ihui/api-client'
import { Input, Label } from '@ihui/ui-react'

import { BusinessFormCard } from '@/components/ai/business-form-card'
import {
  useBusinessFormStore,
  type BusinessFormEntry,
  type FormResponseStatus,
} from '@/stores/business-forms'

/** 拒绝理由输入的最大长度(与 steer 文本同量级;后端落库另有权威上限) */
const REJECT_REASON_MAX = 200

/** 读口单条回显的判别联合里我们只消费这三格(ok/action/error;其余 valueFields 等留作诊断) */
interface FormResponseReadAck {
  ok?: unknown
  action?: unknown
  error?: unknown
}

/**
 * D77 收口格(2026-10-23):经 GET 读口拉取一条应答的持久裁决态,写回 store。
 *
 * 通道:`fetchAiServiceJson('/llm/complete/stream/{sid}/form-response')` —— normalizeUrl
 * 补 `/api` 前缀后命中 next rewrites 的 `/api/llm/:path*` 通配(与 POST 同一条 ai-service
 * 会话通道),Bearer 由 fetchAiServiceJson 自动注入(读口鉴权只认令牌主体)。
 *
 * **fail-soft 是判据不是偷懒**:读不到/形状不对/网络炸 ⇒ 一个字都不改判,卡片保持现状
 * (可填或本地乐观终态)。把"查不到"渲染成"被拒绝",或让一次失败炸穿整条会话流,
 * 都比"暂时不知道"更糟。HTTP 200 + {ok:false}(没这条/不是你的/库不可达同形)判为
 * pending —— 它至少证明通道活着,这一条确实还没有裁决。
 */
async function reconcileFormResponseState(
  sessionId: string,
  requestId: string,
  apply: (requestId: string, state: FormResponseStatus) => void,
): Promise<void> {
  try {
    const res = await fetchAiServiceJson<FormResponseReadAck>(
      `/llm/complete/stream/${sessionId}/form-response`,
      { params: { request_id: requestId } },
    )
    const data = res.success ? res.data : undefined
    if (!data || typeof data !== 'object') return
    if (data.ok === true && (data.action === 'approve' || data.action === 'reject')) {
      apply(requestId, data.action === 'approve' ? 'approved' : 'rejected')
    } else if (data.ok === false && typeof data.error === 'string') {
      apply(requestId, 'pending')
    }
  } catch {
    // 读口失败:保持现状,会话流不受任何影响
  }
}

async function submitFormResponse(
  entry: BusinessFormEntry,
  action: 'approve' | 'reject',
  values: Record<string, string | readonly string[]> | null,
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const event = buildFormResponseEvent({
    requestId: entry.requestId,
    kind: entry.kind,
    action,
    ...(values ? { values } : {}),
    ...(reason ? { reason } : {}),
    messageId: entry.messageId,
  })
  if (!entry.sessionId) {
    // 没有会话通道就没有回传落点 —— 如实失败,绝不"本地当成已批准"(那是把用户应答丢掉)
    return { ok: false, message: 'form-response-no-session-channel' }
  }
  try {
    await postFormResponse(entry.sessionId, event)
    return { ok: true }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

export interface BusinessFormSectionProps {
  /** 本段服务的 assistant 消息 ID(form_request.messageId 同源) */
  messageId: string
  className?: string
}

/**
 * 消息流内的业务表单段。无请求时**整段不渲染**(不占位、不给空框)。
 */
export function BusinessFormSection({ messageId, className }: BusinessFormSectionProps) {
  // 复用既有键:ai.pane.inputNotices.queue.reasonTitle = 「原因」(五语齐;缺键登记见交付报告)
  const t = useTranslations('ai.pane')
  const tForm = useTranslations('ai.pane.businessForms')
  const entries = useBusinessFormStore((s) => s.byMessage[messageId])
  const markFormResponse = useBusinessFormStore((s) => s.markFormResponse)
  const setFormResponseState = useBusinessFormStore((s) => s.setFormResponseState)
  const [reason, setReason] = React.useState('')

  // 挂载对账:刷新/重进会话后,store 里的待决表单(断线重连回放的那批)各自向读口
  // 问一次"这张答过没有"。每个 requestId 每次挂载只问一次(reconciledRef 去重),
  // 已有终态的不再问。无 sessionId 的条目没有读口落点,跳过(与 POST 侧同判据)。
  const reconciledRef = React.useRef<Set<string>>(new Set())
  React.useEffect(() => {
    if (!entries) return
    for (const entry of entries) {
      if (!entry.sessionId) continue
      if (entry.responseState === 'approved' || entry.responseState === 'rejected') continue
      if (reconciledRef.current.has(entry.requestId)) continue
      reconciledRef.current.add(entry.requestId)
      void reconcileFormResponseState(entry.sessionId, entry.requestId, setFormResponseState)
    }
  }, [entries, setFormResponseState])

  if (!entries || entries.length === 0) return null

  return (
    <div className={className} data-testid="business-form-section" data-message-id={messageId}>
      {entries.map((entry) => (
        <div
          key={entry.requestId}
          className="flex flex-col gap-1 py-1"
          data-form-request={entry.requestId}
        >
          <BusinessFormCard
            kind={entry.kind}
            mode={entry.mode}
            requestId={entry.requestId}
            responseState={entry.responseState}
            onAction={(payload) => {
              const action = payload.action === 'approve' ? 'approve' : 'reject'
              const reasonForReject = action === 'reject' ? reason.trim() : ''
              void submitFormResponse(
                entry,
                action,
                payload.values ? { ...payload.values } : null,
                reasonForReject,
              ).then((res) => {
                markFormResponse(
                  entry.requestId,
                  res.ok ? 'sent' : 'failed',
                  res.ok ? undefined : res.message,
                )
                // 提交成功后向读口回拉一次,把"库里真存了这条裁决"渲染成持久终态
                // (fail-soft:这一拉失败不影响本地乐观终态,也不影响会话流)。
                if (res.ok && entry.sessionId) {
                  void reconcileFormResponseState(
                    entry.sessionId,
                    entry.requestId,
                    setFormResponseState,
                  )
                }
              })
            }}
          />
          {entry.status === 'failed' ? (
            <span className="text-[11px] text-destructive" data-form-send-failed={entry.requestId}>
              {tForm('status.failed')}
            </span>
          ) : null}
          {/* 拒绝理由:只在仍有待应答请求时给出输入位(终态后不再收集) */}
          {entry.status === 'pending' ? (
            <div className="flex flex-col gap-1" data-form-reject-reason-field={entry.requestId}>
              <Label
                className="text-xs text-muted-foreground"
                htmlFor={`reject-reason-${entry.requestId}`}
              >
                {t('inputNotices.queue.reasonTitle')}
              </Label>
              <Input
                id={`reject-reason-${entry.requestId}`}
                className="h-8 text-xs"
                maxLength={REJECT_REASON_MAX}
                value={reason}
                data-testid="business-form-reject-reason"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
