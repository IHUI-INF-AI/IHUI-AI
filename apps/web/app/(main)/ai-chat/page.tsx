// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * /ai-chat 路由 — 独立 AI 对话工作台
 *
 * 与 /chat 路由的差异:
 * - /chat 是全局 AISidePanel 的快捷入口,复用 /home 工作区首页
 * - /ai-chat 提供全屏独立对话界面,左侧会话列表 + 右侧对话区 + 输入区
 * - 支持多会话并行:通过 useChatStore.conversationId 驱动,
 *   支持 ?conversationId=xxx 深链跳转
 * - 集成 useChat hook 实现流式对话 + 工具调用 + 上下文管理
 * - 使用 @ihui/ui-react 组件库
 */
import * as React from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare,
  Sparkles,
  Plus,
  Trash2,
  Loader2,
  Bot,
  Wrench,
  GitBranch,
} from 'lucide-react'

import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useMounted } from '@/hooks/use-mounted'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChat } from '@/hooks/use-chat'
import { MessageList } from '@/components/chat/message-list'
import { MessageInput } from '@/components/chat/message-input'
import { CompactionStatusBar } from '@/components/chat/compaction-status-bar'
import {
  createConversation,
  listConversations,
  getConversation,
  getMessages,
  deleteConversation,
} from '@ihui/api-client'
import { Button, Badge, Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import PageContainer from '@/components/common/PageContainer'

// ─── 深链同步 ───────────────────────────────────────────────────────────

/**
 * 多会话并行(2026-08-30 立):/ai-chat?conversationId=xxx 深链跳转。
 * AI 面板是全局 docked 组件,由 useChatStore.conversationId 驱动 —— 设置 store 即触发
 * 全局 AISidePanel 的 loadHistory effect 加载对应会话;多浏览器 Tab 天然并行互不阻塞。
 * useSearchParams 需 <Suspense> 边界(output:'export' 模式),由 AiChatPage 包裹。
 */
function AiChatConversationSync() {
  const searchParams = useSearchParams()
  React.useEffect(() => {
    const convId = searchParams.get('conversationId')
    if (!convId) return
    // 已在该会话则跳过,避免冗余重载
    if (useChatStore.getState().conversationId === convId) return
    useChatStore.getState().setConversationId(convId)
    useAiPanelStore.getState().openPanel()
  }, [searchParams])
  return null
}

// ─── 会话列表面板 ─────────────────────────────────────────────────────────

interface ConversationListProps {
  onSelect: (id: string) => void
  activeId: string | null
}

function ConversationListPanel({ onSelect, activeId }: ConversationListProps) {
  const t = useTranslations('chat')
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [newTitle, setNewTitle] = React.useState('')
  const [showNew, setShowNew] = React.useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['chat', 'conversations', search],
    queryFn: () => listConversations({ page: 1, pageSize: 50, search: search || undefined }),
    select: (res) =>
      res.success ? res.data : { conversations: [], total: 0, page: 1, pageSize: 50 },
    staleTime: 30_000,
  })

  const conversations = data?.conversations ?? []

  const createMutation = useMutation({
    mutationFn: () => createConversation({ title: newTitle.trim() || undefined }),
    onSuccess: (res) => {
      if (res.success && res.data?.conversation) {
        const id = res.data.conversation.id
        setNewTitle('')
        setShowNew(false)
        queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
        onSelect(id)
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      // 删除的是当前会话时,清空 store
      if (activeId) {
        useChatStore.getState().setConversationId(null)
        useChatStore.getState().clearMessages()
      }
    },
  })

  return (
    <div className="flex h-full flex-col">
      {/* 搜索 + 新建 */}
      <div className="flex items-center gap-2 border-b p-3">
        <div className="relative flex-1">
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder={t('searchConversations') ?? '搜索会话…'}
            className="h-8 text-sm"
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={() => setShowNew((prev) => !prev)}
          aria-label="新建会话"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* 新建会话表单 */}
      {showNew && (
        <div className="border-b p-3">
          <div className="flex items-center gap-2">
            <Input
              value={newTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
              placeholder={t('newConversationTitle') ?? '会话标题(可选)'}
              className="h-8 flex-1 text-sm"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter') createMutation.mutate()
              }}
            />
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">{t('create') ?? '创建'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-xs text-muted-foreground">{t('loadFailed') ?? '加载失败'}</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {t('noConversations') ?? '暂无会话,点击 + 新建'}
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30',
                    activeId === conv.id && 'bg-muted/50',
                  )}
                  onClick={() => onSelect(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(conv.id)
                    }
                  }}
                >
                  <Bot
                    className={cn(
                      'h-4 w-4 shrink-0',
                      activeId === conv.id ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {conv.title || (t('untitled') ?? '新会话')}
                      </span>
                      {/* W17(2026-09-14):分支来源标注 —— metadata.originalConversationId 存在即分叉会话 */}
                      {typeof conv.metadata === 'object' &&
                        conv.metadata !== null &&
                        'originalConversationId' in conv.metadata && (
                          <Tooltip content={t('branchSourceTooltip')}>
                            <span
                              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-primary/10 px-1 py-0.5 text-[10px] leading-none text-primary"
                              data-testid={`conversation-branch-badge-${conv.id}`}
                            >
                              <GitBranch className="h-2.5 w-2.5" />
                              {t('branchBadge')}
                            </span>
                          </Tooltip>
                        )}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      {conv.model && <span className="truncate">{conv.model}</span>}
                      {conv.lastMessageAt && (
                        <span className="shrink-0 whitespace-nowrap tabular-nums">
                          {new Date(conv.lastMessageAt).toLocaleDateString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  {/* 删除按钮(悬停显示) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteMutation.mutate(conv.id)
                    }}
                    disabled={deleteMutation.isPending}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    aria-label="删除会话"
                  >
                    {deleteMutation.isPending && deleteMutation.variables === conv.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── 主页面 ──────────────────────────────────────────────────────────────

export default function AiChatPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const openLogin = useLoginDialogStore((s) => s.open)
  const mounted = useMounted()
  const t = useTranslations('chat')
  const tc = useTranslations('common')

  // useChat hook:流式对话 + 工具调用 + 上下文管理
  const {
    messages,
    currentModel,
    isStreaming,
    fallbackNotice,
    sendMessage,
    stop,
    clearMessages,
    setModel,
    clearFallbackNotice,
    applyDiff,
    rejectDiff,
    applyAllDiffs,
    rejectAllDiffs,
  } = useChat()

  const conversationId = useChatStore((s) => s.conversationId)
  const setConversationId = useChatStore((s) => s.setConversationId)

  // 会话详情
  const { data: convDetail } = useQuery({
    queryKey: ['chat', 'conversation', conversationId],
    queryFn: () => (conversationId ? getConversation(conversationId) : Promise.resolve(null)),
    enabled: !!conversationId,
  })
  const conversationTitle =
    convDetail?.success && convDetail.data?.conversation ? convDetail.data.conversation.title : null

  // 加载会话历史消息
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () =>
      conversationId ? getMessages(conversationId, { pageSize: 100 }) : Promise.resolve(null),
    enabled: !!conversationId,
  })

  // 会话切换时加载历史消息到 store
  React.useEffect(() => {
    if (!historyData?.success || !historyData.data?.messages) return
    if (
      !useChatStore.getState().conversationId ||
      useChatStore.getState().conversationId !== conversationId
    ) {
      return
    }
    // D24(2026-09-19 立):恢复映射补 toolCalls/terminalTasks(metadata 持久化数组,
    // ai-service 回调 → worker 落库),切会话/刷新后工具卡与终端区完整还原;
    // model 一并从 metadata 恢复(回调写入的生成模型,不再写死空串)。
    const msgs: ChatMessage[] = historyData.data.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: new Date(m.createdAt).getTime(),
      model: (m.metadata?.model as string | null | undefined) ?? '',
      reasoning: m.reasoning,
      toolCalls: (m.metadata?.toolCalls ?? undefined) as ChatMessage['toolCalls'],
      terminalTasks: (m.metadata?.terminalTasks ?? undefined) as ChatMessage['terminalTasks'],
    }))
    useChatStore.getState().setMessages(msgs)
    // 恢复会话的 model
    if (historyData.data.messages.length > 0) {
      // 从消息中推断 model
    }
  }, [historyData, conversationId])

  // SubAgent 活动
  const subAgentActivities = useChatStore((s) => s.subAgentActivities)

  // 新建会话
  const handleNewConversation = React.useCallback(() => {
    setConversationId(null)
    clearMessages()
  }, [setConversationId, clearMessages])

  // 选中会话
  const handleSelectConversation = React.useCallback(
    (id: string) => {
      if (id === conversationId) return
      setConversationId(id)
    },
    [conversationId, setConversationId],
  )

  // 发送消息
  const handleSend = React.useCallback((content: string) => sendMessage(content), [sendMessage])

  // hydration-safe:挂载前显示极简占位,避免 SSR/CSR 不一致
  if (!mounted) {
    return <div className="px-4 flex h-[calc(100vh-58px)] items-center justify-center" />
  }

  // 未登录:显示友好引导(替代营销首页,避免被弹窗挡的内容混乱)
  if (!isAuthenticated) {
    return (
      <div className="flex h-[calc(100vh-58px)] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquare className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            {t('loginRequiredTitle') || '登录后开始 AI 对话'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t('loginRequiredDesc') ||
              '登录后即可与 AI 智能体对话,支持多模型切换、附件上传、深度思考等功能'}
          </p>
          <Button type="button" onClick={() => openLogin('login')} className="mt-6 gap-1.5">
            <Sparkles className="h-4 w-4" />
            <span>{tc('login')}</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PageContainer padded={false} className="flex h-[calc(100vh-58px)]">
      {/* 左侧:会话列表 */}
      <aside className="hidden w-72 shrink-0 border-r md:block">
        <ConversationListPanel onSelect={handleSelectConversation} activeId={conversationId} />
      </aside>

      {/* 右侧:对话区 */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Button variant="ghost" size="sm" onClick={handleNewConversation}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('newConversation') ?? '新建会话'}
          </Button>
          {conversationTitle && (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Bot className="h-4 w-4 shrink-0 text-primary" />
              <h1 className="min-w-0 truncate text-sm font-medium">{conversationTitle}</h1>
              {currentModel && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {currentModel}
                </Badge>
              )}
            </div>
          )}
          {/* 压缩状态 */}
          <CompactionStatusBar />
          {/* 工具调用活动 */}
          {subAgentActivities.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {subAgentActivities.length} 个活动
              </span>
            </div>
          )}
        </div>

        {/* 消息区 */}
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={null}>
            <AiChatConversationSync />
          </Suspense>
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            isLoading={historyLoading}
            emptyTitle={t('emptyTitle') ?? '开始一段对话'}
            emptyHint={t('emptyHint') ?? '输入消息,或者从会话列表选择一个历史会话'}
            assistantLabel={t('assistantLabel') ?? 'AI 助手'}
            onApplyDiff={applyDiff}
            onRejectDiff={rejectDiff}
            onApplyAllDiffs={applyAllDiffs}
            onRejectAllDiffs={rejectAllDiffs}
            fallbackNotice={fallbackNotice}
            onClearFallbackNotice={clearFallbackNotice}
            subAgentActivities={subAgentActivities}
          />
        </div>

        {/* 输入区 */}
        <div className="shrink-0 border-t">
          <MessageInput
            onSend={handleSend}
            onStop={stop}
            isStreaming={isStreaming}
            placeholder={t('inputPlaceholder') ?? '输入消息,使用 / 唤起斜杠命令,@ 提及文件'}
            sendLabel={t('send') ?? '发送'}
            stopLabel={t('stop') ?? '停止'}
            model={currentModel}
            onModelChange={setModel}
            modelLabel={t('model') ?? '模型'}
          />
        </div>
      </main>
    </PageContainer>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
