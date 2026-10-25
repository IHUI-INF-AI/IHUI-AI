// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 纯抽取:从 ChatScreen 抽出单条消息气泡渲染(富文本锚点 D99 / 思考过程 / 引用交代 / 工具卡挂载点)。
// 零行为/视觉变更:renderMessage 主干逐字节搬运,仅把闭包变量改为 props(同名解构)。

import { type MutableRefObject, type ReactNode } from 'react'
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Copy,
  MessageSquare,
  Pin,
  PinOff,
  RefreshCw,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react-native'
import { tokens } from '../../theme/active-tokens'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'
import { VoiceBubble } from '../../components/VoiceBubble'
import { parseMessageContent } from '../../utils/message-parse'
import { thinkingTitleView } from '@ihui/shared/chat/element-pack'
import {
  applyAssistantExecutionFrame,
  applyPlanUpdate,
  applyToolCallEvent,
  applyToolDelta,
  subagentReplayRow,
  type AssistantExecutionFrame,
  type AssistantExecutionViz,
  type MessageCitation,
  type MessageInjection,
  type SteerNotice,
  type SubagentReplayItem,
} from '../../utils/chat-render-model'
import {
  CitationList,
  InjectionDisclosure,
  PermissionTierRow,
  SteerNoticeList,
} from '../../components/ChatDisclosure'
import { isErrorTurn, resendTargetText } from '@ihui/shared/chat'
import type { ChatMessage } from '@ihui/shared'
import type { ChatScreenMessage } from '@ihui/rn-app'
import { ToolCallCard } from './ToolCallCard'
import { SelectionAnnotationBar } from './SelectionAnnotationBar'
import { ActionAnchorChip, extractActionAnchors, type ActionAnchor } from './action-anchor'
import { type FloatBoxType } from '../../components/FloatBox'
import type { MessageRating } from '@ihui/api-client'

/**
 * D135(承 G-46):消息列表执行帧的唯一折叠出口。
 *
 * tool-call / tool-delta / plan-update 三族沿用各自 reducer(与
 * `applyAssistantExecutionFrame` 逐字等值,不是第二份折叠规则);terminal 两族委托同一 seam。
 * 主屏在 ChatScreen 里折、N8n 屏经本函数折 —— 两屏读到的都是同一 `AssistantExecutionViz`
 * 形状,宿主不再各自直名 reducer。
 */
export function foldMessageExecutionFrame(
  viz: AssistantExecutionViz | undefined,
  frame: AssistantExecutionFrame,
  nowMs: number = Date.now(),
): AssistantExecutionViz {
  switch (frame.kind) {
    case 'tool-call':
      return { ...viz, toolCalls: applyToolCallEvent(viz?.toolCalls, frame.event, nowMs) }
    case 'tool-delta':
      return { ...viz, toolCalls: applyToolDelta(viz?.toolCalls, frame.event) }
    case 'plan-update': {
      const reduced = applyPlanUpdate(frame.event)
      return {
        ...viz,
        planSteps: reduced.steps,
        // plan 为权威快照:载荷没给 explanation 就连旧值一并清掉,不沿用
        planExplanation: reduced.explanation,
      }
    }
    case 'terminal-start':
    case 'terminal-end':
      return applyAssistantExecutionFrame(viz, frame, nowMs)
  }
}

/**
 * 带推理过程(thinking)的 AI 消息(对齐 Uniapp ai_index2.vue thinking-process)。
 * ChatScreenMessage(@ihui/types)仅有 id/role/content,本地扩展 reasoning 字段,
 * 对齐 @ihui/shared ChatMessage.reasoning(chat_messages 表已有该字段)。
 * 抽离自 ChatScreen,供 ChatScreen 与下游(D99 富文本锚点)复用同一契约。
 */
