// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D176 任务回顾与「移交到新任务」(2026-09-30 立,对标竞品 chatSession.highlights.recap.*)。
//
// **可达性取证结论(先取证再写 UI,出处逐字落在下面那个常量上)**:
// 竞品这条链的第一步是"模型生成一份临时交接文档",我方现有链路里**没有这一步的出口**:
//  ① `apps/ai-service` 无回顾/交接生成端点 —— 只有内部提示词组装
//     `app/core/context_fragments.py:83 build_recap_prompt()` / `:101 parse_recap_response()`,
//     唯一消费者是 `app/services/agent_loop_v2.py:5686 _inject_context_fragments()`:它把 recap
//     当作 `role="developer"` 片段塞进本轮 messages 给模型自己补课,产物**不返回给调用方**,
//     且整条通道默认关(`agent_loop_v2.py:1460 _context_fragments_enabled_from_env()` 读
//     `AGENT_CONTEXT_FRAGMENTS_ENABLED`,默认 "false");`app/routers/` 全族无 recap/handoff 路由。
//  ② `apps/api` 无转发路由 —— `grep -rni "recap" apps/api/src` 仅命中 RECAPTCHA 配置项;
//     `routes/workspace.ts` 只有项目文件 CRUD(`GET/POST /projects/:id/files`),
//     没有"生成交接文档并落盘"这个动作。
//  ③ `packages/api-client` 无出口 —— `grep -rni "recap|handoff" packages/api-client/src` 零命中。
//     既有 `endpoints/chat.ts:134 createConversation()` 只解决"创建一个新任务",
//     它需要的**交接内容**仍然没有来源,所以"从交接文档创建新任务"这半条链同样不可达。
//  ④ 附加:`revealFile`(显示文件)需要桌面壳"在文件位置显示"出口,web 端
//     `grep -rn "showItemInFolder|revealPath|openPath" apps/web/src` 零命中。
//
// 因此本组件**不造任何"生成"动作**:回顾入口、交接表单(标题/说明/交接目的)在位,
// 生成结果位如实报"依赖的生成出口不存在",三个下游动作(显示文件/创建新任务)一律 disabled
// 并给出禁因 —— 禁而不藏,读屏与视觉拿到的是同一条理由,而不是一个点了没反应的按钮。
// 后端补上生成出口(建议:`apps/ai-service` 一个 `POST /api/agent/recap/handoff`
// 入 conversation_id + purpose,出交接文档正文与落盘路径 → `apps/api` 转发 →
// `@ihui/api-client` 同名出口)后,把下面那个常量翻真并接上提交回调即可,届时
// `recap.waitingPreview` / `recap.phase.*` / `recap.creating` / `recap.createFailed`
// 才有真实触发点(现在不渲染它们 = 不拿兜底文案冒充能力在线)。

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

/**
 * 交接内容生成出口是否可达(2026-09-30 取证:不可达,依据见文件头 ①②③④)。
 * 这是**状态登记**而不是待接的开关:翻真必须与后端端点/转发/客户端出口同批落地,
 * 并由 `d176-task-recap.test.tsx` 把"禁态报禁因"这条判据钉住。
 */
const RECAP_HANDOFF_GENERATION_AVAILABLE = false

/** 两级视图:回顾入口清单 → 交接表单(竞品同一入口的两位:recap.title → handoff.title) */
type RecapView = 'recap' | 'handoff'

export function TaskRecapEntry() {
  const tc = useTranslations('aiChat')
  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<RecapView>('recap')

  const close = React.useCallback(() => {
    setOpen(false)
    setView('recap')
  }, [])

  const unavailable = !RECAP_HANDOFF_GENERATION_AVAILABLE

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
                  disabled={unavailable}
                  aria-disabled={unavailable || undefined}
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

              <div className="flex items-center gap-2 pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="recap-reveal-file"
                  disabled={unavailable}
                  aria-disabled={unavailable || undefined}
                >
                  {tc('recap.revealFile')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  data-testid="recap-create-session"
                  disabled={unavailable}
                  aria-disabled={unavailable || undefined}
                >
                  {tc('recap.createSession')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  data-testid="recap-back-to-list"
                  onClick={() => setView('recap')}
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
