import { View, Text, Textarea, ScrollView, Image, Video } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import voiceRecorder from '@/utils/voice-recorder'
import { useI18n } from '@/i18n'
import { cn } from '@ihui/design-tokens'
// ai-home 模式图标(对齐原项目 InputArea.vue):
// search-hua(文字模式切语音)/ input_qie(语音模式切文字)/ search-add(附件)/ sand_msg(发送)
import searchHuaPng from '@/assets/remote/images/search-hua.png'
import inputQiePng from '@/assets/remote/images/input_qie.png'
import searchAddPng from '@/assets/remote/images/search-add.png'
import sandMsgPng from '@/assets/remote/images/sand_msg.png'
// 附件回显/全屏放大/清空按钮图标
import closeChatPng from '@/assets/remote/images/close_chat.png'
import fangdaPng from '@/assets/remote/images/fangda.png'
import suoxiaoPng from '@/assets/remote/images/suoxiao.png'
import closeInputPng from '@/assets/remote/images/close_input.png'
import filePng from '@/assets/remote/images/file.png'

export interface InputFileItem {
  imgUrl: string
  fileType?: 'image' | 'document' | 'video' | 'audio' | 'file'
  filename?: string
  video_url?: string
}

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
  imgsList?: InputFileItem[]
  onRemoveImage?: (index: number) => void
  onFocus?: () => void
  onBlur?: () => void
  onKeyboardHeightChange?: (height: number) => void
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
  imgsList,
  onRemoveImage,
  onFocus,
  onBlur,
  onKeyboardHeightChange,
}: InputAreaProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('text')
  const [text, setText] = useState(value)
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const [isShowIcon, setIsShowIcon] = useState(false) // 加号旋转
  const [isFangdaActive, setIsFangdaActive] = useState(false) // 全屏放大
  const [inputBottom, setInputBottom] = useState(0) // 键盘高度
  const [isamplify, setIsamplify] = useState(false) // 放大按钮阈值

  const handleInput = useCallback(
    (e: { detail: { value?: string } }) => {
      const v = (e.detail.value || '').slice(0, maxLength)
      setText(v)
      setTimeout(() => {
        const query = Taro.createSelectorQuery()
        query.select('.search-input').boundingClientRect()
        query.exec((res) => {
          const h = (res?.[0] as { height?: number })?.height || 0
          setIsamplify(h > 88)
        })
      }, 50)
    },
    [maxLength],
  )

  // 清空输入
  const handleClear = useCallback(() => {
    setText('')
    onSend?.('')
  }, [onSend])

  // 切换放大
  const toggleFangda = useCallback(() => {
    setIsFangdaActive((v) => !v)
  }, [])

  // 删除附件
  const handleRemoveImage = useCallback(
    (index: number) => {
      onRemoveImage?.(index)
    },
    [onRemoveImage],
  )

  // 加号旋转 + 取消后回退
  const handleUploadToggle = useCallback(async () => {
    setIsShowIcon((v) => !v)
    try {
      const imgRes = await Taro.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      const files = Array.isArray(imgRes.tempFilePaths) ? imgRes.tempFilePaths : []
      if (files.length) onUpload?.(files)
    } catch {
      try {
        const fileRes = await Taro.chooseMessageFile({ count: 9, type: 'file' })
        const files = (fileRes.tempFiles || []).map((f: { path: string }) => f.path)
        if (files.length) onUpload?.(files)
      } catch {
        /* 用户取消 */
      }
    } finally {
      setIsShowIcon(false)
    }
  }, [onUpload])

  // 键盘高度自管
  const handleFocus = useCallback(
    (e?: { detail: { height?: number } }) => {
      const h = e?.detail?.height || 0
      if (h > 0) setInputBottom(h)
      onFocus?.()
    },
    [onFocus],
  )

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setInputBottom(0)
      onBlur?.()
    }, 800)
  }, [onBlur])

  const handleKeyboardHeightChange = useCallback(
    (e: { detail: { height: number } }) => {
      const h = e.detail.height || 0
      setInputBottom(h)
      onKeyboardHeightChange?.(h)
    },
    [onKeyboardHeightChange],
  )

  // 全屏放大样式
  const fangdaStyle: CSSProperties = isFangdaActive
    ? {
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top) + 88rpx)',
        left: 0,
        right: 0,
        bottom: 'calc(env(safe-area-inset-bottom) + 112rpx)',
        zIndex: 999,
        background: 'var(--color-card)',
        padding: '20rpx',
      }
    : {}

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
        className={cn('bg-card', isFangdaActive ? 'input-area-active' : 'input-area-back')}
        style={{
          padding: '20rpx',
          paddingBottom: 'calc(20rpx + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: '8rpx',
          zIndex: 2,
          position: inputBottom > 0 ? 'fixed' : 'static',
          left: 0,
          right: 0,
          bottom: inputBottom > 0 ? `${inputBottom}px` : 'auto',
          transition: 'bottom 0.25s ease',
          ...fangdaStyle,
        }}
      >
        {showEmoji ? (
          <ScrollView
            scrollY
            style={{ height: '180rpx', marginBottom: '10rpx', flexBasis: '100%' }}
          >
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

        {/* 附件回显区 */}
        {imgsList && imgsList.length > 0 ? (
          <ScrollView scrollX className="imgs-list" style={{ flexBasis: '100%' }}>
            {imgsList.map((item, index) => (
              <View key={`img-${index}-${item.imgUrl}`} className="imgs-list-item">
                <Image
                  src={closeInputPng}
                  className="imgs-list-close"
                  mode="aspectFit"
                  onClick={() => handleRemoveImage(index)}
                />
                {item.fileType === 'document' ? (
                  <View style={{ position: 'relative', width: '120rpx', height: '120rpx' }}>
                    <Image src={filePng} className="imgs-list-item-img" mode="aspectFill" />
                    {item.filename ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          bottom: 0,
                          right: 0,
                          zIndex: 1,
                          overflow: 'hidden',
                          height: '32rpx',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <View className="scroll-container">
                          <View className="scroll-content">
                            <Text>{item.filename}</Text>
                            <Text className="scroll-separator"> </Text>
                            <Text>{item.filename}</Text>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : item.fileType === 'video' || item.video_url ? (
                  <Video
                    src={item.video_url || ''}
                    poster={item.imgUrl}
                    showCenterPlayBtn={false}
                    showPlayBtn={false}
                    enableProgressGesture={false}
                    controls={false}
                    autoplay={false}
                    showFullscreenBtn={false}
                    objectFit="contain"
                    style={{ width: '213rpx', height: '120rpx', borderRadius: '15rpx' }}
                  />
                ) : (
                  <Image src={item.imgUrl} className="imgs-list-item-img" mode="heightFix" />
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}

        {/* 切换按钮(语音/文字):对齐原项目 InputArea.vue line 40-44
            文字模式显示 search-hua(切语音)/ 语音模式显示 input_qie(切文字)*/}
        <View style={{ display: 'flex', gap: '8rpx', width: '100%', alignItems: 'center' }}>
          <View
            className="flex items-center justify-center"
            style={{ width: '60rpx', height: '80rpx', flexShrink: 0 }}
            onClick={toggleMode}
          >
            <Image
              src={mode === 'text' ? searchHuaPng : inputQiePng}
              style={{ width: '50rpx', height: '40rpx' }}
              mode="aspectFit"
            />
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
                className={cn('w-full search-input', isFangdaActive ? 'textarea-input' : '')}
                style={{
                  fontSize: '36rpx',
                  color: 'var(--color-foreground)',
                  minHeight: '40rpx',
                  maxHeight: isFangdaActive ? 'none' : '500rpx',
                  background: 'transparent',
                }}
                value={text}
                placeholder={placeholder || t('ai.inputArea.placeholder')}
                placeholderClass="text-muted-foreground"
                placeholderStyle="color: var(--color-muted-foreground); font-size: 32rpx;"
                maxlength={maxLength}
                autoFocus={autoFocus}
                autoHeight
                onInput={handleInput}
                onConfirm={handleSend}
                confirmType="send"
                cursorSpacing={44}
                adjustPosition={false}
                disabled={disabled}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyboardHeightChange={handleKeyboardHeightChange}
              />
            </View>
          ) : (
            <View
              className={cn(
                'flex-1 flex items-center justify-center',
                recording ? 'voice-anim-active' : '',
              )}
              style={{
                height: '80rpx',
                borderRadius: '30rpx',
                background: recording ? '#ECEDFC' : 'var(--color-input-bg, #E6F3FA)',
                padding: '0 30rpx',
              }}
              onTouchStart={handleVoiceStart}
              onTouchEnd={handleVoiceEnd}
              onTouchCancel={handleVoiceCancel}
            >
              {recording ? (
                <View className="voice-bar-animation">
                  {Array.from({ length: 30 }).map((_, n) => (
                    <View key={n} className="line" />
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: '28rpx', color: 'var(--color-foreground)' }}>
                  {t('ai.inputArea.holdToSpeak')}
                </Text>
              )}
            </View>
          )}

          {/* 表情按钮 */}
          {mode === 'text' ? (
            <View
              className="flex items-center justify-center"
              style={{ width: '60rpx', height: '80rpx', flexShrink: 0 }}
              onClick={toggleEmoji}
            >
              <Text
                style={{
                  fontSize: '36rpx',
                  color: showEmoji ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                }}
              >
                😊
              </Text>
            </View>
          ) : null}

          {/* 清空按钮(有文字时显示) */}
          {mode === 'text' && text.length > 0 ? (
            <View
              className="flex items-center justify-center"
              style={{ width: '60rpx', height: '80rpx', flexShrink: 0 }}
              onClick={handleClear}
            >
              <Image
                src={closeChatPng}
                style={{ width: '50rpx', height: '50rpx' }}
                mode="aspectFit"
              />
            </View>
          ) : null}

          {/* 放大/缩小按钮(textarea 高度 > 88rpx 或已放大时显示) */}
          {mode === 'text' && (isamplify || isFangdaActive) ? (
            <View
              className="flex items-center justify-center"
              style={{ width: '60rpx', height: '80rpx', flexShrink: 0 }}
              onClick={toggleFangda}
            >
              <Image
                src={isFangdaActive ? suoxiaoPng : fangdaPng}
                style={{ width: '50rpx', height: '50rpx' }}
                mode="aspectFit"
              />
            </View>
          ) : null}

          {/* 附件按钮(加号旋转) */}
          <View
            className="flex items-center justify-center"
            style={{ width: '60rpx', height: '80rpx', flexShrink: 0 }}
            onClick={handleUploadToggle}
          >
            <Image
              src={searchAddPng}
              className={cn('search-add-icon', isShowIcon ? 'rotate-icon' : '')}
              style={{ width: '50rpx', height: '50rpx' }}
              mode="aspectFit"
            />
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
                color: canSend
                  ? 'var(--color-primary-foreground)'
                  : 'var(--color-muted-foreground)',
                fontSize: '32rpx',
                flexShrink: 0,
              }}
              onClick={handleSend}
            >
              {canSend ? (
                <Image
                  src={sandMsgPng}
                  style={{ width: '50rpx', height: '50rpx' }}
                  mode="aspectFit"
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    )
  }

  // ===== default 模式:兼容旧调用(适配父容器 column 布局,占满宽度)=====
  return (
    <View className="w-full">
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

      <View className="flex items-center w-full">
        <View className="flex items-center mr-2 flex-shrink-0">
          <View
            className={`w-9 h-9 flex items-center justify-center rounded-lg active:bg-muted ${mode === 'voice' ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={toggleMode}
          >
            <Image
              src={mode === 'text' ? searchHuaPng : inputQiePng}
              className="w-5 h-5"
              mode="aspectFit"
            />
          </View>
        </View>

        {mode === 'text' ? (
          <View className="flex-1 min-h-10 bg-muted rounded-2xl px-3 py-2 flex items-center">
            <Textarea
              className="w-full text-sm text-foreground dark:text-muted-foreground bg-transparent"
              style={{ minHeight: '40rpx', maxHeight: '200rpx', width: '100%' }}
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

        <View className="flex items-center ml-2 flex-shrink-0">
          {mode === 'text' ? (
            <Text
              className={`w-9 h-9 leading-9 text-center text-xl rounded-lg active:bg-muted ${showEmoji ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={toggleEmoji}
            >
              😊
            </Text>
          ) : null}
          <View
            className="w-9 h-9 flex items-center justify-center rounded-lg ml-1 text-muted-foreground active:bg-muted"
            onClick={handleUploadToggle}
          >
            <Image src={searchAddPng} className="w-5 h-5" mode="aspectFit" />
          </View>
        </View>

        {mode === 'text' ? (
          <View
            className={`ml-2 px-4 h-9 leading-9 rounded-lg text-sm flex-shrink-0 ${canSend ? 'bg-primary text-white active:bg-primary' : 'bg-muted text-muted-foreground'}`}
            onClick={handleSend}
          >
            <Text>{t('ai.inputArea.send')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
