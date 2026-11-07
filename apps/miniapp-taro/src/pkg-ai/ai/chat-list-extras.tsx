// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序聊天页的声明式挂槽子件(A3 装配前收口)。
 *
 * 立点:块 2 `ChatMessageList` 只收「节点/映射」这类声明式数据(`headerNode` /
 * `tailNodes` / `orphanTailNode` / `thinkingNode`),不再收 `renderHeader` /
 * `renderItemTail` / `thinkingSlot` 三个渲染函数。挂载位置与锚定语义归共享层,
 * 端内只在这里保留视觉子件(依赖 Taro 原语与端内组件,不能反向进 packages/app)。
 *
 * 判据:页面只传数据;本文件的组件不读写页面 state,也不发任何网络请求。
 */
import { View, Text, Image } from '@tarojs/components'
import type { ReactNode } from 'react'
import { rnRadius } from '@ihui/design-tokens'
import LineIcon from '@/components/LineIcon'
import { IntelligentAssistant } from '@/components'
import BusinessFormCard, { type BusinessFormCardProps } from '@/components/BusinessFormCard'
import { aizhsUrl } from '@/constants/icon-urls'

const tishiIcon = aizhsUrl('remote-images/tishi_icon.png')
const recordBackIcon = '/pkg-ai/assets/record_back.png'

type Translate = (key: string) => string

/** 列表头:加载更早 + 智能体引导(tishi)+ 欢迎区/建议项。 */
export interface ChatListHeaderProps {
  t: Translate
  earlierHasMore: boolean
  loadingEarlier: boolean
  onLoadEarlier: () => void
  agent?: { prologue?: string } | null
  tishiShow: boolean
  onToggleTishi: () => void
  suggestions: readonly string[]
  onSuggestion: (text: string) => void
  /** 仅在列表为空时展示欢迎区(与页面 `!messages.length` 同判据) */
  showWelcome: boolean
  tokenBalance?: number
  isLoggedIn: boolean
  onRecharge: () => void
}

export function ChatListHeader({
  t,
  earlierHasMore,
  loadingEarlier,
  onLoadEarlier,
  agent,
  tishiShow,
  onToggleTishi,
  suggestions,
  onSuggestion,
  showWelcome,
  tokenBalance,
  isLoggedIn,
  onRecharge,
}: ChatListHeaderProps) {
  return (
    <>
      {/* D20 留尾2:加载更早消息入口(仅服务端回放且首页 hasMore=true 时出现;
          失败不清已回放内容,入口保留可重试;前插后不强制滚底,不拽走阅读位置) */}
      {earlierHasMore ? (
        <View className="load-earlier" onClick={onLoadEarlier} hoverClass="opacity-60">
          <Text className="load-earlier-text">
            {loadingEarlier ? t('ai.chat.earlierLoading') : t('ai.chat.loadEarlier')}
          </Text>
        </View>
      ) : null}
      {/* 智能体引导说明(对标原 ai_assistant.vue tishi_block + tishi_box,仅选中智能体时显示) */}
      {agent ? (
        <View className="tishi-block" onClick={onToggleTishi} hoverClass="opacity-60">
          {tishiShow ? (
            <LineIcon
              name="x"
              size={28}
              color="var(--color-muted-foreground)"
              className="tishi-block-icon"
            />
          ) : (
            <Image
              src={tishiIcon}
              className="tishi-block-icon w-[28rpx] h-[28rpx]"
              mode="aspectFit"
            />
          )}
          <Text className="tishi-block-text">
            {tishiShow ? t('ai.tishi.close') : t('ai.tishi.view')} {t('ai.tishi.title')}
          </Text>
        </View>
      ) : null}
      {agent && tishiShow && agent.prologue ? (
        <View className="tishi-box">
          <View className="tishi-title">
            <Image
              src={recordBackIcon}
              className="tishi-title-icon w-[32rpx] h-[32rpx]"
              mode="aspectFit"
            />
            <Text className="tishi-title-text">{t('ai.tishi.needInput')}</Text>
          </View>
          <View className="tishi-content">
            {/* 对标原 v-html tishi_content,prologue 中的 \n 替换为换行展示 */}
            {agent.prologue
              .replace(/\\n/g, '\n')
              .replace(/<br\s*\/?>/g, '\n')
              .split('\n')
              .map((line, i) => (
                <Text key={i} className="tishi-content-line">
                  {line}
                  {'\n'}
                </Text>
              ))}
          </View>
        </View>
      ) : null}

      {showWelcome ? (
        <View className="welcome">
          <Text className="welcome-title">{t('ai.welcomeTitle')}</Text>
          <Text className="welcome-desc">{t('ai.welcomeDesc')}</Text>
          {!agent ? (
            <IntelligentAssistant
              tokenBalance={tokenBalance}
              isLoggedIn={isLoggedIn}
              onRecharge={onRecharge}
            />
          ) : null}
          <View className="suggest-list">
            {suggestions.map((s, i) => (
              <View
                key={i}
                className="suggest-item"
                onClick={() => onSuggestion(s)}
                hoverClass="opacity-60"
              >
                <Text>{s}</Text>
              </View>
            ))}
          </View>
          <Text className="welcome-tip">{t('ai.thinkingTip')}</Text>
        </View>
      ) : null}
    </>
  )
}

