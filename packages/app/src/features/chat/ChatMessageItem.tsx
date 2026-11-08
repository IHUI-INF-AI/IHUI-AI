// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 块 7:聊天消息视觉结构 —— 跨端共享(纯展示 + 本地视觉态,零平台 API)
 *
 * 纪律(§3 共享层优先):
 * - 只 import React / react-native 原语;不出现 `@tarojs/*`、`wx.*`、Taro.*、剪贴板/相册/
 *   音频/导航等平台调用。图标、图片源、分享按钮、视频节点、活动卡、单位换算 helper
 *   全部由端侧注入。
 * - 行为走 props:`onCopy`(复制文案/链接)、`onOpenImage`(图片全屏)、`onRebuildMenu`
 *   (版本菜单节点由端侧注入)、`onDownloadImages`、`onPlayVoice`、`onRate`、`onApproval` 等;
 *   共享件不判断端。
 * - 视觉等价:class(`question-container` / `agent-content-item` / `content_agent_nei` /
 *   `agent-content-item-img` / `action-buttons` / `share-btn` 等)与样式 token 逐字保留
 *   (rpx 字符串经端侧 `rpx()` helper 产出,避免 SWC 剥离 inline rpx)。
 */

import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { Image, Text, View } from 'react-native'
import { rnRadius, taroSpacing } from '@ihui/design-tokens'
import { AI_GENERATED_LABEL, isErrorTurn } from '@ihui/shared/chat'
import { thinkingTitleView } from '@ihui/shared/chat/element-pack'
import type {
  ChatMessageItemMessage,
  ChatMessageItemRenderIcon,
  ChatMessageItemViewProps,
} from '@ihui/types'

/**
 * 消息视觉结构消费的字段集 —— 单一源在 @ihui/types 的 ChatMessageItemMessage,
 * 本处保留历史导出名(端内外既有 import 无需改动)。
 */
export type ChatMessage = ChatMessageItemMessage

type LooseProps = Record<string, unknown>
const V = View as unknown as (props: LooseProps) => ReactElement
const T = Text as unknown as (props: LooseProps) => ReactElement
const I = Image as unknown as (props: LooseProps) => ReactElement

/** 端侧矢量图标注入 —— 单一源在 @ihui/types,本处保留历史导出名 */
export type RenderIcon = ChatMessageItemRenderIcon

export type { ChatMessageItemViewProps } from '@ihui/types'

interface ContentSegment {
  type: 'header' | 'link' | 'text'
  value: string
  url?: string
}

function formatContentSegments(str: string): ContentSegment[] {
  if (!str) return []
  const segments: ContentSegment[] = []
  const lines = str.split('\n')
  const urlRegex = /(https?:\/\/[^\s]+)/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const headerMatch = line.match(/^\s*#{1,6}\s*(.*)$/)
    if (headerMatch) {
      segments.push({
        type: 'header',
        value: headerMatch[1] + (i < lines.length - 1 ? '\n' : ''),
      })
      continue
    }
    const urlMatch = line.match(urlRegex)
    if (urlMatch && urlMatch.length > 0) {
      urlMatch.forEach((url) => {
        segments.push({ type: 'link', value: url, url })
      })
      const textPart = line.replace(urlRegex, '').trim()
      if (textPart) segments.push({ type: 'text', value: textPart })
      continue
    }
    segments.push({ type: 'text', value: line + (i < lines.length - 1 ? '\n' : '') })
  }
  return segments
}

function removeSpecialChars(str: string): string {
  if (!str) return ''
  str = str.replace(/\*+/g, '')
  str = str.replace(/(^|\n)\s*[-–—_]+/g, '$1•')
  str = str.replace(/(^|\n)\s*[·⚫・]/g, '$1•')
  return str
}

function formatTokenDisplay(count: number): string {
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K'
  return String(count)
}

function hasAudio(msg: ChatMessage): boolean {
  return 'audioUrl' in msg || 'audioDuration' in msg
}