export interface ChatScreenMessageWithReasoning extends ChatScreenMessage {
  reasoning?: string
  /** G-166 交代区:本轮引用来源 / 带了哪些上下文(与 @ihui/shared ChatMessage 同一形状) */
  citations?: MessageCitation[]
  injections?: MessageInjection[]
  /** D106 Steer(中途引导):本轮被用户注入的引导交代,对齐 web steerNoticesByMessageId。 */
  steerNotices?: SteerNotice[]
  /** D64⑤ 历史回放:metadata.elementPack 子代理帧归并后的最小回放视图(空/缺席不渲染) */
  elementPack?: SubagentReplayItem[]
}

const styles = StyleSheet.create({
  // ── 消息列表 ──
  msgRow: {
    marginVertical: rpx(20),
    flexDirection: 'row',
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowAi: {
    justifyContent: 'flex-start',
  },
  msgContent: {
    flexDirection: 'column',
  },
  msgActions: {
    flexDirection: 'row',
    gap: rpx(16),
    marginTop: rpx(8),
    paddingLeft: rpx(24),
  },
  msgActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  },
  msgActionText: {
    fontSize: rnType.label.size,
    color: tokens.text.secondary,
  },
  msgBubble: {
    maxWidth: '78%',
    paddingHorizontal: rpx(28),
    paddingVertical: rpx(20),
    borderRadius: rnRadius['2xl'],
  },
  msgBubbleUser: {
    backgroundColor: tokens.brand.cta,
  },
  msgBubbleAi: {
    backgroundColor: tokens.surface.card,
  },
  // 失败轮错误卡片(与 web D22 / miniapp 同形态:警示头 + 正文 + 重试出口)
  msgErrorCard: {
    width: '100%',
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.light,
    backgroundColor: tokens.error.bg,
    overflow: 'hidden',
  },
  msgErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: rnSpacing.md,
    paddingVertical: rnSpacing.sm,
    backgroundColor: tokens.danger.light,
  },
  msgErrorTitle: {
    fontSize: rnType.label.size,
    fontWeight: '500',
    color: tokens.error.text,
  },
  msgErrorBody: {
    paddingHorizontal: rnSpacing.md,
    paddingVertical: rnSpacing.sm,
    fontSize: rnType.body.size,
    lineHeight: 21,
    color: tokens.error.text,
  },
  msgErrorRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.xs,
    alignSelf: 'flex-start',
    marginHorizontal: rnSpacing.sm,
    marginBottom: rnSpacing.sm,
    paddingHorizontal: rnSpacing.sm,
    paddingVertical: rnSpacing.xs,
  },
  msgErrorRetryText: {
    fontSize: rnType.label.size,
    color: tokens.error.text,
  },
  msgText: {
    fontSize: rnType.strong.size,
    lineHeight: 20,
  },
  msgBubbleUserText: {
    color: tokens.brand.ctaForeground,
  },
  msgTextAi: {
    color: tokens.text.primary,
  },
  // ── 消息富内容:图片(点击全屏预览) ──
  msgImageWrap: {
    marginVertical: rnSpacing.xs,
    borderRadius: rnRadius.lg,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    maxWidth: 220,
  },
  msgImage: {
    width: 180,
    height: 140,
    backgroundColor: tokens.surface.muted,
  },
  // ── 消息富内容:代码块(展开/收起 + 复制,对齐 ai_index2 code-block) ──
  codeBlock: {
    marginVertical: 6,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.gray[800],
    overflow: 'hidden',
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: tokens.gray[700],
  },
  codeBlockLang: {
    fontSize: rnType.caption.size,
    color: tokens.gray['200'],
    fontWeight: '600',
    flexShrink: 1,
    marginRight: rnSpacing.sm,
  },
  codeBlockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.md,
  },
  codeBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.xs,
    paddingVertical: 2,
  },
  codeBlockBtnText: {
    fontSize: rnType.caption.size,
    color: tokens.gray['200'],
  },
  codeBlockContent: {
    padding: 10,
    fontSize: rnType.label.size,
    lineHeight: 17,
    color: tokens.gray['200'],
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  // ── 消息富内容:思考过程(推理 reasoning,对齐 ai_index2 thinking-process) ──
  thinkingBlock: {
    marginBottom: 6,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.muted,
    overflow: 'hidden',
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: rnSpacing.sm,
  },
  thinkingTitle: {
    fontSize: rnType.label.size,
    fontWeight: '600',
    color: tokens.text.secondary,
    flexShrink: 1,
  },
  thinkingToggle: {
    fontSize: rnType.caption.size,
    color: tokens.text.tertiary,
    marginLeft: rnSpacing.sm,
  },
  thinkingContent: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    fontSize: rnType.label.size,
    lineHeight: 17,
    color: tokens.text.secondary,
  },
  // ── D99 富文本动作锚点:文本段内「原文片段 + 芯片」的行内流容器 ──
  anchorParagraph: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  // ── D135 执行/交互帧最小可视态(子代理回放行,与 ToolCallCard 同族) ──
  execRows: {
    marginTop: rpx(8),
    gap: rpx(4),
  },
  execRowText: {
    fontSize: rpx(12),
    color: tokens.text.tertiary,
  },
})