/** 流式末条占位:AI 气泡 + 生成中文案 + 思考进度条。 */
export interface ChatThinkingPlaceholderProps {
  t: Translate
  progress: number
}

export function ChatThinkingPlaceholder({ t, progress }: ChatThinkingPlaceholderProps) {
  return (
    <View className="msg-item assistant">
      <View className="avatar assistant">{t('ai.chatMessageItem.ai')}</View>
      <View className="bubble">
        <Text className="bubble-text">{t('ai.generating')}</Text>
        {/* 流式占位文案:共享屏气泡在「最后一条 AI 消息还没内容」时显示的就是这一句 */}
        <Text
          className="bubble-text"
          style={{ fontSize: '22rpx', color: 'var(--color-muted-foreground)' }}
        >
          {t('chat.thinking')}
        </Text>
        {/* 思考进度条(对标原 ai_assistant.vue thinking-progress-container) */}
        <View
          className="thinking-progress-container"
          style={{ position: 'relative', marginTop: 'var(--spacing-xs)', height: '36rpx' }}
        >
          <View
            className="thinking-progress-bar"
            style={{
              width: `${Math.floor(progress)}%`,
              height: '100%',
              background: 'var(--color-primary)',
              borderRadius: rnRadius.xs,
              transition: 'width 120ms linear',
            }}
          />
          <Text
            style={{
              position: 'absolute',
              left: '50%',
              top: '0',
              lineHeight: '36rpx',
              transform: 'translateX(-50%)',
              color: 'var(--color-foreground)',
              fontSize: '24rpx',
            }}
          >
            {Math.floor(progress)}%
          </Text>
        </View>
      </View>
    </View>
  )
}

/** 单条业务表单卡(锚定在 assistant 消息之后 / 或列表尾兜底)。 */
export interface ChatBusinessFormTailProps {
  kind: BusinessFormCardProps['kind']
  mode?: BusinessFormCardProps['mode']
  requestId: string
  sending: boolean
  failed: boolean
  failedLabel: string
  onAction: NonNullable<BusinessFormCardProps['onAction']>
}

export function ChatBusinessFormTail({
  kind,
  mode,
  requestId,
  sending,
  failed,
  failedLabel,
  onAction,
}: ChatBusinessFormTailProps) {
  return (
    <View className="business-form-block" data-form-request={requestId}>
      <BusinessFormCard
        kind={kind}
        mode={mode}
        requestId={requestId}
        sending={sending}
        onAction={onAction}
      />
      {failed ? (
        <Text className="business-form-send-failed" data-form-send-failed={requestId}>
          {failedLabel}
        </Text>
      ) : null}
    </View>
  )
}

/** 业务表单锚定源(页面 state 的结构化投影,不含渲染函数)。 */
export interface BusinessFormTailSource {
  messageId: string
  requestId: string
  kind: BusinessFormCardProps['kind']
  mode?: BusinessFormCardProps['mode']
  status?: string
}

/**
 * 声明式锚定:把业务表单按 messageId 映射到行 id。
 * - 锚得上 ⇒ `tailNodes.get(rowId)`;
 * - 锚不上(帧带本端认不出的 messageId)⇒ `orphanTailNode` 落列表尾。
 * 兜底口径与页面既有实现一致:`knownAnchorIds` 用「全部消息」的
 * `String(id ?? timestamp)`,不是只算可见版本行。
 */
export function buildBusinessFormTails(args: {
  rows: readonly { rowId: string; anchorId: string }[]
  knownAnchorIds: readonly string[]
  forms: readonly BusinessFormTailSource[]
  sendingRequestId: string | null
  failedLabel: string
  onAction: (
    form: BusinessFormTailSource,
    payload: Parameters<NonNullable<BusinessFormCardProps['onAction']>>[0],
  ) => void
}): { tailNodes: Map<string, ReactNode>; orphanTailNode: ReactNode } {
  const anchorToRow = new Map<string, string>()
  for (const row of args.rows) anchorToRow.set(row.anchorId, row.rowId)
  const known = new Set(args.knownAnchorIds)
  const grouped = new Map<string, ReactNode[]>()
  const orphans: ReactNode[] = []
  for (const form of args.forms) {
    const node = (
      <ChatBusinessFormTail
        key={form.requestId}
        kind={form.kind}
        mode={form.mode}
        requestId={form.requestId}
        sending={args.sendingRequestId === form.requestId}
        failed={form.status === 'failed'}
        failedLabel={args.failedLabel}
        onAction={(payload) => args.onAction(form, payload)}
      />
    )
    if (!known.has(form.messageId)) {
      orphans.push(node)
      continue
    }
    const rowId = anchorToRow.get(form.messageId)
    if (!rowId) continue
    const list = grouped.get(rowId) ?? []
    list.push(node)
    grouped.set(rowId, list)
  }
  const tailNodes = new Map<string, ReactNode>()
  for (const [rowId, nodes] of grouped) {
    tailNodes.set(rowId, nodes.length === 1 ? nodes[0] : <>{nodes}</>)
  }
  return { tailNodes, orphanTailNode: orphans.length ? <>{orphans}</> : null }
}
