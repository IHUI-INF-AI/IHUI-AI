import { View, Text, Textarea, ScrollView, Image, Video } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
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
  /** 受控值(必填,父组件管理) */
  value: string
  /** 输入回调(替代内部 text state) */
  onInput?: (text: string) => void
  placeholder?: string
  onSend?: (text: string) => void
  onVoicePress?: () => void
  onVoiceRelease?: (filePath: string) => void
  onUpload?: (files: string[]) => void
  onRemoveImage?: (index: number) => void
  imgsList?: InputFileItem[]
  /** 仅禁用发送按钮,不禁用 textarea */
  disabled?: boolean
  maxLength?: number
  autoFocus?: boolean
  /** 样式变体:'default'(旧)/ 'ai-home'(首页专用,对齐原项目 .input-area) */
  variant?: 'default' | 'ai-home'
  onFocus?: () => void
  onBlur?: () => void
  onKeyboardHeightChange?: (height: number) => void
  /** 放大态变化通知父组件 */
  onFangdaChange?: (active: boolean) => void
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
 * InputArea 输入区(受控组件模式)
 *
 * 两种 variant:
 * - 'default'(默认):Tailwind bg-muted 输入框,无发送按钮显式宽度
 * - 'ai-home'(首页专用):对齐原项目 .input-area:
 *   - padding 20rpx + padding-bottom calc(20rpx + env(safe-area-inset-bottom))
 *   - 输入框:bg #E6F3FA + 圆角 30rpx + 高度 80rpx + padding 0 30rpx + 字号 30rpx + 颜色 #333
 *   - 发送按钮:100rpx×100rpx + 圆角 30rpx + 居中显示发送图标
 */
