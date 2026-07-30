import { View, Text, Image, Video, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage } from '@/api'
import { useI18n } from '@/i18n'
import sikaoIcon from '@/assets/remote/images/sikao_icon.png'
import eyeOpenIcon from '@/assets/remote/images/eye-gray.svg'
import eyeClosedIcon from '@/assets/remote/images/eye-slash-gray.svg'
import downloadIcon from '@/assets/remote/images/download.png'
import copyIcon from '@/assets/remote/images/copy.png'
import reuseBtnPng from '@/assets/remote/images/fuyong_btn.png'
import agentsharePng from '@/assets/remote/images/agentshare.png'

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
  /** 分享消息(仅 AI 消息,对标原 ai_assistant.vue share(index):按钮点击前置写入待分享消息) */
  onShare?: () => void
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

/** 移除特殊字符(对标原 ai_assistant.vue removeSpecialChars,保留 # 号以识别标题) */
function removeSpecialChars(str: string): string {
  if (!str) return ''
  // 移除 * 号(加粗/斜体标记),保留 # 号(formatContentSegments 依赖 # 识别标题)
  str = str.replace(/\*+/g, '')
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

/** ChatMessage 可选音频扩展(对标原 ai_assistant.vue 语音消息字段) */
interface ChatMessageWithAudio extends ChatMessage {
  audioUrl?: string
  audioDuration?: number
}

/** 类型守卫:判断消息是否包含音频字段 */
function hasAudio(msg: ChatMessage): msg is ChatMessageWithAudio {
  return 'audioUrl' in msg || 'audioDuration' in msg
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
  onShare,
}: ChatMessageItemProps) {
  const { t } = useI18n()
  const [codeCollapsed, setCodeCollapsed] = useState(true)
  const [codeCopied, setCodeCopied] = useState(false)
  // TTS 朗读状态(对标原 ai_assistant.vue 朗读/停止)
  const [speaking, setSpeaking] = useState(false)
  // 语音气泡播放状态(对标原 ai_assistant.vue 语音消息播放)
  const [voicePlaying, setVoicePlaying] = useState(false)
  // 显示/隐藏答案(对标原 ai_assistant.vue toggleAnswerVisibility + eye-closed/eye-open.svg)
  const [answerHidden, setAnswerHidden] = useState(false)

  // 音频上下文 ref(避免每次播放创建新实例导致资源泄漏)
  const audioContextRef = useRef<Taro.InnerAudioContext | null>(null)
  useEffect(() => {
    return () => {
      audioContextRef.current?.destroy()
      audioContextRef.current = null
    }
  }, [])

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

  /** 语音消息 audioUrl(类型安全访问,对标原 ai_assistant.vue 语音消息字段) */
  const audioUrl = hasAudio(msg) ? msg.audioUrl : undefined
  /** 语音时长(可选,秒) */
  const audioDuration = hasAudio(msg) ? msg.audioDuration : undefined

  /** 点击朗读(对标原 ai_assistant.vue 朗读按钮,触发父级 TTS 跳转) */
  function handleSpeak() {
    if (!onSpeak || !msg.content) return
    if (speaking) {
      setSpeaking(false)
      return
    }
    setSpeaking(true)
    onSpeak(msg.content)
  }

  /** 播放语音气泡(对标原 ai_assistant.vue 语音消息播放,复用 audioContextRef 避免泄漏) */
  function playVoice() {
    if (!audioUrl) return
    // 销毁旧实例再创建新实例,避免重复播放
    audioContextRef.current?.destroy()
    const audio = Taro.createInnerAudioContext()
    audioContextRef.current = audio
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

  /** 预览图片(对标原 ai_assistant.vue previewImage,防御 urls 空数组) */
  function previewImage(currentUrl: string, urlList: string[]) {
    if (!urlList || urlList.length === 0) return
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
    Taro.showLoading({ title: t('ai.chatMessageItem.downloading') })
    try {
      for (const url of urls) {
        const res = await Taro.downloadFile({ url })
        if (res.statusCode === 200) {
          await Taro.saveImageToPhotosAlbum({ filePath: res.tempFilePath })
        }
      }
      Taro.showToast({
        title: t('ai.chatMessageItem.downloadSuccess'),
        icon: 'success',
      })
    } catch (err) {
      const errMsg = String((err as { errMsg?: string })?.errMsg || '')
      if (errMsg.includes('auth deny')) {
        Taro.showModal({
          title: t('common.hint'),
          content: t('ai.chatMessageItem.needAlbumAuth'),
          confirmText: t('common.goSettings'),
          success: (res) => {
            if (res.confirm) Taro.openSetting()
          },
        })
      } else {
        Taro.showToast({
          title: t('ai.chatMessageItem.downloadFailed'),
          icon: 'none',
        })
      }
    } finally {
      Taro.hideLoading()
    }
  }

  return (
    <View onLongPress={handleLongPress}>
      {/* 用户消息:.question-container 右浮,复用按钮在气泡外左侧(对标原 ai_assistant.vue) */}
      {msg.role === 'user' ? (
        <View className="question-container">
          {/* 复用按钮 fuyong-btn:100rpx×40rpx,在气泡外左侧 */}
          {onReuse ? (
            <View style={{ marginRight: '10rpx' }}>
              <Image
                src={reuseBtnPng}
                className="fuyong-btn"
                mode="widthFix"
                onClick={handleReuse}
              />
            </View>
          ) : null}
          {/* 用户消息图片列表(若有) */}
          {msg.images && msg.images.length > 0 ? (
            <View className="agent-content-item-question" style={{ marginTop: '20rpx' }}>
              {msg.images.map((imgUrl, i) => (
                <Image
                  key={i}
                  src={imgUrl}
                  className="agent-question-item-img"
                  style={{
                    width: '100rpx',
                    height: '100rpx',
                    display: 'block',
                    marginBottom: '10rpx',
                  }}
                  mode="aspectFill"
                />
              ))}
            </View>
          ) : null}
          {/* 用户气泡 agent-content-item-question:紫色渐变右浮 */}
          <View
            className="agent-content-item-question"
            style={{ position: 'relative', maxWidth: 'calc(100% - 110rpx)' }}
          >
            {/* 编辑按钮(增强功能,历史项目无,保留) */}
            {onEdit ? (
              <Text
                style={{
                  fontSize: '20rpx',
                  color: '#fff',
                  opacity: 0.7,
                  display: 'block',
                  textAlign: 'right',
                  marginBottom: '6rpx',
                }}
                onClick={handleEdit}
              >
                {t('ai.chatMessageItem.edit')}
              </Text>
            ) : null}
            <Text>{msg.content}</Text>
          </View>
        </View>
      ) : (
        /* AI 消息:.agent-content-item 全宽灰色气泡(对标原 ai_assistant.vue) */
        <View className="agent-content-item">
          {/* 答案显隐切换 */}
          {!answerHidden ? (
            <View className="content_agent_nei">
              {/* 段渲染:link 色 #1888ee,header 加粗块级 */}
              {segments.map((seg, idx) => {
                if (seg.type === 'link') {
                  return (
                    <Text
                      key={idx}
                      style={{ color: '#1888ee' }}
                      onClick={() => handleSegmentClick(seg)}
                    >
                      {seg.url}
                    </Text>
                  )
                }
                if (seg.type === 'header') {
                  return (
                    <Text
                      key={idx}
                      style={{ fontWeight: 'bold', display: 'block', marginBottom: '20rpx' }}
                    >
                      {seg.value}
                    </Text>
                  )
                }
                return (
                  <Text key={idx} style={{ whiteSpace: 'pre-wrap' }}>
                    {seg.value}
                  </Text>
                )
              })}
              {/* 代码块(保留当前 codeCollapsed 逻辑) */}
              {msg.codeContent ? (
                <View style={{ marginTop: '12rpx' }}>
                  <View
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12rpx 16rpx',
                      background: '#282c34',
                      borderRadius: '8rpx',
                    }}
                    onClick={() => setCodeCollapsed((v) => !v)}
                  >
                    <Text style={{ fontSize: '24rpx', color: '#abb2bf' }}>
                      {codeCollapsed ? '▸' : '▾'} code
                    </Text>
                    <Text style={{ fontSize: '24rpx', color: '#61dafb' }} onClick={copyCode}>
                      {codeCopied ? t('success.copied') : t('ai.chatMessageItem.copy')}
                    </Text>
                  </View>
                  {!codeCollapsed ? (
                    <Text
                      style={{
                        display: 'block',
                        padding: '16rpx',
                        fontFamily: 'monospace',
                        fontSize: '24rpx',
                        color: '#abb2bf',
                        background: '#282c34',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {msg.codeContent}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {/* 语音气泡(若有 audioUrl) */}
              {audioUrl ? (
                <View
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginTop: '12rpx',
                    padding: '12rpx 20rpx',
                    background: '#9a99f3',
                    borderRadius: '30rpx',
                    color: '#fff',
                  }}
                  onClick={playVoice}
                >
                  <Text style={{ fontSize: '32rpx', marginRight: '12rpx' }}>
                    {voicePlaying ? '⏸' : '▶'}
                  </Text>
                  {audioDuration ? (
                    <Text style={{ fontSize: '24rpx' }}>{`${audioDuration}''`}</Text>
                  ) : null}
                </View>
              ) : null}
              {/* 数字人关键词检测 */}
              {hasDigitalHuman ? (
                <View
                  style={{
                    marginTop: '12rpx',
                    padding: '10rpx 20rpx',
                    background: '#9a99f3',
                    borderRadius: '15rpx',
                    color: '#fff',
                    display: 'inline-block',
                  }}
                  onClick={goDigitalHuman}
                >
                  <Text style={{ fontSize: '24rpx' }}>{t('ai.chatMessageItem.digitalHuman')}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={{ padding: '20rpx', textAlign: 'center' }}>
              <Text style={{ color: '#999', fontSize: '24rpx' }}>···</Text>
            </View>
          )}

          {/* AI 图片列表 agent-content-item-img */}
          {msg.images && msg.images.length > 0 && !answerHidden ? (
            <View>
              {msg.images.map((imgUrl, i) => (
                <Image
                  key={i}
                  src={imgUrl}
                  className="agent-content-item-img"
                  mode="widthFix"
                  onClick={() => previewImage(imgUrl, msg.images || [imgUrl])}
                />
              ))}
            </View>
          ) : null}

          {/* AI 视频列表(若有) */}
          {msg.videos && msg.videos.length > 0 && !answerHidden ? (
            <View>
              {msg.videos.map((videoUrl, i) => (
                <Video
                  key={`video-${i}`}
                  src={videoUrl}
                  style={{ width: '100%', marginTop: '10rpx' }}
                  controls
                  showPlayBtn
                  showCenterPlayBtn
                  enableProgressGesture
                  objectFit="contain"
                />
              ))}
            </View>
          ) : null}

          {/* 操作按钮行 action-buttons:左侧 token 信息 + 右侧图标组 */}
          <View className="action-buttons" style={{ justifyContent: 'space-between' }}>
            {/* 左侧:智汇AI生成 + 消耗智汇值 */}
            <View
              style={{
                opacity: answerHidden ? 0 : 1,
                marginRight: '10rpx',
                fontSize: '24rpx',
                color: '#999',
                lineHeight: '40rpx',
              }}
            >
              <Text>{t('ai.chatMessageItem.aiGenerated')}</Text>
              {typeof msg.tokenCount === 'number' ? (
                <Text style={{ marginLeft: '10rpx' }}>
                  {t('ai.chatMessageItem.tokenCost', { n: formatTokenDisplay(msg.tokenCount) })}
                </Text>
              ) : null}
            </View>

            {/* 右侧:图标按钮组 */}
            <View style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {/* 答案显隐 eye-closed/eye-open */}
              <Image
                className="action-btn"
                src={answerHidden ? eyeOpenIcon : eyeClosedIcon}
                onClick={toggleAnswer}
              />
              {/* 思考过程(若有 reasoning) */}
              {msg.reasoning ? (
                <Image className="action-btn" src={sikaoIcon} onClick={onOpenReasoning} />
              ) : null}
              {/* 复制 */}
              <Image
                className="action-btn"
                src={copyIcon}
                onClick={() => copyContent(msg.content)}
              />
              {/* 下载(有图片时) */}
              {msg.images && msg.images.length > 0 ? (
                <Image className="action-btn" src={downloadIcon} onClick={downloadImages} />
              ) : null}
              {/* 分享(对标原 ai_assistant.vue .share-btn:Button openType=share 触发原生分享,View onClick 前置写入待分享消息) */}
              <View className="share-btn" onClick={onShare}>
                <Button openType="share" className="share-button">
                  {t('ai.chatMessageItem.share')}
                </Button>
                <Image className="share-icon" src={agentsharePng} mode="widthFix" />
              </View>
              {/* 朗读 TTS(增强功能,历史项目无,保留) */}
              {onSpeak ? (
                <Text
                  style={{
                    fontSize: '24rpx',
                    color: '#1888ee',
                    marginLeft: '20rpx',
                    lineHeight: '40rpx',
                  }}
                  onClick={handleSpeak}
                >
                  {speaking ? '⏸' : '🔊'}
                </Text>
              ) : null}
              {/* 重新生成(增强功能,历史项目无,保留) */}
              {onRegenerate ? (
                <Text
                  style={{
                    fontSize: '24rpx',
                    color: '#1888ee',
                    marginLeft: '20rpx',
                    lineHeight: '40rpx',
                  }}
                  onClick={onRegenerate}
                >
                  ↻
                </Text>
              ) : null}
              {/* 收藏(增强功能,历史项目无,保留) */}
              {onToggleFavorite ? (
                <Text
                  style={{
                    fontSize: '24rpx',
                    color: isFavorited ? '#ff6b6b' : '#999',
                    marginLeft: '20rpx',
                    lineHeight: '40rpx',
                  }}
                  onClick={onToggleFavorite}
                >
                  {isFavorited ? '♥' : '♡'}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
