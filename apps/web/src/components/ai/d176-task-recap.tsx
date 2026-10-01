// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D176 任务回顾与「移交到新任务」(2026-09-30 立,对标竞品 chatSession.highlights.recap.*)。
//
// **可达性演变**:本组件首版落地时生成出口不可达(取证见台账 d2e70d0af3 批注),UI 停在
// 如实禁用态;2026-09-30 用户拍板立项后,后端三段与本批同枚落地:
//  ① ai-service `POST /api/agent/recap/handoff`(app/routers/recap.py)——复用
//     context_fragments.build_recap_prompt/parse_recap_response,线程历史取 session_store.resume;
//  ② apps/api 转发 `POST /api/ai/chat/recap/handoff`(routes/user/ai-modules-routes.ts,aiServiceFetch);
//  ③ api-client `generateRecapHandoff()`(endpoints/chat.ts,index.ts 经 export * 自动导出)。
// `RECAP_HANDOFF_GENERATION_AVAILABLE` 据此翻真。
//
// 仍如实保留的禁用位:`revealFile` 需要桌面壳"在文件位置显示"出口(web 端没有),渲染但禁用;
// `waitingPreview` / `phase.finalizing` 两枚键刻意不消费——非流式生成没有对应真实相位,
// 不拿兜底文案冒充能力在线;`phase.finalizing` 等流式/落盘升级后再接。
// `createSession` 现接 createConversation(标题取交接摘要截断);**新任务自动携带交接正文**
// 已随残余②收口(2026-09-30):创建成功后经 chat store 待发草稿队列
// draftInput + draftAutoSend 注入,MessageInput 消费后作为新会话首条用户消息发出
// (通道与理由见 handleCreateSession 内注)。

'use client'

import * as React from 'react'
import { ScrollText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  IconButton,
  Input,
} from '@ihui/ui-react'
import { Tooltip, TooltipProvider } from '@/components/feedback'
import { createConversation, generateRecapHandoff } from '@ihui/api-client'
import { useChatStore } from '@/stores/chat'

/**
 * 交接内容生成出口可达(2026-09-30 拍板立项,后端三段与本批同枚落地,依据见文件头)。
 * 若未来出口再被摘除(端点/转发/客户端任一缺失),这里必须翻回 false 并恢复禁因态。
 */
const RECAP_HANDOFF_GENERATION_AVAILABLE = true

/** 两级视图:回顾入口清单 → 交接表单(竞品同一入口的两位:recap.title → handoff.title) */
type RecapView = 'recap' | 'handoff'

type GeneratePhase = 'idle' | 'generating' | 'done' | 'error'

