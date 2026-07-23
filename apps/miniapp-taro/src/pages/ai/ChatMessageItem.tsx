import { View, Text, Image, Video } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo } from 'react'
import type { ChatMessage } from '@/api'
import { useI18n } from '@/i18n'

export interface ChatMessageItemProps {
  msg: ChatMessage
  onReuse?: (question: string) => void
  onRegenerate?: () => void
  onLongPress?: () => void
  onEdit?: () => void
  /** 是否已收藏(仅 AI 消息,对标原 ai_assistant.vue 收藏状态) */
  isFavorited?: boolean
  /** 切换收藏状态(仅 AI 消息,对标原 ai_assistant.vue toggleFavorite) */
  onToggleFavorite?: () => void
}

/** 内容段类型(对标原 ai_assistant.vue formatContentSegments) */
interface ContentSegment {
  type: 'header' | 'link' | 'text'
  value: string
  url?: string
}

/**
 * 内容段格式化(对标原 ai_assistant.vue formatContentSegments)
 * 将纯文本拆分为:标题(###) / 链接(http) / 普通文本 三类段
 */
function formatContentSegments(str: string): ContentSegment[] {
  if (!str) return []
  const segments: ContentSegment[] = []
  const lines = str.split('\n')
  const urlRegex = /(https?:\/\/[^\s]+)/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    // 标题段:### 开头
    const headerMatch = line.match(/^\s*#{1,6}\s*(.*)$/)
    if (headerMatch) {
      segments.push({
        type: 'header',
        value: headerMatch[1] + (i < lines.length - 1 ? '\n' : ''),
      })
      continue
    }
    // 链接段:提取 URL
    const urlMatch = line.match(urlRegex)
    if (urlMatch && urlMatch.length > 0) {
      urlMatch.forEach((url) => {
        segments.push({ type: 'link', value: url, url })
      })
      const textPart = line.replace(urlRegex, '').trim()
      if (textPart) {
        segments.push({ type: 'text', value: textPart })
      }
      continue
    }
    // 普通文本段
    segments.push({ type: 'text', value: line + (i < lines.length - 1 ? '\n' : '') })
  }
  return segments
}

