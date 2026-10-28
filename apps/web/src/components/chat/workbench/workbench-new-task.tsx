// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 工作台"新任务"pane(2026-10-28 片2 直发;片D 升级欢迎面)。
 *
 * 与内核的关系一句话:**壳只切"看什么",不写"怎么发"** ——
 * - 空窗格(还没发出第一条)⇒ WorkbenchWelcome(快捷指令卡 + 模板 chips,点击=回填本窗格草稿);
 * - 消息一出现 ⇒ 内核 MessageList(与 ChatPaneBody 同一件),真实流式渲染零复制;
 * - sendMessage/stop/setModel 全部来自 useChat() —— 与 ChatPaneBody 同一内核出口;
 *   useChat 经 ChatPaneProvider(壳挂的 WORKBENCH_PANE_ID)读**同一 pane store**:
 *   首发 → createConversation → 发送链 URL 同步(chatDeeplinkPath 钉)落
 *   /chat/workbench?conversationId=新id → 壳换成 ChatPaneBody 重挂同一 store,
 *   store 里 conversationId 已就位 ⇒ switching=false ⇒ 半截流原样续接(票60 LRU 口径);
 * - 清台(resetSeq>0)先 stop 再清:abort 域按 store 实例隔离,不掐在途流直接清
 *   messages 会被仍在写入的流把半截助手消息"复活"回新台。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'

import { MessageInput } from '@/components/chat/message-input'
import { MessageList } from '@/components/chat/message-list/MessageList'
import { WorkbenchWelcome } from '@/components/chat/workbench/workbench-welcome'
import { useChat } from '@/hooks/use-chat'
import { usePaneChatStore } from '@/stores/chat-pane-context'

export interface WorkbenchNewTaskProps {
  /** 清台信号:壳每次点"新会话"+1;0 = 首挂载不清 */
  resetSeq: number
}

export function WorkbenchNewTask({ resetSeq }: WorkbenchNewTaskProps) {
  const t = useTranslations('chat')
  const chatStore = usePaneChatStore()
  const { messages, isStreaming, currentModel, sendMessage, stop, setModel } = useChat()

  React.useEffect(() => {
    if (resetSeq <= 0) return
    // 清台先掐在途流(见头注判据;仅跟 resetSeq 走时序,isStreaming/stop 读当刻快照)
    if (isStreaming) stop()
    chatStore.setState({ conversationId: null, messages: [], error: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 进 isStreaming/stop 依赖会让每次流式翻转都触发清台(语义错误)
  }, [resetSeq])

  const prefillDraft = React.useCallback(
    (text: string) => chatStore.setState({ draftInput: text }),
    [chatStore],
  )

  const showWelcome = messages.length === 0 && !isStreaming

  return (
    <div className="flex h-full min-h-0 w-full flex-col" data-workbench-new-task="">
      {showWelcome ? (
        <div className="min-h-0 flex-1" data-workbench-welcome="">
          <WorkbenchWelcome onPrefill={prefillDraft} />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            isLoading={false}
            emptyTitle={t('workbenchHeroTitle')}
            emptyHint={t('workbenchHeroHint')}
            assistantLabel={t('assistant')}
            loadingLabel={t('loading')}
            onTemplateSelect={prefillDraft}
          />
        </div>
      )}
      {/* 输入面即内核:首发建会话后由发送链把 URL 换成深链,壳无缝换装 ChatPaneBody */}
      <MessageInput
        onSend={sendMessage}
        onStop={stop}
        isStreaming={isStreaming}
        placeholder={t('placeholder')}
        sendLabel={t('send')}
        stopLabel={t('stop')}
        model={currentModel}
        onModelChange={setModel}
        modelLabel={t('model')}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