export function TaskRecapEntry() {
  const tc = useTranslations('aiChat')
  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<RecapView>('recap')
  const [purpose, setPurpose] = React.useState('')
  const [phase, setPhase] = React.useState<GeneratePhase>('idle')
  const [summary, setSummary] = React.useState<string | null>(null)
  const [nextAction, setNextAction] = React.useState<string | null>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [createFailed, setCreateFailed] = React.useState(false)
  const conversationId = useChatStore((s) => s.conversationId)
  const setConversationId = useChatStore((s) => s.setConversationId)

  const close = React.useCallback(() => {
    setOpen(false)
    setView('recap')
  }, [])

  const resetResult = React.useCallback(() => {
    setPhase('idle')
    setSummary(null)
    setNextAction(null)
    setErrorMsg(null)
    setCreateFailed(false)
  }, [])

  const handleGenerate = React.useCallback(async () => {
    if (!conversationId) return
    setPhase('generating')
    setErrorMsg(null)
    try {
      const res = await generateRecapHandoff({
        threadId: conversationId,
        purpose: purpose.trim() || undefined,
      })
      if (!res.success) {
        setErrorMsg(res.error)
        setPhase('error')
        return
      }
      setSummary(res.data.summary)
      setNextAction(res.data.nextAction)
      setPhase('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setPhase('error')
    }
  }, [conversationId, purpose])

  const handleCreateSession = React.useCallback(async () => {
    if (!summary) return
    setCreating(true)
    setCreateFailed(false)
    try {
      const res = await createConversation({ title: summary.slice(0, 120) })
      if (!res.success) {
        setCreateFailed(true)
        return
      }
      setConversationId(res.data.conversation.id)
      // D176 残余②(2026-09-30 收口):交接正文作为新会话首条用户消息自动发出。
      // 通道:chat store 的待发草稿队列 draftInput + draftAutoSend —— MessageInput
      // 挂载态 effect 消费(draftInput 填入输入框,draftAutoSend 置位时直接 submit)。
      // 选既有通道的理由:程序化 sendMessage 出口(send-message.ts 的
      // sendMessageInstance 模块单例)不导出,且本票改动只准落本文件;goal-card /
      // next-steps-card / TypewriterHero 三个既有生产者走同一通道,是惯例而非新路径。
      // 顺序:先 setConversationId 再写草稿 —— MessageInput 的 effect 在下一帧才消费,
      // submit 内部 getState() 读到的已是新会话 id,交接正文必然落进新会话首条。
      // 创建失败时不写草稿:把交接正文误发进旧会话比不发更糟。
      const handoffParts = [`【任务交接】${summary}`]
      if (nextAction) handoffParts.push(`下一步:${nextAction}`)
      const trimmedPurpose = purpose.trim()
      if (trimmedPurpose) handoffParts.push(`交接目的:${trimmedPurpose}`)
      useChatStore.setState({ draftInput: handoffParts.join('\n'), draftAutoSend: true })
      close()
    } catch {
      setCreateFailed(true)
    } finally {
      setCreating(false)
    }
  }, [summary, nextAction, purpose, setConversationId, close])

  const unavailable = !RECAP_HANDOFF_GENERATION_AVAILABLE
  const generating = phase === 'generating'

  return (
    <>
      <TooltipProvider>
        <Tooltip content={tc('recap.title')}>
          <IconButton
            onClick={() => setOpen(true)}
            aria-label={tc('recap.title')}
            data-testid="ai-panel-recap-entry"
          >
            <ScrollText />
          </IconButton>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="recap-dialog-title">
              {view === 'handoff' ? tc('recap.handoff.title') : tc('recap.title')}
            </DialogTitle>
          </DialogHeader>
          {/* 恒挂载:Radix 要求 Content 内有描述位,取竞品的 previewDescription 原文 */}
          <DialogDescription>{tc('recap.previewDescription')}</DialogDescription>

          {view === 'recap' ? (
            <div className="flex flex-col gap-2 pt-1" data-testid="recap-menu">
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="recap-handoff-menu-item"
                onClick={() => setView('handoff')}
              >
                {tc('recap.handoff.menuItem')}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 pt-2">
                <label
                  className="text-xs font-medium text-foreground/80"
                  htmlFor="recap-purpose-input"
                >
                  {tc('recap.purposeLabel')}
                </label>
                <Input
                  id="recap-purpose-input"
                  data-testid="recap-purpose-input"
                  placeholder={tc('recap.purposePlaceholder')}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={unavailable || generating}
                  aria-disabled={unavailable || generating || undefined}
                />
              </div>

              {unavailable && (
                <p
                  className="rounded-md border bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground"
                  data-testid="recap-generation-unavailable"
                >
                  {tc('recap.handoffUnavailable')}
                </p>
              )}

              {generating && (
                <p
                  className="rounded-md border bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground"
                  data-testid="recap-phase-generating"
                  role="status"
                >
                  {tc('recap.phase.generating')}
                </p>
              )}

              {phase === 'done' && summary && (
                <div
                  className="flex flex-col gap-1.5 rounded-md border bg-muted/30 px-2.5 py-2"
                  data-testid="recap-preview"
                >
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {tc('recap.phase.done')}
                  </p>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                    {summary}
                  </p>
                  {nextAction && (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                      {nextAction}
                    </p>
                  )}
                </div>
              )}

              {phase === 'error' && (
                <p
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11px] leading-relaxed text-destructive"
                  data-testid="recap-generation-error"
                  role="alert"
                >
                  {errorMsg}
                </p>
              )}

              {createFailed && (
                <p
                  className="text-[11px] leading-relaxed text-destructive"
                  data-testid="recap-create-failed"
                  role="alert"
                >
                  {tc('recap.createFailed')}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-3">
                {phase !== 'done' && (
                  <Button
                    type="button"
                    size="sm"
                    data-testid="recap-generate-submit"
                    disabled={unavailable || generating || !conversationId}
                    aria-disabled={unavailable || generating || !conversationId || undefined}
                    onClick={() => void handleGenerate()}
                  >
                    {tc('recap.handoff.title')}
                  </Button>
                )}
                {phase === 'done' && (
                  <Button
                    type="button"
                    size="sm"
                    data-testid="recap-create-session"
                    disabled={creating}
                    aria-disabled={creating || undefined}
                    onClick={() => void handleCreateSession()}
                  >
                    {creating ? tc('recap.creating') : tc('recap.createSession')}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="recap-reveal-file"
                  disabled
                  aria-disabled
                  title={unavailable ? tc('recap.handoffUnavailable') : undefined}
                >
                  {tc('recap.revealFile')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  data-testid="recap-back-to-list"
                  onClick={() => {
                    resetResult()
                    setView('recap')
                  }}
                >
                  {tc('recap.title')}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default TaskRecapEntry
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