/** 移除特殊字符(对标原 ai_assistant.vue removeSpecialChars) */
function removeSpecialChars(str: string): string {
  if (!str) return ''
  return str.replace(/^#{1,6}\s*/gm, '')
}

/** 格式化 token 消耗(对标原 ai_assistant.vue total_tokens 显示) */
function formatTokenDisplay(count: number): string {
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K'
  return String(count)
}

export default function ChatMessageItem({ msg, onReuse, onRegenerate, onLongPress, onEdit, isFavorited, onToggleFavorite }: ChatMessageItemProps) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [codeCollapsed, setCodeCollapsed] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  /** 内容段(对标原 ai_assistant.vue formatContentSegments) */
  const segments = useMemo(
    () => formatContentSegments(removeSpecialChars(msg.content)),
    [msg.content],
  )

  /** 复制内容到剪贴板(对标原 ai_assistant.vue copyHandle) */
  function copyContent(content: string) {
    if (!content || !content.trim()) {
      Taro.showToast({ title: t('ai.chatMessageItem.noContent'), icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: content,
      success: () => Taro.showToast({ title: t('success.copied'), icon: 'none' }),
    })
  }

  /** 复用问题到输入框(对标原 ai_assistant.vue copyToInput) */
  function handleReuse() {
    if (msg.role === 'user' && onReuse) {
      onReuse(msg.content)
    }
  }

  function copyCode() {
    if (!msg.codeContent) return
    Taro.setClipboardData({
      data: msg.codeContent,
      success: () => {
        setCodeCopied(true)
        Taro.showToast({ title: t('success.copied'), icon: 'none' })
        setTimeout(() => setCodeCopied(false), 1500)
      },
    })
  }

  function handleLongPress() {
    if (onLongPress) onLongPress()
  }

  function handleEdit() {
    if (msg.role === 'user' && onEdit) onEdit()
  }

  /** 预览图片(对标原 ai_assistant.vue previewImage) */
  function previewImage(currentUrl: string, urlList: string[]) {
    Taro.previewImage({ current: currentUrl, urls: urlList })
  }

  /** 处理段点击(对标原 ai_assistant.vue handleSegmentClick) */
  function handleSegmentClick(seg: ContentSegment) {
    if (seg.type === 'link' && seg.url) {
      copyContent(seg.url)
    }
  }

  return (
    <View className={`msg-item ${msg.role}`} onLongPress={handleLongPress}>
      <View className={`avatar ${msg.role}`}>
        {msg.role === 'user' ? t('ai.chatMessageItem.me') : t('ai.chatMessageItem.ai')}
      </View>
      <View className="bubble">
        {/* 思考过程(对标原 ai_assistant.vue reasoning 折叠) */}
        {msg.reasoning ? (
          <View className="reasoning-wrap" onClick={() => setExpanded((v) => !v)}>
            <Text className="reasoning-toggle">
              {expanded ? '▾' : '▸'} {t('ai.chatMessageItem.thinkingProcess')}
            </Text>
            {expanded ? <Text className="reasoning-content">{msg.reasoning}</Text> : null}
          </View>
        ) : null}

        {/* 代码块(对标原 ai_assistant.vue content_code,可折叠 + 复制按钮) */}
        {msg.codeContent ? (
          <View className="bubble-code-wrap" style={{ marginTop: '8rpx', borderRadius: '8rpx', overflow: 'hidden' }}>
            <View
              className="bubble-code-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8rpx 16rpx',
                background: '#f5f5f5',
                borderBottom: '1rpx solid #e5e5e5',
              }}
            >
              <Text
                className="bubble-code-lang"
                style={{ fontSize: '24rpx', color: '#666' }}
                onClick={() => setCodeCollapsed((v) => !v)}
              >
                {codeCollapsed ? '▸' : '▾'} {t('ai.chatMessageItem.collapse')}
              </Text>
              <Text
                className="bubble-code-copy"
                style={{ fontSize: '24rpx', color: codeCopied ? '#52c41a' : '#1888ee' }}
                onClick={copyCode}
              >
                {codeCopied ? t('ai.chatMessageItem.copy') + ' ✓' : t('ai.chatMessageItem.copy')}
              </Text>
            </View>
            {!codeCollapsed ? (
              <Text
                className="bubble-code"
                style={{ color: '#1888ee', display: 'block', padding: '12rpx 16rpx', fontSize: '26rpx', background: '#fafafa', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
              >
                {msg.codeContent}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* 内容段渲染(对标原 ai_assistant.vue formatContentSegments) */}
        {segments.map((seg, idx) => (
          <Text
            key={idx}
            className={`bubble-seg bubble-seg-${seg.type}`}
            style={
              seg.type === 'link'
                ? { color: '#1888ee' }
                : seg.type === 'header'
                  ? { fontWeight: 'bold', display: 'block', marginBottom: '20rpx' }
                  : undefined
            }
            onClick={() => handleSegmentClick(seg)}
          >
            {seg.value}
          </Text>
        ))}

        {/* 图片展示(对标原 ai_assistant.vue imgUrlList) */}
        {msg.images && msg.images.length > 0
          ? msg.images.map((imgUrl, idx) => (
              <Image
                key={`img-${idx}`}
                className="bubble-img"
                style={{ width: '100%', marginTop: '10rpx', display: 'block' }}
                src={imgUrl}
                mode="widthFix"
                onClick={() => previewImage(imgUrl, msg.images!)}
              />
            ))
          : null}

        {/* 视频展示(对标原 ai_assistant.vue videoUrlList) */}
        {msg.videos && msg.videos.length > 0
          ? msg.videos.map((videoUrl, idx) => (
              <Video
                key={`video-${idx}`}
                className="bubble-video"
                style={{ width: '100%', marginTop: '10rpx' }}
                src={videoUrl}
                controls
                showPlayBtn
                showCenterPlayBtn
                enableProgressGesture
                objectFit="contain"
              />
            ))
          : null}

        {/* 操作按钮区(对标原 ai_assistant.vue action-buttons) */}
        <View className="bubble-actions" style={{ justifyContent: 'space-between', marginTop: '8rpx' }}>
          {/* token 消耗(仅 AI 消息,对标原 ai_assistant.vue total_tokens) */}
          {msg.role === 'assistant' && msg.tokenCount !== undefined ? (
            <Text
              className="bubble-token"
              style={{ fontSize: '24rpx', color: '#999', lineHeight: '40rpx' }}
            >
              {t('ai.chatMessageItem.aiGenerated')}
              {msg.tokenCount > 0
                ? ` · ${t('ai.chatMessageItem.tokenCost', { n: formatTokenDisplay(msg.tokenCount) })}`
                : ''}
            </Text>
          ) : null}

          {/* 复用 + 编辑按钮(仅用户消息) */}
          {msg.role === 'user' ? (
            <View style={{ display: 'flex', gap: '20rpx' }}>
              {onReuse ? (
                <Text
                  className="bubble-reuse"
                  style={{ fontSize: '24rpx', color: '#1888ee' }}
                  onClick={handleReuse}
                >
                  {t('ai.chatMessageItem.reuse')}
                </Text>
              ) : null}
              {onEdit ? (
                <Text
                  className="bubble-edit"
                  style={{ fontSize: '24rpx', color: '#1888ee' }}
                  onClick={handleEdit}
                >
                  {t('ai.chatMessageItem.edit')}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* 复制 + 重新生成 + 收藏按钮(仅 AI 消息) */}
          {msg.role === 'assistant' && msg.content ? (
            <View style={{ display: 'flex', gap: '20rpx' }}>
              <Text
                className="bubble-copy"
                style={{ fontSize: '24rpx', color: '#1888ee' }}
                onClick={() => copyContent(msg.content)}
              >
                {t('ai.chatMessageItem.copy')}
              </Text>
              {onRegenerate ? (
                <Text
                  className="bubble-regenerate"
                  style={{ fontSize: '24rpx', color: '#1888ee' }}
                  onClick={onRegenerate}
                >
                  {t('ai.chatMessageItem.regenerate')}
                </Text>
              ) : null}
              {onToggleFavorite ? (
                <Text
                  className="bubble-favorite"
                  style={{ fontSize: '24rpx', color: isFavorited ? '#ff4d4f' : '#999' }}
                  onClick={onToggleFavorite}
                >
                  {isFavorited ? '♥' : '♡'}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