export default function InputArea({
  value,
  placeholder,
  onInput,
  onSend,
  onVoicePress,
  onVoiceRelease,
  onUpload,
  disabled = false,
  maxLength = 50000,
  autoFocus = false,
  variant = 'default',
  imgsList,
  onRemoveImage,
  onFocus,
  onBlur,
  onKeyboardHeightChange,
  onFangdaChange,
}: InputAreaProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('text')
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const [isShowIcon, setIsShowIcon] = useState(false) // 加号旋转
  const [isFangdaActive, setIsFangdaActive] = useState(false) // 全屏放大
  const [inputBottom, setInputBottom] = useState(0) // 键盘高度(px)
  const [isamplify, setIsamplify] = useState(false) // 放大按钮阈值

  // mount 时查询 .search-input 高度初始化 isamplify(对齐原项目 mounted 逻辑)
  useEffect(() => {
    const query = Taro.createSelectorQuery()
    query.select('.search-input').boundingClientRect()
    query.exec((res) => {
      const h = (res?.[0] as { height?: number })?.height || 0
      setIsamplify(h > 88)
    })
  }, [])

  const handleInput = useCallback(
    (e: { detail: { value?: string } }) => {
      const v = (e.detail.value || '').slice(0, maxLength)
      onInput?.(v)
      setTimeout(() => {
        const query = Taro.createSelectorQuery()
        query.select('.search-input').boundingClientRect()
        query.exec((res) => {
          const h = (res?.[0] as { height?: number })?.height || 0
          setIsamplify(h > 88)
        })
      }, 50)
    },
    [maxLength, onInput],
  )

  // 清空输入(仅清空,不触发发送)
  const handleClear = useCallback(() => {
    onInput?.('')
  }, [onInput])

  // 切换放大(通知父组件放大态变化)
  const toggleFangda = useCallback(() => {
    setIsFangdaActive((prev) => {
      const next = !prev
      onFangdaChange?.(next)
      return next
    })
  }, [onFangdaChange])

  // 删除附件
  const handleRemoveImage = useCallback(
    (index: number) => {
      onRemoveImage?.(index)
    },
    [onRemoveImage],
  )

  // 加号旋转 + 取消后回退(成功选图后保持 isShowIcon,仅用户取消时回退)
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
        /* 用户取消:回退加号旋转 */
        setIsShowIcon(false)
      }
    }
  }, [onUpload])

  // 键盘高度自管(e.detail.height 单位为 px)
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
    }, 150)
  }, [onBlur])

  const handleKeyboardHeightChange = useCallback(
    (e: { detail: { height: number } }) => {
      const h = e.detail.height || 0
      setInputBottom(h)
      onKeyboardHeightChange?.(h)
    },
    [onKeyboardHeightChange],
  )

  // 全屏放大样式(对齐原项目 .input_area_active:top:120rpx bottom:112rpx)
  // 放大态 + isShowIcon 时 bottom:292rpx(对齐 .textarea_input_isShowIcon)
  const fangdaStyle: CSSProperties = isFangdaActive
    ? {
        position: 'fixed',
        top: '120rpx',
        left: 0,
        right: 0,
        bottom: isShowIcon ? '292rpx' : '112rpx',
        zIndex: 999,
        background: 'var(--color-card)',
        padding: '0',
      }
    : {}

  const handleSend = useCallback(() => {
    const v = value.trim()
    if (!v || disabled) return
    onSend?.(v)
    onInput?.('')
    setShowEmoji(false)
  }, [value, disabled, onSend, onInput])

  const handleEmojiPick = useCallback(
    (emoji: string) => {
      onInput?.((value + emoji).slice(0, maxLength))
    },
    [value, maxLength, onInput],
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

  const canSend = value.trim().length > 0 && !disabled

  if (variant === 'ai-home') {
    // ===== ai-home 模式:三层嵌套,完全对齐原项目 InputArea.vue 结构 =====
    // .input-area > .input-area-back > .search-box.search-box-bor > .search-box-inner
    // search-box-inner 内:search-box1(语音) + textarea/voice-bar + 放大/缩小按钮 + 占位 search-right + 可见 search-right
    //
    // 动态 padding(对标原项目 textareaPadding,非 iOS 分支):
    // - 放大态:由 CSS .textarea-input 控制,不设 padding
    // - 长文本(isamplify):12rpx 38rpx 82rpx 0(右侧 38rpx 放大按钮 + 底部 82rpx 图标组)
    // - 短文本:12rpx 134rpx 12rpx 44rpx(右侧 134rpx 图标组 + 左侧 44rpx 语音按钮)
    const textareaPadding = isFangdaActive
      ? '0'
      : isamplify
        ? '12rpx 38rpx 82rpx 0'
        : '12rpx 134rpx 12rpx 44rpx'

    return (
      <View
        className={cn(
          'input-area',
          isFangdaActive ? 'input-area-active' : '',
          isShowIcon && isFangdaActive ? 'textarea-input-isShowIcon' : '',
        )}
        style={{
          bottom: `${inputBottom}px`,
          padding: '10rpx 20rpx 20rpx',
          ...fangdaStyle,
        } as CSSProperties}
      >
        {/* 第二层:input-area-back 白底呼吸阴影(对标原项目 .input-area-back inputAreaBackAnimation) */}
        <View
          className={isFangdaActive ? 'input-area-back input-area-active-bg' : 'input-area-back'}
          style={{ width: '100%' }}
        >
          {/* 第三层:search-box search-box-bor 紫色描边圆角容器(对标原项目 .search-box.search_box_bor) */}
          <View
            className={cn(
              'search-box',
              'search-box-bor',
              isFangdaActive ? 'search-box-active' : '',
            )}
            style={{
              backgroundColor: recording ? '#ECEDFC' : '#fff',
            }}
          >
            {/* 附件列表 imgs-list(对标原项目 .imgs_list,横向滚动,底部 1px 灰线分隔) */}
            {imgsList && imgsList.length > 0 ? (
              <ScrollView scrollX className="imgs-list" style={{ flexBasis: '100%' }}>
                {imgsList.map((item, index) => (
                  <View key={`img-${index}-${item.imgUrl}`} className="imgs-list-item">
                    <Image
                      src={closeInputPng}
                      className="imgs-list-close"
                      mode="widthFix"
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

            {/* 表情面板(保留) */}
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

            {/* 内层 search-box(语音/文字输入区,对标原项目 .search-box.search-boxa) */}
            <View
              className="search-box-inner"
              style={{
                position: 'relative',
                display: 'flex',
                padding: 0,
                background: 'transparent',
                width: '100%',
              }}
            >
              {/* 语音切换按钮 search-box1:50rpx×44rpx */}
              <View
                className={cn('search-box1', mode === 'voice' ? 'active' : '')}
                style={{
                  width: '50rpx',
                  height: '44rpx',
                  display: 'flex',
                  alignItems: 'center',
                  flex: 'none',
                  marginRight: recording ? '0' : '20rpx',
                }}
                onClick={toggleMode}
              >
                <Image
                  className="search-box1-img"
                  src={recording ? inputQiePng : searchHuaPng}
                  style={{
                    width: recording ? '50rpx' : '38rpx',
                    height: recording ? '30rpx' : '40rpx',
                  }}
                  mode="widthFix"
                />
              </View>

              {/* textarea search-input 或 语音波形动画 */}
              {mode === 'text' ? (
                <Textarea
                  className={cn(
                    'search-input',
                    isFangdaActive ? 'textarea-input' : '',
                    !isamplify && !isFangdaActive ? 'textarea-int' : '',
                  )}
                  style={{
                    position: recording ? 'absolute' : 'relative',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: recording ? -1 : 1,
                    maxHeight: isFangdaActive ? 'none' : '500rpx',
                    padding: textareaPadding,
                    fontSize: '36rpx',
                    color: 'rgba(0, 0, 0)',
                    lineHeight: '40rpx',
                    flex: 1,
                    minHeight: '44rpx',
                  } as CSSProperties}
                  value={value}
                  placeholder={placeholder || t('ai.inputArea.placeholder')}
                  placeholderStyle="color: #999999; font-size: 28rpx;"
                  maxlength={maxLength}
                  autoFocus={autoFocus}
                  autoHeight
                  onInput={handleInput}
                  onConfirm={handleSend}
                  confirmType="send"
                  // 原项目 cursor-spacing="44px";Taro Textarea cursorSpacing 类型为 number(单位 px),44 即 44px
                  cursorSpacing={44}
                  adjustPosition={false}
                  disabled={recording}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyboardHeightChange={handleKeyboardHeightChange}
                />
              ) : (
                /* 语音波形动画 voice-bar-animation:30 根线,recording 时添加 line1~line30 类名触发动画 */
                <View
                  style={{ flex: 1, display: 'flex', alignItems: 'center' }}
                  onTouchStart={handleVoiceStart}
                  onTouchEnd={handleVoiceEnd}
                  onTouchCancel={handleVoiceCancel}
                >
                  <View className="voice-bar-animation">
                    {Array.from({ length: 30 }).map((_, n) => (
                      <View
                        key={n}
                        className={cn('line', recording ? `line${n + 1}` : '')}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* 放大按钮(对标原项目 isamplify && !isVoiceAnimationActive && !isFangdaActive)
                  位置:absolute right:0 top:12rpx 40×40 z-index:2,图标 48×48 widthFix */}
              {mode === 'text' && isamplify && !recording && !isFangdaActive ? (
                <View
                  className="search-right"
                  style={{
                    position: 'absolute',
                    justifyContent: 'flex-end',
                    right: 0,
                    top: '12rpx',
                    width: '40rpx',
                    height: '40rpx',
                    zIndex: 2,
                  }}
                >
                  <View className="search-box3">
                    <Image
                      className="search-box3-img"
                      src={fangdaPng}
                      style={{ width: '48rpx', height: '48rpx' }}
                      mode="widthFix"
                      onClick={toggleFangda}
                    />
                  </View>
                </View>
              ) : null}

              {/* 缩小按钮(对标原项目 isFangdaActive,含 search_suo 类)
                  位置:absolute right:0 top:12rpx 40×40 z-index:2,图标 48×48 widthFix */}
              {mode === 'text' && isFangdaActive ? (
                <View
                  className="search-right search-suo"
                  style={{
                    position: 'absolute',
                    justifyContent: 'flex-end',
                    right: 0,
                    top: '12rpx',
                    width: '40rpx',
                    height: '40rpx',
                    zIndex: 2,
                  }}
                >
                  <View className="search-box3">
                    <Image
                      className="search-box3-img"
                      src={suoxiaoPng}
                      style={{ width: '48rpx', height: '48rpx' }}
                      mode="widthFix"
                      onClick={toggleFangda}
                    />
                  </View>
                </View>
              ) : null}

              {/* 占位 search-right(opacity:0 + pointerEvents:none):撑开 textarea 宽度避让右侧图标(对标原项目 line 119-149) */}
              <View
                className="search-right"
                style={{ position: 'relative', opacity: 0, pointerEvents: 'none' }}
              >
                <View className="search-box2">
                  <Image
                    className={cn('search-box2-img', isShowIcon ? 'rotate-icon' : '')}
                    src={searchAddPng}
                  />
                </View>
                <View className="search-box3">
                  {mode === 'text' && value.length > 0 ? (
                    <Image
                      className="search-box3-img"
                      src={closeChatPng}
                      style={{ width: '50rpx', height: '50rpx', marginRight: '10rpx' }}
                    />
                  ) : null}
                  <Image
                    className="search-box3-img"
                    src={sandMsgPng}
                    style={{ width: '50rpx', height: '50rpx', marginLeft: '18rpx' }}
                    mode="widthFix"
                  />
                </View>
              </View>

              {/* 可见 search-right:绝对定位 right:6rpx bottom:calc(50% - 26rpx) */}
              <View
                className="search-right"
                style={{
                  position: 'absolute',
                  right: '6rpx',
                  bottom: 'calc(50% - 26rpx)',
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                  zIndex: 2,
                }}
              >
                {/* 附件按钮 search-box2:44rpx×44rpx,默认可见,isShowIcon 只控制旋转 */}
                <View className="search-box2" onClick={handleUploadToggle}>
                  <Image
                    className={cn('search-box2-img', isShowIcon ? 'rotate-icon' : '')}
                    src={searchAddPng}
                  />
                </View>

                {/* 清空 + 发送 search-box3 */}
                <View className="search-box3">
                  {/* 清空按钮 close_chat.png 50rpx×50rpx marginRight 10rpx */}
                  {mode === 'text' && value.length > 0 ? (
                    <Image
                      className="search-box3-img"
                      src={closeChatPng}
                      style={{ width: '50rpx', height: '50rpx', marginRight: '10rpx' }}
                      onClick={handleClear}
                    />
                  ) : null}

                  {/* 发送按钮 sand_msg.png 50rpx×50rpx marginLeft 18rpx(纯图标无背景容器) */}
                  <Image
                    className="search-box3-img"
                    src={sandMsgPng}
                    style={{ width: '50rpx', height: '50rpx', marginLeft: '18rpx' }}
                    mode="widthFix"
                    onClick={handleSend}
                  />
                </View>
              </View>
            </View>
          </View>
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
              value={value}
              placeholder={placeholder || t('ai.inputArea.placeholder')}
              placeholderStyle="color: #999999; font-size: 28rpx;"
              maxlength={maxLength}
              autoFocus={autoFocus}
              autoHeight
              onInput={handleInput}
              onConfirm={handleSend}
              confirmType="send"
              cursorSpacing={20}
              adjustPosition
              disabled={recording}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyboardHeightChange={handleKeyboardHeightChange}
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