export function ChatMessageItemView({
  t,
  msg,
  icons,
  renderIcon,
  rpx,
  onCopy,
  onOpenImage,
  onDownloadImages,
  onOpenDigitalHuman,
  onPlayVoice,
  onRate,
  onApproval,
  approvalActions,
  onReuse,
  onRegenerate,
  onLongPress,
  onEdit,
  isFavorited,
  onToggleFavorite,
  onSpeak,
  onOpenReasoning,
  onShare,
  versionMenuSlot,
  shareSlot,
  renderVideo,
  activityCardsSlot,
  steerNoticeSlot,
}: ChatMessageItemViewProps) {
  const [codeCollapsed, setCodeCollapsed] = useState(true)
  const [codeCopied, setCodeCopied] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voicePlaying, setVoicePlaying] = useState(false)
  const [answerHidden, setAnswerHidden] = useState(false)

  const isFailed = isErrorTurn(msg)
  const toggleAnswer = useCallback(() => setAnswerHidden((v) => !v), [])
  const segments = useMemo(
    () => formatContentSegments(removeSpecialChars(msg.content)),
    [msg.content],
  )
  const hasDigitalHuman = useMemo(
    () => /数字人|虚拟人|avatar|digital\s*human/i.test(msg.content || ''),
    [msg.content],
  )
  const audioUrl = hasAudio(msg) ? msg.audioUrl : undefined
  const audioDuration = hasAudio(msg) ? msg.audioDuration : undefined

  function handleSpeak() {
    if (!onSpeak || !msg.content) return
    if (speaking) {
      setSpeaking(false)
      return
    }
    setSpeaking(true)
    onSpeak(msg.content)
  }

  function playVoice() {
    if (!audioUrl) return
    setVoicePlaying(true)
    onPlayVoice(audioUrl, () => setVoicePlaying(false))
  }

  function copyContent(content: string) {
    onCopy(content)
  }

  function handleReuse() {
    if (msg.role === 'user' && onReuse) onReuse(msg.content)
  }

  function copyCode() {
    if (!msg.codeContent) return
    onCopy(msg.codeContent)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 1500)
  }

  function handleLongPress() {
    if (onLongPress) onLongPress()
  }

  function handleEdit() {
    if (msg.role === 'user' && onEdit) onEdit()
  }

  function handleSegmentClick(seg: ContentSegment) {
    if (seg.type === 'link' && seg.url) copyContent(seg.url)
  }

  return (
    <V onLongPress={handleLongPress}>
      {/* 用户消息:.question-container 右浮,复用按钮在气泡外左侧(对标原 ai_assistant.vue) */}
      {msg.role === 'user' ? (
        <V className="question-container">
          {/* 复用按钮 fuyong-btn:100rpx×40rpx,在气泡外左侧 */}
          {onReuse ? (
            <V
              style={{
                marginRight: '10rpx',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              hoverClass="opacity-60"
              onClick={handleReuse}
            >
              <I src={icons.reuse} className="fuyong-btn" resizeMode="cover" />
              <T
                style={{
                  fontSize: '20rpx',
                  color: 'var(--color-link)',
                  marginTop: 'var(--spacing-2xs)',
                }}
              >
                {t('ai.chatMessageItem.reuse')}
              </T>
            </V>
          ) : null}
          {/* 用户消息图片列表(若有) */}
          {msg.images && msg.images.length > 0 ? (
            <V
              className="agent-content-item-question"
              style={{ marginTop: 'var(--spacing-sm-loose)' }}
            >
              {msg.images.map((imgUrl, i) => (
                <I
                  key={i}
                  src={imgUrl}
                  className="agent-question-item-img"
                  style={{
                    width: '100rpx',
                    height: '100rpx',
                    display: 'block',
                    marginBottom: '10rpx',
                  }}
                  resizeMode="cover"
                />
              ))}
            </V>
          ) : null}
          {/* 用户气泡 agent-content-item-question:紫色渐变右浮 */}
          <V
            className="agent-content-item-question"
            style={{ position: 'relative', maxWidth: 'calc(100% - 110rpx)' }}
          >
            {/* 发送者"我"标签 + 编辑按钮(增强功能,历史项目无,保留) */}
            <V
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6rpx',
              }}
            >
              <T style={{ fontSize: '20rpx', color: 'var(--color-foreground)', opacity: 0.7 }}>
                {t('ai.chatMessageItem.me')}
              </T>
              {onEdit ? (
                <V className="px-[8rpx] py-[4rpx]" hoverClass="opacity-60" onClick={handleEdit}>
                  <T style={{ fontSize: '20rpx', color: 'var(--color-foreground)', opacity: 0.7 }}>
                    {t('ai.chatMessageItem.edit')}
                  </T>
                </V>
              ) : null}
            </V>
            <T>{msg.content}</T>
          </V>
        </V>
      ) : (
        /* AI 消息:.agent-content-item 全宽灰色气泡(对标原 ai_assistant.vue) */
        <V className="agent-content-item">
          {/* 失败轮 → 错误卡片(警示头 + 正文 + 重试出口),整块替换正文:失败不产出内容。 */}
          {isFailed ? (
            <V className="w-full overflow-hidden rounded-lg border border-destructive/40 bg-destructive/5">
              <V className="flex items-center bg-destructive/10 px-md py-sm">
                {renderIcon({
                  name: 'triangle-alert',
                  size: 28,
                  color: 'var(--color-destructive)',
                  style: { marginRight: 'var(--spacing-xs)' },
                })}
                <T className="text-label font-medium text-destructive">
                  {t('ai.chatMessageItem.errorCardTitle')}
                </T>
              </V>
              <T className="block whitespace-pre-wrap break-words px-md py-sm text-body text-destructive">
                {msg.content}
              </T>
              {onRegenerate ? (
                <V className="px-md pb-sm">
                  <V
                    className="inline-flex items-center"
                    onClick={onRegenerate}
                    hoverClass="opacity-60"
                  >
                    {renderIcon({
                      name: 'refresh-cw',
                      size: 24,
                      color: 'var(--color-destructive)',
                      style: { marginRight: '6rpx' },
                    })}
                    <T className="text-label text-destructive">{t('ai.chatMessageItem.retry')}</T>
                  </V>
                </V>
              ) : null}
            </V>
          ) : !answerHidden ? (
            <V className="content_agent_nei">
              {/* 段渲染:link 色,header 加粗块级 */}
              {segments.map((seg, idx) => {
                if (seg.type === 'link') {
                  return (
                    <T
                      key={idx}
                      style={{ color: 'var(--color-link)' }}
                      onClick={() => handleSegmentClick(seg)}
                    >
                      {seg.url}
                    </T>
                  )
                }
                if (seg.type === 'header') {
                  return (
                    <T
                      key={idx}
                      style={{
                        fontWeight: 'bold',
                        display: 'block',
                        marginBottom: 'var(--spacing-sm-loose)',
                      }}
                    >
                      {seg.value}
                    </T>
                  )
                }
                return (
                  <T key={idx} style={{ whiteSpace: 'pre-wrap' }}>
                    {seg.value}
                  </T>
                )
              })}
              {/* 代码块(保留 codeCollapsed 逻辑;浅色化:代码块 bg=var(--color-muted)) */}
              {msg.codeContent ? (
                <V style={{ marginTop: 'var(--spacing-xs-loose)' }}>
                  <V
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${rpx(taroSpacing['xs-loose'])} ${rpx(taroSpacing.sm)}`,
                      background: 'var(--color-muted)',
                      borderTopLeftRadius: rnRadius.sm,
                      borderTopRightRadius: rnRadius.sm,
                      borderBottomRightRadius: 0,
                      borderBottomLeftRadius: 0,
                    }}
                    onClick={() => setCodeCollapsed((v) => !v)}
                    hoverClass="opacity-60"
                  >
                    <V style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                      {renderIcon({
                        name: codeCollapsed ? 'chevron-right' : 'chevron-down',
                        size: 24,
                        color: 'var(--color-muted-foreground)',
                      })}
                      <T
                        style={{
                          marginLeft: 'var(--spacing-xs)',
                          fontSize: '24rpx',
                          color: 'var(--color-muted-foreground)',
                        }}
                      >
                        code
                      </T>
                    </V>
                    <T style={{ fontSize: '22rpx', color: 'var(--color-muted-foreground)' }}>
                      {t('ai.chatMessageItem.collapse')}
                    </T>
                    <T style={{ fontSize: '24rpx', color: 'var(--color-link)' }} onClick={copyCode}>
                      {codeCopied ? t('success.copied') : t('ai.chatMessageItem.copy')}
                    </T>
                  </V>
                  {!codeCollapsed ? (
                    <T
                      style={{
                        display: 'block',
                        padding: 'var(--spacing-sm)',
                        fontFamily: 'monospace',
                        fontSize: '24rpx',
                        color: 'var(--color-foreground)',
                        background: 'var(--color-muted)',
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: rnRadius.sm,
                        borderBottomLeftRadius: rnRadius.sm,
                        borderTop: '1rpx solid var(--color-border)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {msg.codeContent}
                    </T>
                  ) : null}
                </V>
              ) : null}
              {/* 语音气泡(若有 audioUrl;播放行为由端侧注入) */}
              {audioUrl ? (
                <V
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginTop: 'var(--spacing-xs-loose)',
                    padding: `${rpx(taroSpacing['xs-loose'])} ${rpx(taroSpacing['sm-loose'])}`,
                    background: 'var(--color-muted)',
                    borderRadius: rnRadius['2xl'],
                    color: 'var(--color-foreground)',
                  }}
                  onClick={playVoice}
                  hoverClass="opacity-60"
                >
                  {renderIcon({
                    name: voicePlaying ? 'pause' : 'play',
                    size: 32,
                    color: 'var(--color-muted-foreground)',
                    style: { marginRight: 'var(--spacing-xs-loose)' },
                  })}
                  <T style={{ fontSize: '24rpx', marginRight: 'var(--spacing-xs-loose)' }}>
                    {t('ai.chatMessageItem.voiceMessage')}
                  </T>
                  {audioDuration ? (
                    <T style={{ fontSize: '24rpx' }}>{`${audioDuration}''`}</T>
                  ) : null}
                </V>
              ) : null}
              {/* 数字人关键词检测(跳转行为由端侧注入) */}
              {hasDigitalHuman ? (
                <V
                  style={{
                    marginTop: 'var(--spacing-xs-loose)',
                    padding: '10rpx 20rpx',
                    background: 'var(--color-link)',
                    borderRadius: rnRadius.lg,
                    color: 'var(--color-card)',
                    display: 'inline-block',
                  }}
                  onClick={onOpenDigitalHuman}
                  hoverClass="opacity-60"
                >
                  <T style={{ fontSize: '24rpx', display: 'block' }}>
                    {t('ai.chatMessageItem.viewDigitalHuman')}
                  </T>
                  <T style={{ fontSize: '20rpx', opacity: 0.9, display: 'block' }}>
                    {t('ai.chatMessageItem.digitalHuman')}
                  </T>
                </V>
              ) : null}
              {/* Steer 引导交代(端侧注入节点) */}
              {steerNoticeSlot ?? null}
              {/* 工具卡片(端侧注入节点) */}
              {activityCardsSlot ?? null}
            </V>
          ) : (
            <V style={{ padding: 'var(--spacing-sm-loose)', textAlign: 'center' }}>
              <T style={{ color: 'var(--color-muted-foreground)', fontSize: '24rpx' }}>···</T>
            </V>
          )}

          {/* AI 图片列表 agent-content-item-img(全屏行为由端侧注入) */}
          {msg.images && msg.images.length > 0 && !answerHidden ? (
            <V>
              {msg.images.map((imgUrl, i) => (
                <I
                  key={i}
                  src={imgUrl}
                  className="agent-content-item-img"
                  resizeMode="cover"
                  onClick={() => onOpenImage(imgUrl, msg.images || [imgUrl])}
                />
              ))}
            </V>
          ) : null}

          {/* AI 视频列表(端侧注入播放器) */}
          {msg.videos && msg.videos.length > 0 && !answerHidden ? (
            <V>{msg.videos.map((videoUrl, i) => renderVideo?.(videoUrl, i) ?? null)}</V>
          ) : null}

          {/* 操作按钮行 action-buttons:左侧 token 信息 + 右侧图标组 */}
          <V className="action-buttons" style={{ justifyContent: 'space-between' }}>
            {/* 左侧:智汇AI生成 + 消耗智汇值 */}
            <V
              style={{
                opacity: answerHidden ? 0 : 1,
                marginRight: '10rpx',
                fontSize: `${AI_GENERATED_LABEL.fontSizePx * 2}rpx`,
                color: AI_GENERATED_LABEL.colorCssVar,
                lineHeight: `${AI_GENERATED_LABEL.lineHeightPx * 2}rpx`,
              }}
            >
              <T>{t(AI_GENERATED_LABEL.i18nKey)}</T>
              {typeof msg.tokenCount === 'number' ? (
                <T style={{ marginLeft: '10rpx' }}>
                  {t('ai.chatMessageItem.tokenCost', { n: formatTokenDisplay(msg.tokenCount) })}
                </T>
              ) : null}
            </V>

            {/* 右侧:图标按钮组 */}
            <V style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {/* 答案显隐 */}
              {renderIcon({
                name: answerHidden ? 'eye-off' : 'eye',
                size: 40,
                color: 'var(--color-muted-foreground)',
                className: 'action-btn',
                onClick: toggleAnswer,
              })}
              {/* D64③ 双态(判定唯一入口 thinkingTitleView) */}
              {(() => {
                const titleView = thinkingTitleView(
                  Boolean(msg.reasoning),
                  msg.aiCards?.citations?.length ?? 0,
                )
                if (!titleView) return null
                if (titleView.variant === 'thinking') {
                  return <I className="action-btn" src={icons.sikao} onClick={onOpenReasoning} />
                }
                return (
                  <T
                    className="action-btn"
                    style={{
                      fontSize: '24rpx',
                      color: 'var(--color-muted-foreground)',
                      lineHeight: '40rpx',
                    }}
                  >
                    {t(`ai.pane.${titleView.titleKey}`, titleView.values)}
                  </T>
                )
              })()}
              {/* 复制(行为由端侧注入) */}
              <I className="action-btn" src={icons.copy} onClick={() => copyContent(msg.content)} />
              {/* 下载(有图片时;行为由端侧注入) */}
              {msg.images && msg.images.length > 0 ? (
                <I
                  className="action-btn"
                  src={icons.download}
                  onClick={() => onDownloadImages(msg.images || [])}
                />
              ) : null}
              {/* 分享(端侧注入节点:小程序需 Button openType=share) */}
              {isFailed
                ? null
                : (shareSlot ?? (
                    <V className="share-btn" onClick={onShare} hoverClass="opacity-60">
                      <I className="share-icon" src={icons.share} resizeMode="cover" />
                    </V>
                  ))}
              {/* 朗读 TTS(增强功能,历史项目无,保留) */}
              {onSpeak ? (
                <V
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '24rpx',
                    color: 'var(--color-link)',
                    marginLeft: 'var(--spacing-sm-loose)',
                    lineHeight: '40rpx',
                  }}
                  onClick={handleSpeak}
                  hoverClass="opacity-60"
                >
                  {renderIcon({
                    name: speaking ? 'pause' : 'volume-2',
                    size: 24,
                    color: 'var(--color-muted-foreground)',
                    style: { marginRight: '6rpx' },
                  })}
                  <T>
                    {speaking ? t('ai.chatMessageItem.stopSpeak') : t('ai.chatMessageItem.speak')}
                  </T>
                </V>
              ) : null}
              {/* 重新生成(增强功能,历史项目无,保留) */}
              {onRegenerate ? (
                <V
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginLeft: 'var(--spacing-sm-loose)',
                    lineHeight: '40rpx',
                  }}
                  hoverClass="opacity-60"
                  onClick={onRegenerate}
                >
                  <T style={{ fontSize: '24rpx', color: 'var(--color-link)' }}>
                    ↻ {t('ai.chatMessageItem.regenerate')}
                  </T>
                </V>
              ) : null}
              {/* 收藏(增强功能,历史项目无,保留) */}
              {onToggleFavorite ? (
                <V
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginLeft: 'var(--spacing-sm-loose)',
                    lineHeight: '40rpx',
                  }}
                  onClick={onToggleFavorite}
                  hoverClass="opacity-60"
                >
                  {renderIcon({
                    name: 'heart',
                    size: 24,
                    color: isFavorited ? 'var(--color-brand)' : 'var(--color-muted-foreground)',
                  })}
                </V>
              ) : null}
              {/* 评价(点赞/点踩;接口由端侧注入) */}
              {renderIcon({
                name: 'check-success',
                size: 40,
                color: 'var(--color-muted-foreground)',
                className: 'action-btn',
                onClick: () => onRate('like'),
              })}
              {renderIcon({
                name: 'x-error',
                size: 40,
                color: 'var(--color-muted-foreground)',
                className: 'action-btn',
                onClick: () => onRate('dislike'),
              })}
              {(approvalActions ?? []).map((action) => (
                <V
                  key={action.id}
                  className="action-btn"
                  hoverClass="opacity-60"
                  onClick={() => onApproval(action.id)}
                >
                  <T style={{ fontSize: '24rpx', color: 'var(--color-muted-foreground)' }}>
                    {action.label}
                  </T>
                </V>
              ))}
            </V>
          </V>
        </V>
      )}
      {versionMenuSlot ?? null}
    </V>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