interface ChatMessageItemProps {
  /** 当前消息(对齐 SharedChatScreen renderMessage 的 item) */
  item: ChatScreenMessage
  /** 全量消息(计算末条 / 失败轮重试目标) */
  messages: ChatMessage[]
  /** 是否流式中(决定「正在思考…」占位与操作行显隐) */
  isStreaming: boolean
  /** 已展开代码块 key 集合(msgId-partIndex) */
  expandedCodeBlocks: Set<string>
  setExpandedCodeBlocks: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  /** 已展开思考过程 msgId 集合 */
  expandedThinking: Set<string>
  setExpandedThinking: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  /** 本轮 assistant 消息的执行帧折叠快照(工具/终端任务可视态) */
  executionVizById: Record<string, AssistantExecutionViz>
  /** 分享成功后触发首次分享奖励检查 */
  maybeTriggerFirstShareReward: () => void | Promise<void>
  /** 非阻塞浮层提示出口 */
  showToast: (type: FloatBoxType, message: string) => void
  /** 长按消息(截图 + 分享) */
  onLongPressMessage: (msg: ChatScreenMessage) => void | Promise<void>
  /** 消息点赞 / 点踩 */
  rateMessage: (messageId: string, next: MessageRating) => Promise<void>
  /** 失败轮重试(重发最后一条用户提问) */
  retryLastTurn: () => void
  /** 钉选 / 收藏标记 */
  toggleMessageFlag: (item: ChatScreenMessage, kind: 'pinned' | 'bookmarked') => Promise<void>
  /** i18n 取词(零端内硬编码中文) */
  t: (key: string, params?: Record<string, string | number>) => string
  /**
   * 归属会话 id(批注复合键的一半)。可选 —— 未传时批注落到 `''::msgId` 命名空间,
   * 与"尚未关联后端对话的新会话"同形,既有调用方零改动仍能编译。
   */
  conversationId?: string | null
  /** 消息气泡原生节点 Map(长按截图用) */
  messageRefs: MutableRefObject<Map<string, View | null>>
  /** 图片全屏预览 url 设置 */
  setPreviewImageUrl: (url: string | null) => void
  /** D111 工作区权限档(null = 尚未取到 / 取数失败 → 整行隐藏) */
  workspaceTier: string | null
  /**
   * D99 富文本动作锚点出口:点击正文里的 `[[action:<type>:<label>|<payload>]]` 芯片时触发。
   * 可选 —— 未传时锚点降级为普通加粗文本(不挂点击语义),故既有调用方零改动仍然编译通过。
   * 宿主**必须**按 anchor.type 二次白名单校验后再执行(payload 为不透明字符串,可能来自模型输出)。
   */
  onActionAnchor?: (anchor: ActionAnchor) => void
}

