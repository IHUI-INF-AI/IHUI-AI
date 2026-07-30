import { View, Text, Image, Video } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import type { ChatMessage } from '@/api'
import { useI18n } from '@/i18n'
import sikaoIcon from '@/assets/remote/images/sikao_icon.png'
import eyeOpenIcon from '@/assets/remote/images/eye-gray.svg'
import eyeClosedIcon from '@/assets/remote/images/eye-slash-gray.svg'
import downloadIcon from '@/assets/remote/images/download.png'
import copyIcon from '@/assets/remote/images/copy.png'

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
  /** TTS 朗读(仅 AI 消息,对标原 ai_assistant.vue 朗读功能) */
  onSpeak?: (content: string) => void
  /** 打开思考过程独立浮层(仅 AI 消息含 reasoning) */
  onOpenReasoning?: () => void
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

/** 移除特殊字符(对标原 ai_assistant.vue removeSpecialChars,完整实现) */
function removeSpecialChars(str: string): string {
  if (!str) return ''
  // 移除 # 号(标题标记)
  if (/#+/g.test(str)) str = str.replace(/#+/g, '')
  // 移除 * 号(加粗/斜体标记)
  if (/\*+/g.test(str)) str = str.replace(/\*+/g, '')
  // 横线 → 列表符号 •
  str = str.replace(/(^|\n)\s*[-–—_]+/g, '$1•')
  // 圆点 → 列表符号 •
  str = str.replace(/(^|\n)\s*[·⚫・]/g, '$1•')
  return str
}

/** 格式化 token 消耗(对标原 ai_assistant.vue total_tokens 显示) */
function formatTokenDisplay(count: number): string {
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K'
  return String(count)
}

export default function ChatMessageItem({
  msg,
  onReuse,
  onRegenerate,
  onLongPress,
  onEdit,
  isFavorited,
  onToggleFavorite,
  onSpeak,
  onOpenReasoning,
}: ChatMessageItemProps) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [codeCollapsed, setCodeCollapsed] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  // TTS 朗读状态(对标原 ai_assistant.vue 朗读/停止)
  const [speaking, setSpeaking] = useState(false)
  // 语音气泡播放状态(对标原 ai_assistant.vue 语音消息播放)
  const [voicePlaying, setVoicePlaying] = useState(false)
  // 显示/隐藏答案(对标原 ai_assistant.vue toggleAnswerVisibility + eye-closed/eye-open.svg)
  const [answerHidden, setAnswerHidden] = useState(false)

  const toggleAnswer = useCallback(() => setAnswerHidden((v) => !v), [])

  /** 内容段(对标原 ai_assistant.vue formatContentSegments) */
  const segments = useMemo(
    () => formatContentSegments(removeSpecialChars(msg.content)),
    [msg.content],
  )

  /** 数字人关键词检测(对标原 ai_assistant.vue 数字人跳转) */
  const hasDigitalHuman = useMemo(
    () => /数字人|虚拟人|avatar|digital\s*human/i.test(msg.content || ''),
    [msg.content],
  )

  /** 语音消息 audioUrl(可选属性扩展,不破坏 ChatMessage 接口) */
  const audioUrl = (msg as { audioUrl?: string }).audioUrl
  /** 语音时长(可选,秒) */
  const audioDuration = (msg as { audioDuration?: number }).audioDuration

  /** 点击朗读(对标原 ai_assistant.vue 朗读按钮,触发父级 TTS 跳转) */
  function handleSpeak() {
    if (!onSpeak || !msg.content) return
    if (speaking) {
      setSpeaking(false)
      return
    }
    setSpeaking(true)
    onSpeak(msg.content)
    // 简化实现:朗读状态由用户手动停止,或跳转后自动重置
    setTimeout(() => setSpeaking(false), 3000)
  }

  /** 播放语音气泡(对标原 ai_assistant.vue 语音消息播放) */
  function playVoice() {
    if (!audioUrl) return
    const audio = Taro.createInnerAudioContext()
    audio.src = audioUrl
    setVoicePlaying(true)
    audio.onEnded(() => setVoicePlaying(false))
    audio.onError(() => setVoicePlaying(false))
    audio.play()
  }

  /** 跳转数字人页(对标原 ai_assistant.vue 数字人跳转) */
  function goDigitalHuman() {
    Taro.navigateTo({ url: '/pages/ai/agent' })
  }

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

  /** 下载图片到相册(对标原 ai_assistant.vue downloadImages:含水印 URL + 相册保存 + 权限申请) */
  async function downloadImages() {
    const urls = msg.images || []
    if (!urls.length) return
    Taro.showLoading({ title: t('ai.chatMessageItem.downloading') || '下载中' })
    try {
      for (const url of urls) {
        const res = await Taro.downloadFile({ url })
        if (res.statusCode === 200) {
          await Taro.saveImageToPhotosAlbum({ filePath: res.tempFilePath })
        }
      }
      Taro.showToast({
        title: t('ai.chatMessageItem.downloadSuccess') || '已保存到相册',
        icon: 'success',
      })
    } catch (err) {
      const errMsg = String((err as { errMsg?: string })?.errMsg || '')
      if (errMsg.includes('auth deny')) {
        Taro.showModal({
          title: t('common.hint') || '提示',
          content:
            t('ai.chatMessageItem.needAlbumAuth') || '需要相册权限才能保存图片,请在设置中开启',
          confirmText: t('common.goSettings') || '去设置',
          success: (res) => {
            if (res.confirm) Taro.openSetting()
          },
        })
      } else {
        Taro.showToast({
          title: t('ai.chatMessageItem.downloadFailed') || '下载失败',
          icon: 'none',
        })
      }
    } finally {
      Taro.hideLoading()
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
          <View
            className="bubble-code-wrap"
            style={{ marginTop: '8rpx', borderRadius: '8rpx', overflow: 'hidden' }}
          >
            <View
              className="bubble-code-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8rpx 16rpx',
                background: 'var(--color-muted)',
                borderBottom: '1rpx solid var(--color-border)',
              }}
            >
              <Text
                className="bubble-code-lang"
                style={{ fontSize: '24rpx', color: 'var(--color-muted-foreground)' }}
                onClick={() => setCodeCollapsed((v) => !v)}
              >
                {codeCollapsed ? '▸' : '▾'} {t('ai.chatMessageItem.collapse')}
              </Text>
              <Text
                className="bubble-code-copy"
                style={{
                  fontSize: '24rpx',
                  color: codeCopied ? 'var(--color-success)' : 'var(--color-link)',
                }}
                onClick={copyCode}
              >
                {codeCopied ? t('ai.chatMessageItem.copy') + ' ✓' : t('ai.chatMessageItem.copy')}
              </Text>
            </View>
            {!codeCollapsed ? (
              <Text
                className="bubble-code"
                style={{
                  color: 'var(--color-link)',
                  display: 'block',
                  padding: '12rpx 16rpx',
                  fontSize: '26rpx',
                  background: 'var(--color-muted)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {msg.codeContent}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* 内容段渲染(对标原 ai_assistant.vue formatContentSegments,支持答案显隐) */}
        {!answerHidden ? (
          segments.map((seg, idx) => (
            <Text
              key={idx}
              className={`bubble-seg bubble-seg-${seg.type}`}
              style={
                seg.type === 'link'
                  ? { color: 'var(--color-link)' }
                  : seg.type === 'header'
                    ? { fontWeight: 'bold', display: 'block', marginBottom: '20rpx' }
                    : undefined
              }
              onClick={() => handleSegmentClick(seg)}
            >
              {seg.value}
            </Text>
          ))
        ) : (
          <View
            className="hidden-answer-container"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20rpx',
            }}
          >
            <Image
              src={eyeClosedIcon}
              style={{ width: '30rpx', height: '30rpx' }}
              mode="aspectFit"
            />
          </View>
        )}

        {/* 图片展示(对标原 ai_assistant.vue imgUrlList,支持答案显隐 + 加载失败兜底) */}
        {!answerHidden && msg.images && msg.images.length > 0
          ? msg.images.map((imgUrl, idx) => (
              <Image
                key={`img-${idx}`}
                className="bubble-img"
                style={{ width: '100%', marginTop: '10rpx', display: 'block' }}
                src={imgUrl}
                mode="widthFix"
                onClick={() => previewImage(imgUrl, msg.images!)}
                onError={() => console.warn('Image load failed:', imgUrl)}
              />
            ))
          : null}

        {/* 视频展示(对标原 ai_assistant.vue videoUrlList,支持答案显隐) */}
        {!answerHidden && msg.videos && msg.videos.length > 0
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

        {/* 语音消息气泡(对标原 ai_assistant.vue 语音气泡,audioUrl 可选属性) */}
        {audioUrl ? (
          <View
            className={`voice-bubble ${msg.role}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16rpx',
              padding: '16rpx 24rpx',
              borderRadius: '12rpx',
              marginTop: '10rpx',
              background:
                msg.role === 'user' ? 'var(--color-chat-bubble-user)' : 'var(--color-muted)',
            }}
            onClick={playVoice}
          >
            <Text className="voice-play-icon" style={{ fontSize: '36rpx' }}>
              {voicePlaying ? '⏸' : '▶'}
            </Text>
            <Text
              className="voice-duration"
              style={{ fontSize: '24rpx', color: 'var(--color-muted-foreground)' }}
            >
              {audioDuration ? `${audioDuration}"` : t('ai.chatMessageItem.voiceMessage')}
            </Text>
          </View>
        ) : null}

        {/* 数字人跳转按钮(对标原 ai_assistant.vue 数字人跳转,仅 AI 消息含关键词) */}
        {msg.role === 'assistant' && hasDigitalHuman ? (
          <View
            className="digital-human-btn"
            style={{
              marginTop: '12rpx',
              padding: '8rpx 16rpx',
              background: 'var(--color-link-bg)',
              color: 'var(--color-link)',
              borderRadius: '6rpx',
              fontSize: '24rpx',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            onClick={goDigitalHuman}
          >
            {t('ai.chatMessageItem.viewDigitalHuman')} →
          </View>
        ) : null}

        {/* 操作按钮区(对标原 ai_assistant.vue .action-buttons:左 token 消耗 + 右图标按钮组) */}
        <View className="bubble-actions">
          {/* 左侧:token 消耗(仅 AI 消息,对标原 ai_assistant.vue "智汇AI生成 消耗智汇值:XXX") */}
          {msg.role === 'assistant' && msg.tokenCount !== undefined ? (
            <Text
              className="bubble-token"
              style={{
                marginRight: '10rpx',
                fontSize: '24rpx',
                color: 'var(--color-muted-foreground)',
                lineHeight: '40rpx',
                opacity: answerHidden ? 0 : 1,
              }}
            >
              {t('ai.chatMessageItem.aiGenerated')}
              {msg.tokenCount > 0
                ? ` ${t('ai.chatMessageItem.tokenCost', { n: formatTokenDisplay(msg.tokenCount) })}`
                : ''}
            </Text>
          ) : null}

          {/* 左侧:用户消息复用 + 编辑按钮(对标原 ai_assistant.vue fuyong-btn) */}
          {msg.role === 'user' ? (
            <View style={{ display: 'flex', alignItems: 'center' }}>
              {onReuse ? (
                <Text
                  className="bubble-reuse"
                  style={{
                    fontSize: '24rpx',
                    color: 'var(--color-link)',
                    marginRight: '20rpx',
                  }}
                  onClick={handleReuse}
                >
                  {t('ai.chatMessageItem.reuse')}
                </Text>
              ) : null}
              {onEdit ? (
                <Text
                  className="bubble-edit"
                  style={{ fontSize: '24rpx', color: 'var(--color-link)' }}
                  onClick={handleEdit}
                >
                  {t('ai.chatMessageItem.edit')}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* 右侧:图标按钮组(仅 AI 消息,对标原 ai_assistant.vue display:flex justify-content:flex-end) */}
          {msg.role === 'assistant' && msg.content ? (
            <View className="bubble-actions-right">
              {/* 答案显隐 eye 图标(对标原 eye-closed.svg / eye-open.svg) */}
              <Image
                src={answerHidden ? eyeOpenIcon : eyeClosedIcon}
                className="action-btn-img"
                mode="widthFix"
                onClick={toggleAnswer}
              />
              {/* 思考回看 sikao 图标(仅 reasoning 存在时) */}
              {onOpenReasoning && msg.reasoning ? (
                <Image
                  src={sikaoIcon}
                  className="action-btn-img"
                  mode="widthFix"
                  onClick={onOpenReasoning}
                />
              ) : null}
              {/* 复制图标 */}
              <Image
                src={copyIcon}
                className="action-btn-img"
                mode="widthFix"
                onClick={() => copyContent(msg.content)}
              />
              {/* 下载图标(仅图片消息) */}
              {msg.images && msg.images.length > 0 ? (
                <Image
                  src={downloadIcon}
                  className="action-btn-img"
                  mode="widthFix"
                  onClick={downloadImages}
                />
              ) : null}
              {/* 保留文字按钮:重新生成/收藏/朗读 */}
              {onRegenerate ? (
                <Text
                  className="bubble-regenerate"
                  style={{
                    fontSize: '24rpx',
                    color: 'var(--color-link)',
                    marginLeft: '20rpx',
                  }}
                  onClick={onRegenerate}
                >
                  {t('ai.chatMessageItem.regenerate')}
                </Text>
              ) : null}
              {onToggleFavorite ? (
                <Text
                  className="bubble-favorite"
                  style={{
                    fontSize: '24rpx',
                    color: isFavorited
                      ? 'var(--color-destructive)'
                      : 'var(--color-muted-foreground)',
                    marginLeft: '20rpx',
                  }}
                  onClick={onToggleFavorite}
                >
                  {isFavorited ? '♥' : '♡'}
                </Text>
              ) : null}
              {onSpeak ? (
                <Text
                  className="bubble-speak"
                  style={{
                    fontSize: '24rpx',
                    color: 'var(--color-link)',
                    marginLeft: '20rpx',
                  }}
                  onClick={handleSpeak}
                >
                  🔊 {speaking ? t('ai.chatMessageItem.stopSpeak') : t('ai.chatMessageItem.speak')}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
