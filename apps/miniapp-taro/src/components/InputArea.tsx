import { View, Text, Textarea, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import voiceRecorder from '@/utils/voice-recorder'
import { useI18n } from '@/i18n'
import { cn } from '@ihui/design-tokens'

export interface InputAreaProps {
  value?: string
  placeholder?: string
  onSend?: (text: string) => void
  onVoicePress?: () => void
  onVoiceRelease?: (filePath: string) => void
  onUpload?: (files: string[]) => void
  disabled?: boolean
  maxLength?: number
  autoFocus?: boolean
  /** 样式变体:'default'(旧)/ 'ai-home'(首页专用,对齐原项目 .input-area) */
  variant?: 'default' | 'ai-home'
}

const EMOJI_LIST = [
  '😀',
  '😁',
  '😂',
  '🤣',
  '😊',
  '😍',
  '🤔',
  '😎',
  '😴',
  '😭',
  '😡',
  '👍',
  '👎',
  '👏',
  '🙏',
  '💪',
  '❤️',
  '🔥',
  '✨',
  '🎉',
  '🎁',
  '🌟',
  '💯',
  '✅',
]

type Mode = 'text' | 'voice'

/**
 * InputArea 输入区
 *
 * 两种 variant:
 * - 'default'(默认):Tailwind bg-muted 输入框,无发送按钮显式宽度
 * - 'ai-home'(首页专用):对齐原项目 .input-area:
 *   - padding 20rpx + padding-bottom calc(20rpx + env(safe-area-inset-bottom))
 *   - 输入框:bg #E6F3FA + 圆角 30rpx + 高度 80rpx + padding 0 30rpx + 字号 30rpx + 颜色 #333
 *   - 发送按钮:100rpx×100rpx + 圆角 30rpx + 居中显示发送图标
 */
export default function InputArea({
  value = '',
  placeholder,
  onSend,
  onVoicePress,
  onVoiceRelease,
  onUpload,
  disabled = false,
  maxLength = 500,
  autoFocus = false,
  variant = 'default',
}: InputAreaProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState(value)
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)

  const handleInput = useCallback(
    (e: { detail: { value?: string } }) => {
      const v = (e.detail.value || '').slice(0, maxLength)
      setText(v)
    },
    [maxLength],
  )

  const handleSend = useCallback(() => {
    const v = text.trim()
    if (!v || disabled) return
    onSend?.(v)
    setText('')
    setShowEmoji(false)
  }, [text, disabled, onSend])

  const handleEmojiPick = useCallback(
    (emoji: string) => {
      setText((prev) => (prev + emoji).slice(0, maxLength))
    },
    [maxLength],
  )

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'text' ? 'voice' : 'text'))
    setShowEmoji(false)
  }, [])

  const toggleEmoji = useCallback(() => {
    setShowEmoji((s) => !s)
    Taro.hideKeyboard()
  }, [])

  const handleUpload = useCallback(async () => {
    try {
      const imgRes = await Taro.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      const files = Array.isArray(imgRes.tempFilePaths) ? imgRes.tempFilePaths : []
      if (files.length) onUpload?.(files)
    } catch (err) {
      const msg = String((err as { errMsg?: string })?.errMsg || '').toLowerCase()
      if (!msg.includes('cancel')) {
        try {
          const fileRes = await Taro.chooseMessageFile({ count: 9, type: 'file' })
          const files = (fileRes.tempFiles || []).map((f: { path: string }) => f.path)
          if (files.length) onUpload?.(files)
        } catch {
          /* 用户取消 */
        }
      }
    }
  }, [onUpload])

  const handleVoiceStart = useCallback(() => {
    if (disabled) return
    setRecording(true)
    voiceRecorder.init()
    voiceRecorder.startRecording()
    onVoicePress?.()
  }, [disabled, onVoicePress])

  const handleVoiceEnd = useCallback(async () => {
    if (!recording) return
    setRecording(false)
    const filePath = await voiceRecorder.stopRecording()
    onVoiceRelease?.(filePath)
  }, [recording, onVoiceRelease])

  const handleVoiceCancel = useCallback(() => {
    if (!recording) return
    setRecording(false)
    voiceRecorder.cancelRecording()
  }, [recording])

  const canSend = text.trim().length > 0 && !disabled

  if (variant === 'ai-home') {
    // ===== ai-home 模式:对齐原项目 .input-area(padding 20rpx + bg #E6F3FA + 圆角 30rpx + send-btn 100rpx×100rpx 圆角 30rpx)=====
    return (
      <View
        className="bg-card"
        style={{
          padding: '20rpx',
          paddingBottom: 'calc(20rpx + env(safe-area-inset-bottom))',
          display: 'flex',
          gap: '20rpx',
          zIndex: 2,
        }}
      >
        {showEmoji ? (
          <ScrollView scrollY style={{ height: '180rpx', marginBottom: '10rpx', flexBasis: '100%' }}>
            <View className="flex flex-wrap" style={{ padding: '10rpx' }}>
              {EMOJI_LIST.map((e, i) => (
                <View
                  key={i}
                  className="flex items-center justify-center"
                  style={{ width: '60rpx', height: '60rpx', fontSize: '32rpx' }}
                  onClick={() => handleEmojiPick(e)}
                >
                  <Text>{e}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {/* 切换按钮(语音/文字)*/}
        <View
          className="flex items-center justify-center"
          style={{ width: '60rpx', height: '80rpx', flexShrink: 0 }}
          onClick={toggleMode}
        >
          <Text style={{ fontSize: '36rpx', color: mode === 'voice' ? 'var(--color-primary)' : 'var(--color-muted-foreground)' }}>
            {mode === 'text' ? '🎤' : '⌨️'}
          </Text>
        </View>

        {mode === 'text' ? (
          <View
            className="flex-1 flex items-center"
            style={{
              height: '80rpx',
              padding: '0 30rpx',
              background: 'var(--color-input-bg, #E6F3FA)',
              borderRadius: '30rpx',
            }}
          >
            <Textarea
              className="w-full"
              style={{
                fontSize: '30rpx',
                color: 'var(--color-foreground)',
                minHeight: '40rpx',
                maxHeight: '200rpx',
                background: 'transparent',
              }}
              value={text}
              placeholder={placeholder || t('ai.inputArea.placeholder')}
              placeholderClass="text-muted-foreground"
              placeholderStyle="color: var(--color-muted-foreground); font-size: 28rpx;"
              maxlength={maxLength}
              autoFocus={autoFocus}
              autoHeight
              onInput={handleInput}
              onConfirm={handleSend}
              confirmType="send"
              cursorSpacing={20}
              adjustPosition
              disabled={disabled}
            />
          </View>
        ) : (
          <View
            className={cn(
              'flex-1 flex items-center justify-center',
              recording ? 'text-destructive' : '',
            )}
            style={{
              height: '80rpx',
              borderRadius: '30rpx',
              background: recording ? 'rgba(255, 0, 0, 0.1)' : 'var(--color-input-bg, #E6F3FA)',
              color: recording ? 'var(--color-destructive)' : 'var(--color-foreground)',
              fontSize: '28rpx',
            }}
            onTouchStart={handleVoiceStart}
            onTouchEnd={handleVoiceEnd}
            onTouchCancel={handleVoiceCancel}
          >
            <Text>
              {recording ? t('ai.inputArea.releaseToSend') : t('ai.inputArea.holdToSpeak')}
            </Text>
          </View>
        )}

        {/* 表情 + 附件按钮 */}
        {mode === 'text' ? (
          <View
            className="flex items-center justify-center"
            style={{ width: '60rpx', height: '80rpx', flexShrink: 0 }}
            onClick={toggleEmoji}
          >
            <Text style={{ fontSize: '36rpx', color: showEmoji ? 'var(--color-primary)' : 'var(--color-muted-foreground)' }}>
              😊
            </Text>
          </View>
        ) : null}
        <View
          className="flex items-center justify-center"
          style={{ width: '60rpx', height: '80rpx', flexShrink: 0 }}
          onClick={handleUpload}
        >
          <Text style={{ fontSize: '36rpx', color: 'var(--color-muted-foreground)' }}>📎</Text>
        </View>

        {/* 发送按钮:对齐原项目 .send-btn 100rpx×100rpx 圆角 30rpx(在小屏可压缩到 80rpx)*/}
        {mode === 'text' ? (
          <View
            className="flex items-center justify-center"
            style={{
              width: '100rpx',
              height: '80rpx',
              borderRadius: '30rpx',
              background: canSend ? 'var(--color-primary)' : 'var(--color-muted)',
              color: canSend ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
              fontSize: '32rpx',
              flexShrink: 0,
            }}
            onClick={handleSend}
          >
            <Text style={{ color: 'inherit' }}>
              {canSend ? '➤' : ''}
            </Text>
          </View>
        ) : null}
      </View>
    )
  }

  // ===== default 模式:兼容旧调用 =====
  return (
    <View className="bg-card safe-area-bottom mt-2">
      {showEmoji ? (
        <ScrollView scrollY className="h-48 mb-2">
          <View className="flex flex-wrap p-2">
            {EMOJI_LIST.map((e, i) => (
              <View
                key={i}
                className="w-11 h-11 flex items-center justify-center text-2xl active:bg-muted"
                onClick={() => handleEmojiPick(e)}
              >
                <Text>{e}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      <View className="flex items-end px-3 py-2">
        <View className="flex items-center mr-2">
          <Text
            className={`w-9 h-9 leading-9 text-center text-xl rounded-lg active:bg-muted ${mode === 'voice' ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={toggleMode}
          >
            {mode === 'text' ? '🎤' : '⌨️'}
          </Text>
        </View>

        {mode === 'text' ? (
          <View className="flex-1 min-h-10 bg-muted rounded-2xl px-3 py-2">
            <Textarea
              className="w-full text-sm text-foreground dark:text-muted-foreground bg-transparent"
              style={{ minHeight: '40rpx', maxHeight: '200rpx' }}
              value={text}
              placeholder={placeholder || t('ai.inputArea.placeholder')}
              placeholderClass="text-muted-foreground"
              maxlength={maxLength}
              autoFocus={autoFocus}
              autoHeight
              onInput={handleInput}
              onConfirm={handleSend}
              confirmType="send"
              cursorSpacing={20}
              adjustPosition
              disabled={disabled}
            />
            <View className="text-right text-xs text-muted-foreground mt-1">
              <Text>
                {text.length}/{maxLength}
              </Text>
            </View>
          </View>
        ) : (
          <View
            className={`flex-1 min-h-10 mx-2 rounded-2xl flex items-center justify-center text-sm ${recording ? 'bg-red-100 text-destructive' : 'bg-muted text-foreground dark:text-muted-foreground'}`}
            onTouchStart={handleVoiceStart}
            onTouchEnd={handleVoiceEnd}
            onTouchCancel={handleVoiceCancel}
          >
            <Text>
              {recording ? t('ai.inputArea.releaseToSend') : t('ai.inputArea.holdToSpeak')}
            </Text>
          </View>
        )}

        <View className="flex items-center ml-2">
          {mode === 'text' ? (
            <Text
              className={`w-9 h-9 leading-9 text-center text-xl rounded-lg active:bg-muted ${showEmoji ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={toggleEmoji}
            >
              😊
            </Text>
          ) : null}
          <Text
            className="w-9 h-9 leading-9 text-center text-xl rounded-lg ml-1 text-muted-foreground active:bg-muted"
            onClick={handleUpload}
          >
            📎
          </Text>
        </View>

        {mode === 'text' ? (
          <View
            className={`ml-2 px-4 h-9 leading-9 rounded-lg text-sm ${canSend ? 'bg-primary text-white active:bg-primary' : 'bg-muted text-muted-foreground'}`}
            onClick={handleSend}
          >
            <Text>{t('ai.inputArea.send')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