/**
 * 单条消息气泡渲染(对齐 ChatScreen renderMessage 主干)。
 * 富文本锚点(D99)、思考过程、引用/注入/Steer 交代、子代理回放、权限档、工具卡(D113/D119)
 * 等后续票面在此组件内演进,不触碰 ChatScreen 主干。视觉与行为与原 renderMessage 逐字节一致。
 */
export function ChatMessageItem({
  item,
  messages,
  isStreaming,
  expandedCodeBlocks,
  setExpandedCodeBlocks,
  expandedThinking,
  setExpandedThinking,
  executionVizById,
  maybeTriggerFirstShareReward,
  showToast,
  onLongPressMessage: handleLongPressMessage,
  rateMessage,
  retryLastTurn,
  toggleMessageFlag,
  t,
  conversationId,
  messageRefs,
  setPreviewImageUrl,
  workspaceTier,
  onActionAnchor,
}: ChatMessageItemProps): ReactNode {
  const isUser = item.role === 'user'
  const isLastMessage = messages.length > 0 && item.id === messages[messages.length - 1]?.id
  const showActions = !isUser && item.content.trim() !== '' && !(isStreaming && isLastMessage)
  // 票64(2026-10-18 立):钉选/收藏抽成一份,AI 行与用户行共用 —— 标记语义与"谁能被点赞"
  // 不是一回事(web 端两枚按钮对 user+assistant 同渲染,这里对齐同一口径;分叉写两遍必然漂)。
  // 图标按服务端盖章的时刻切,文案与无障碍标签一律取词(§19 禁止端内新增硬编码中文)。
  const flagButtons: ReactNode = (
    <>
      <TouchableOpacity
        style={styles.msgActionBtn}
        hitSlop={8}
        onPress={() => void toggleMessageFlag(item, 'pinned')}
        accessibilityRole="button"
        accessibilityLabel={item.pinnedAt ? t('chat.unpin') : t('chat.pin')}
      >
        {item.pinnedAt ? (
          <PinOff size={16} color={tokens.text.primary} />
        ) : (
          <Pin size={16} color={tokens.text.secondary} />
        )}
        <Text style={styles.msgActionText}>{item.pinnedAt ? t('chat.unpin') : t('chat.pin')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.msgActionBtn}
        hitSlop={8}
        onPress={() => void toggleMessageFlag(item, 'bookmarked')}
        accessibilityRole="button"
        accessibilityLabel={item.bookmarkedAt ? t('chat.unbookmark') : t('chat.bookmark')}
      >
        {item.bookmarkedAt ? (
          <BookmarkCheck size={16} color={tokens.text.primary} />
        ) : (
          <Bookmark size={16} color={tokens.text.secondary} />
        )}
        <Text style={styles.msgActionText}>
          {item.bookmarkedAt ? t('chat.unbookmark') : t('chat.bookmark')}
        </Text>
      </TouchableOpacity>
    </>
  )
  // 失败轮:渲染错误卡片而非正文;重试只在"确实有一条可重发的用户提问"时给
  const isFailed = !isUser && isErrorTurn(item)
  const retryable = isFailed && resendTargetText(messages) !== null
  // 富内容分段(代码块/图片/文本,对齐 ai_index2 agent_content_list;消息内容不长,直接解析)
  const segments = parseMessageContent(item.content)
  // 思考过程(对齐 ai_index2 thinking-process:assistant 消息带 reasoning 时渲染折叠区块,
  // 默认收起只显示标题行;reasoning 由 toChatScreenMessage 映射透传)
  const reasoning = !isUser ? ((item as ChatScreenMessageWithReasoning).reasoning ?? '') : ''
  // D64③ 双态标题判据走共享真相源:有思考 → thinkingTitle;无思考但有引用 → thinkingRefsTitle
  const thinkingView = thinkingTitleView(
    reasoning.trim() !== '',
    (item as ChatScreenMessageWithReasoning).citations?.length ?? 0,
  )
  const thinkingKey = item.id
  const thinkingExpanded = expandedThinking.has(thinkingKey)
  return (
    <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}>
      <View style={styles.msgContent}>
        <Pressable
          ref={(el) => {
            if (el) messageRefs.current.set(item.id, el)
            else messageRefs.current.delete(item.id)
          }}
          onLongPress={() => void handleLongPressMessage(item)}
          delayLongPress={500}
          style={[styles.msgBubble, isUser ? styles.msgBubbleUser : styles.msgBubbleAi]}
        >
          {isFailed ? (
            // 失败轮:错误卡片(警示头 + 正文 + 重试出口),整块替换正文 —— 与 web D22 /
            // miniapp 同一形态,跨端一致:失败不产出内容,也不能看起来像一次正常回答。
            <View style={styles.msgErrorCard}>
              <View style={styles.msgErrorHeader}>
                <AlertTriangle size={14} color={tokens.error.text} />
                <Text style={styles.msgErrorTitle}>{t('chatAlert.errorTitle')}</Text>
              </View>
              <Text style={styles.msgErrorBody} selectable>
                {item.content}
              </Text>
              {retryable ? (
                <TouchableOpacity
                  style={styles.msgErrorRetry}
                  hitSlop={8}
                  onPress={retryLastTurn}
                  accessibilityRole="button"
                  accessibilityLabel={t('chatAlert.errorRetry')}
                >
                  <RefreshCw size={14} color={tokens.error.text} />
                  <Text style={styles.msgErrorRetryText}>{t('chatAlert.errorRetry')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : thinkingView ? (
            <View style={styles.thinkingBlock}>
              <Pressable
                style={styles.thinkingHeader}
                hitSlop={6}
                onPress={() =>
                  setExpandedThinking((prev) => {
                    const next = new Set(prev)
                    if (next.has(thinkingKey)) next.delete(thinkingKey)
                    else next.add(thinkingKey)
                    return next
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t('chat.msg.thinkingA11y')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs }}>
                  <MessageSquare size={12} color={tokens.text.secondary} />
                  <Text style={styles.thinkingTitle}>
                    {t(`ai.pane.${thinkingView.titleKey}`, thinkingView.values)}
                  </Text>
                </View>
                {reasoning.trim() !== '' ? (
                  <Text style={styles.thinkingToggle}>
                    {thinkingExpanded ? t('chat.msg.collapse') : t('chat.msg.expand')}
                  </Text>
                ) : null}
              </Pressable>
              {thinkingExpanded && reasoning.trim() !== '' ? (
                <Text style={styles.thinkingContent} selectable>
                  {reasoning}
                </Text>
              ) : null}
            </View>
          ) : null}
          {!isFailed &&
            segments.map((seg, segIndex) => {
              if (seg.type === 'audio') {
                // 2026-10-16 录音消息:语音气泡(播放/暂停 + 进度点条 + 时长),可回听
                return (
                  <VoiceBubble
                    key={`${item.id}-voice-${segIndex}`}
                    url={seg.url}
                    durationSec={seg.durationSec}
                    isUser={isUser}
                  />
                )
              }
              if (seg.type === 'image') {
                return (
                  <Pressable
                    key={`${item.id}-img-${segIndex}`}
                    onPress={() => setPreviewImageUrl(seg.url)}
                    style={styles.msgImageWrap}
                  >
                    <Image
                      source={{ uri: seg.url }}
                      style={styles.msgImage}
                      resizeMode="cover"
                      accessibilityLabel={t('chat.msg.imgA11y')}
                    />
                  </Pressable>
                )
              }
              if (seg.type === 'code') {
                const codeKey = `${item.id}-${segIndex}`
                const expanded = expandedCodeBlocks.has(codeKey)
                return (
                  <View key={`${item.id}-code-${segIndex}`} style={styles.codeBlock}>
                    <View style={styles.codeBlockHeader}>
                      <Text style={styles.codeBlockLang} numberOfLines={1}>
                        {seg.language || 'code'}
                      </Text>
                      <View style={styles.codeBlockActions}>
                        <TouchableOpacity
                          style={styles.codeBlockBtn}
                          hitSlop={6}
                          onPress={() => {
                            Clipboard.setString(seg.code)
                            showToast('success', t('chat.msg.copied'))
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t('chat.msg.copyCode')}
                        >
                          <Copy size={13} color={tokens.gray['200']} />
                          <Text style={styles.codeBlockBtnText}>复制</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.codeBlockBtn}
                          hitSlop={6}
                          onPress={() =>
                            setExpandedCodeBlocks((prev) => {
                              const next = new Set(prev)
                              if (next.has(codeKey)) next.delete(codeKey)
                              else next.add(codeKey)
                              return next
                            })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={
                            expanded ? t('chat.msg.collapseCode') : t('chat.msg.expandCode')
                          }
                        >
                          <Text style={styles.codeBlockBtnText}>
                            {expanded ? t('chat.msg.collapse') : t('chat.msg.expand')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {expanded ? (
                      <Text style={styles.codeBlockContent} selectable>
                        {seg.code}
                      </Text>
                    ) : (
                      <Text style={styles.codeBlockContent} numberOfLines={4}>
                        {seg.code}
                      </Text>
                    )}
                  </View>
                )
              }
              // D99 富文本动作锚点:文本段先过识别器 —— 无锚点时走下面的原样 <Text>,
              // 与抽取前逐字节一致;有锚点时切成行内流(text 子段照旧 <Text>,
              // anchor 子段为可点击芯片,未传 onActionAnchor 时芯片内部自动降级为加粗文本)。
              const anchorParts = extractActionAnchors(seg.text)
              if (!anchorParts.some((part) => part.kind === 'anchor')) {
                return (
                  <Text
                    key={`${item.id}-text-${segIndex}`}
                    style={[styles.msgText, isUser ? styles.msgBubbleUserText : styles.msgTextAi]}
                  >
                    {seg.text}
                  </Text>
                )
              }
              return (
                <View key={`${item.id}-text-${segIndex}`} style={styles.anchorParagraph}>
                  {anchorParts.map((part, partIndex) =>
                    part.kind === 'text' ? (
                      <Text
                        key={`${item.id}-text-${segIndex}-${partIndex}`}
                        style={[
                          styles.msgText,
                          isUser ? styles.msgBubbleUserText : styles.msgTextAi,
                        ]}
                      >
                        {part.text}
                      </Text>
                    ) : (
                      <ActionAnchorChip
                        key={`${item.id}-anchor-${segIndex}-${partIndex}`}
                        anchor={part.anchor}
                        isUser={isUser}
                        textStyle={[
                          styles.msgText,
                          isUser ? styles.msgBubbleUserText : styles.msgTextAi,
                        ]}
                        onActionAnchor={onActionAnchor}
                      />
                    ),
                  )}
                </View>
              )
            })}
          {!isFailed && segments.length === 0 ? (
            <Text style={[styles.msgText, isUser ? styles.msgBubbleUserText : styles.msgTextAi]}>
              {item.content || (isStreaming && !isUser ? t('chat.msg.thinkingNow') : item.content)}
            </Text>
          ) : null}
        </Pressable>
        {showActions ? (
          <View style={styles.msgActions}>
            <TouchableOpacity
              style={styles.msgActionBtn}
              hitSlop={8}
              onPress={() => {
                Clipboard.setString(item.content)
                showToast('success', t('chat.msg.copied'))
              }}
              accessibilityRole="button"
              accessibilityLabel={t('chat.msg.copy')}
            >
              <Copy size={16} color={tokens.text.secondary} />
              <Text style={styles.msgActionText}>复制</Text>
            </TouchableOpacity>
            {flagButtons}
            {/* 失败轮不给"分享"(它不是内容);复制保留 —— 报错排查要用那段文字 */}
            {isFailed ? null : (
              <TouchableOpacity
                style={styles.msgActionBtn}
                hitSlop={8}
                onPress={() => {
                  void Share.share({ message: item.content }).then(() => {
                    void maybeTriggerFirstShareReward()
                  })
                }}
                accessibilityRole="button"
                accessibilityLabel={t('chat.msg.share2')}
              >
                <Share2 size={16} color={tokens.text.secondary} />
                <Text style={styles.msgActionText}>分享</Text>
              </TouchableOpacity>
            )}
            {isFailed ? null : (
              <TouchableOpacity
                style={styles.msgActionBtn}
                hitSlop={8}
                onPress={() => void rateMessage(item.id, 'like')}
                accessibilityRole="button"
                accessibilityLabel={t('chat.msg.agree')}
              >
                <ThumbsUp size={16} color={tokens.text.secondary} />
              </TouchableOpacity>
            )}
            {isFailed ? null : (
              <TouchableOpacity
                style={styles.msgActionBtn}
                hitSlop={8}
                onPress={() => void rateMessage(item.id, 'dislike')}
                accessibilityRole="button"
                accessibilityLabel={t('chat.msg.disagree')}
              >
                <ThumbsDown size={16} color={tokens.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
        ) : null}
        {/* 票64:用户消息也给这两枚(操作行其余按钮维持既有"只给 AI"的结构不动) */}
        {isUser ? <View style={styles.msgActions}>{flagButtons}</View> : null}
        {/* G-166 交代区:本轮引用来源 + 带了哪些上下文(与 N8n 屏同一共享组件) */}
        {isFailed ? null : (
          <InjectionDisclosure items={(item as ChatScreenMessageWithReasoning).injections ?? []} />
        )}
        {isFailed ? null : (
          <CitationList items={(item as ChatScreenMessageWithReasoning).citations ?? []} />
        )}
        {/* D106 Steer(中途引导)交代:本轮被注入了哪些引导文本 */}
        {isFailed ? null : (
          <SteerNoticeList items={(item as ChatScreenMessageWithReasoning).steerNotices ?? []} />
        )}
        {/* D64⑤ 历史回放:metadata.elementPack 子代理帧的最小回放行(一行一代理,
            与既有 execRowText 行形态同族;流式侧最小形态是计数+日志行,回放不逐帧重演) */}
        {isFailed ? null : (item as ChatScreenMessageWithReasoning).elementPack?.length ? (
          <View style={styles.execRows}>
            {(item as ChatScreenMessageWithReasoning).elementPack!.map((sg) => (
              <Text key={sg.id} style={styles.execRowText} numberOfLines={1}>
                {subagentReplayRow(sg, t)}
              </Text>
            ))}
          </View>
        ) : null}
        {/* D111 权限档交代行:档名 + 该档后果(与 N8n 屏同一共享组件;null 不渲染) */}
        {isFailed ? null : <PermissionTierRow key="permission-tier-row" mode={workspaceTier} />}
        {/* D135 终端任务最小可视态:命令 + 状态 + 耗时(抽至 ToolCallCard,D113/D119 挂载点) */}
        <ToolCallCard
          isFailed={isFailed}
          terminalTasks={executionVizById[item.id]?.terminalTasks}
          // D113 前端半:把已折叠好的工具调用快照喂给 ToolCallCard —— tool-delta 帧经
          // ChatScreen.foldExecutionFrame 按 seq 收敛进 toolCalls[].partialDiff,
          // 卡片只在 running + partialDiff 非空时渲染「流中 diff 预览」折叠块。
          toolCalls={executionVizById[item.id]?.toolCalls}
        />
        <SelectionAnnotationBar messageId={item.id} conversationId={conversationId ?? null} t={t} />
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
