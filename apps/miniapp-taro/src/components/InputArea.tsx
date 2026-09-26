// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Textarea, ScrollView, Image, Video } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { useUiField } from '@/lib/ui-field-registry'
import type { CSSProperties } from 'react'
import voiceRecorder from '@/utils/voice-recorder'
import { cn, rnRadius, TARO_RPX_PER_PX } from '@ihui/design-tokens'
// 放大钮内缩 / 语音钮间距 —— 唯一源在 @ihui/shared/ui/input-area-spec(与 RN 端同档);
// 本文件只做 rpx 换算。两侧的同族裸 6 必须同枚提交进 spec,漏一侧就是台账 +1(上一轮的 23→24)。
import {
  INPUT_AREA_FANGDA_TOP_PX,
  INPUT_AREA_VOICE_BTN_GAP_PX,
  // 票④:ai-home 一侧剩余的可见几何档(逐条裁决依据与"单端档"理由写在 spec 常数注释里)
  INPUT_AREA_DOC_NAME_STRIP_PX,
  INPUT_AREA_AI_HOME_OVERLAY_TOP_PX,
  INPUT_AREA_AI_HOME_OVERLAY_BOTTOM_WITH_PANEL_PX,
  INPUT_AREA_AI_HOME_SEND_ICON_MARGIN_PX,
  INPUT_AREA_AI_HOME_INPUT_MAX_HEIGHT_PX,
  INPUT_AREA_AI_HOME_ICON_BOX_PX,
  INPUT_AREA_AI_HOME_INLINE_GAP_PX,
  INPUT_AREA_AI_HOME_EMOJI_PANEL_H_PX,
  INPUT_AREA_AI_HOME_EMOJI_CELL_PX,
  INPUT_AREA_AI_HOME_VOICE_BTN_W_PX,
  INPUT_AREA_ATTACHMENT_BADGE_FONT_PX,
  INPUT_AREA_ATTACHMENT_BADGE_LINE_PX,
  INPUT_AREA_VIDEO_THUMB_W_PX,
  INPUT_AREA_VIDEO_THUMB_H_PX,
  // 票⑤:图标墨迹档(位图退役后,矢量字形是正方形盒,取数一律经这三枚)
  INPUT_AREA_GLYPH_MD_PX,
  INPUT_AREA_AI_HOME_ADD_GLYPH_PX,
  INPUT_AREA_AI_HOME_EXPAND_GLYPH_PX,
  INPUT_AREA_THUMB_GLYPH_PX,
  INPUT_AREA_ATTACHMENT_CLOSE_GLYPH_PX,
} from '@ihui/shared/ui/input-area-spec'
// O81 票⑤(2026-09-26):本组件原先把 9 个 UI 图标位指向 aizhs.top 的 CDN 位图。
// 位图不能随主题反色、不跟字号缩放、描边粗细与 RN 端不一致,且违反 AGENTS §4
// 「UI 图标一律用矢量图标库」,故按"矢量优先"逐个换成与 RN 端**同一个 lucide 字形**
// (`<LineIcon name="…">`,CSS mask 渲染 ⇒ 随 token 换色)。字形名对照见交付报告。
import LineIcon from '@/components/LineIcon'
import { rpx } from '@/utils/rpx'

/**
 * 几何档 → 本平台数值的唯一换算点(形状同 `components/IntelligentAssistant.tsx`):
 * spec 只存逻辑 px,2 倍 rpx 换算只发生在这一处。
 */
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)

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
  // AI 操控通道(2026-09-21):普通态与全屏放大态两个 Textarea 共用同一个 value + handleInput
  // 受控通道,故只登记一次(两个 id 指向同一真相源反而更含糊)。
  // 只有父组件真的给了 onInput 才登记 —— 没有它"填进去"改变不了任何状态,登记即假成功。
  // 发送按钮属对外发声,不交出 onPress。
  useUiField(
    onInput
      ? {
          kind: 'textarea',
          label: placeholder || t('messageInput.placeholder'),
          placeholder: placeholder || t('messageInput.placeholder'),
          ...(typeof maxLength === 'number' ? { maxLength } : {}),
          readValue: () => value,
          setValue: (next) => onInput(next),
        }
      : null,
  )

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
  // 放大态 + isShowIcon 时底偏移走 spec(=292rpx);基础那支 rpx(112) 留在端内做字面量 ——
  // 56 这一档两端共享(RN 折叠 FAB 盒同为 56),收编它会把共用档变成"仅 RN 档",台账不减反增。
  const fangdaStyle: CSSProperties = isFangdaActive
    ? {
        position: 'fixed',
        top: toUnit(INPUT_AREA_AI_HOME_OVERLAY_TOP_PX),
        left: 0,
        right: 0,
        bottom: isShowIcon ? toUnit(INPUT_AREA_AI_HOME_OVERLAY_BOTTOM_WITH_PANEL_PX) : rpx(112),
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
        style={
          {
            bottom: `${inputBottom}px`,
            padding: '10rpx 20rpx 20rpx',
            top: 'auto',
            ...fangdaStyle,
          } as CSSProperties
        }
      >
        {/* 第二层:input-area-back 白底呼吸阴影(对标原项目 .input-area-back inputAreaBackAnimation)
            放大态:对标原项目 .input_area_back(仅 height:100%,移除 box-shadow + animation) */}
        <View
          className={isFangdaActive ? 'input-area-back input-area-active-bg' : 'input-area-back'}
          style={{
            width: '100%',
            ...(isFangdaActive ? { height: '100%', boxShadow: 'none', animation: 'none' } : {}),
          }}
        >
          {/* 第三层:search-box search-box-bor 紫色描边圆角容器(对标原项目 .search-box.search_box_bor)
              语音模式背景色 #ECEDFC(对标原项目 isVoiceAnimationActive 判断) */}
          <View
            className={cn(
              'search-box',
              'search-box-bor',
              isFangdaActive ? 'search-box-active' : '',
            )}
            style={{
              backgroundColor: mode === 'voice' ? 'var(--color-link-bg)' : 'var(--color-card)',
            }}
          >
            {/* 附件列表 imgs-list(对标原项目 .imgs_list,横向滚动,底部 1px 灰线分隔) */}
            {imgsList && imgsList.length > 0 ? (
              <ScrollView scrollX className="imgs-list" style={{ flexBasis: '100%' }}>
                {imgsList.map((item, index) => (
                  <View key={`img-${index}-${item.imgUrl || index}`} className="imgs-list-item">
                    {/* 删除附件角标:圆形底色与命中盒仍由 .imgs-list-close 类臂负责,
                        里面的叉号换成与 RN `thumbClose` 同一个 lucide 字形(X ⇒ name="x")。 */}
                    <View
                      className="imgs-list-close"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => handleRemoveImage(index)}
                    >
                      <LineIcon name="x" size={toUnit(INPUT_AREA_ATTACHMENT_CLOSE_GLYPH_PX)} />
                    </View>
                    {item.fileType === 'document' && item.filename ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          bottom: 0,
                          right: 0,
                          zIndex: 1,
                          overflow: 'hidden',
                          height: toUnit(INPUT_AREA_DOC_NAME_STRIP_PX),
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
                    {item.fileType === 'video' || item.video_url ? (
                      <View
                        style={{
                          position: 'relative',
                          width: toUnit(INPUT_AREA_VIDEO_THUMB_W_PX),
                          height: toUnit(INPUT_AREA_VIDEO_THUMB_H_PX),
                        }}
                      >
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
                          style={{
                            width: toUnit(INPUT_AREA_VIDEO_THUMB_W_PX),
                            height: toUnit(INPUT_AREA_VIDEO_THUMB_H_PX),
                            borderRadius: rnRadius.lg,
                          }}
                        />
                      </View>
                    ) : item.fileType === 'document' ? (
                      /* 文档缩略占位:与 RN `thumbDoc` 里的 lucide FileText 同字形、
                         同墨迹档(INPUT_AREA_THUMB_GLYPH_PX),占位盒仍是 .imgs-list-item-img 类臂 */
                      <View
                        className="imgs-list-item-img"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <LineIcon name="file-text" size={toUnit(INPUT_AREA_THUMB_GLYPH_PX)} />
                      </View>
                    ) : (
                      <Image src={item.imgUrl} className="imgs-list-item-img" mode="heightFix" />
                    )}
                    {/* 附件类型角标:文档/视频(对齐 messageInput.document/video) */}
                    {item.fileType === 'document' || item.fileType === 'video' ? (
                      <View
                        style={{
                          position: 'absolute',
                          right: 0,
                          bottom: 0,
                          padding: '2rpx 10rpx',
                          fontSize: toUnit(INPUT_AREA_ATTACHMENT_BADGE_FONT_PX),
                          lineHeight: toUnit(INPUT_AREA_ATTACHMENT_BADGE_LINE_PX),
                          background: 'var(--color-scrim)',
                          color: 'var(--color-scrim-foreground)',
                          borderRadius: `${rpx(8)} 0 0 0`,
                        }}
                      >
                        <Text>
                          {item.fileType === 'document'
                            ? t('messageInput.document')
                            : t('messageInput.video')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {/* 表情面板(保留) */}
            {showEmoji ? (
              <ScrollView
                scrollY
                style={{
                  height: toUnit(INPUT_AREA_AI_HOME_EMOJI_PANEL_H_PX),
                  marginBottom: toUnit(INPUT_AREA_AI_HOME_INLINE_GAP_PX),
                  flexBasis: '100%',
                }}
              >
                <View
                  className="flex flex-wrap"
                  style={{ padding: toUnit(INPUT_AREA_AI_HOME_INLINE_GAP_PX) }}
                >
                  {EMOJI_LIST.map((e, i) => (
                    <View
                      key={i}
                      className="flex items-center justify-center"
                      // 字级 rpx(32) 留在端内:16 这一档两端共享(RN 图标墨迹同为 16),
                      // 收进表会把共用档变成"仅 RN 档"(台账不减反增)
                      style={{
                        width: toUnit(INPUT_AREA_AI_HOME_EMOJI_CELL_PX),
                        height: toUnit(INPUT_AREA_AI_HOME_EMOJI_CELL_PX),
                        fontSize: rpx(32),
                      }}
                      onClick={() => handleEmojiPick(e)}
                      hoverClass="opacity-60"
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
                ...(isFangdaActive
                  ? { height: '100%', justifyContent: 'space-between', alignItems: 'flex-end' }
                  : {}),
              }}
            >
              {/* 语音切换按钮 search-box1:50rpx×44rpx */}
              <View
                className={cn('search-box1', mode === 'voice' ? 'active' : '')}
                style={{
                  width: toUnit(INPUT_AREA_AI_HOME_VOICE_BTN_W_PX),
                  // 高度 44rpx(=22)留在端内:22 这一档两端共享(RN 框内放大钮盒同为 22)
                  height: rpx(44),
                  display: 'flex',
                  alignItems: 'center',
                  flex: 'none',
                  marginRight: mode === 'voice' ? '0' : toUnit(INPUT_AREA_VOICE_BTN_GAP_PX),
                }}
                onClick={toggleMode}
                hoverClass="opacity-60"
              >
                {/* 文字态 → 切到语音(lucide Mic)/ 语音态 → 切回文字(lucide Keyboard),
                    与 RN `voiceBtn` 那对 `<Mic size={20}/>` / `<Keyboard size={20}/>` 同字形同墨迹档 */}
                <LineIcon
                  className="search-box1-img"
                  name={mode === 'voice' ? 'keyboard' : 'mic'}
                  size={toUnit(INPUT_AREA_GLYPH_MD_PX)}
                />
              </View>

              {/* textarea search-input(对标原项目 textarea.search-input)
                  始终渲染:语音模式时通过 position:absolute + zIndex:-1 隐藏(对标原项目 disabled 控制逻辑) */}
              <Textarea
                className={cn(
                  'search-input',
                  isFangdaActive ? 'textarea-input' : '',
                  !isamplify && !isFangdaActive ? 'textarea-int' : '',
                )}
                style={
                  {
                    position: mode === 'voice' ? 'absolute' : 'relative',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: mode === 'voice' ? -1 : 1,
                    maxHeight: isFangdaActive
                      ? 'none'
                      : toUnit(INPUT_AREA_AI_HOME_INPUT_MAX_HEIGHT_PX),
                    padding: textareaPadding,
                    // 字号 36rpx(=18)与行高 40rpx(=20)留在端内:两档都两端共享(RN 框外发送钮
                    // 字形/删除角标盒取 18,图标墨迹取 20),把小程序这一侧收进表会把共用档翻成
                    // "仅 RN 档"(台账 23→24 那一型);ai-home 18 与 RN 卡片 14 的字号分叉待裁决
                    fontSize: rpx(36),
                    color: 'var(--color-foreground)',
                    lineHeight: rpx(40),
                    flex: 1,
                    minHeight: rpx(44),
                  } as CSSProperties
                }
                value={value}
                placeholder={placeholder || t('messageInput.placeholder')}
                placeholderStyle="color: var(--color-muted-foreground); font-size: 28rpx;"
                maxlength={maxLength}
                autoFocus={autoFocus}
                autoHeight
                onInput={handleInput}
                onConfirm={handleSend}
                confirmType="send"
                cursorSpacing={44}
                adjustPosition={false}
                disabled={mode === 'voice' || recording}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyboardHeightChange={handleKeyboardHeightChange}
              />

              {/* 语音波形动画 voice-bar-animation(对标原项目 v-if="isVoiceAnimationActive")
                  语音模式时渲染:30 根线,recording 时添加 line1~line30 类名触发动画 */}
              {mode === 'voice' ? (
                <View
                  style={{ flex: 1, display: 'flex', alignItems: 'center' }}
                  onTouchStart={handleVoiceStart}
                  onTouchEnd={handleVoiceEnd}
                  onTouchCancel={handleVoiceCancel}
                >
                  <View className="voice-bar-animation">
                    {Array.from({ length: 30 }).map((_, n) => (
                      <View key={n} className={cn('line', recording ? `line${n + 1}` : '')} />
                    ))}
                  </View>
                </View>
              ) : null}

              {/* 放大按钮(对标原项目 isamplify && !isVoiceAnimationActive && !isFangdaActive)
                  位置:absolute right:0 top:12rpx 40×40 z-index:2,图标 48×48 widthFix */}
              {mode === 'text' && isamplify && !recording && !isFangdaActive ? (
                <View
                  className="search-right"
                  style={{
                    position: 'absolute',
                    justifyContent: 'flex-end',
                    right: 0,
                    top: toUnit(INPUT_AREA_FANGDA_TOP_PX),
                    width: rpx(40),
                    height: rpx(40),
                    zIndex: 2,
                  }}
                >
                  <View className="search-box3">
                    {/* 放大:与 RN 底部辅助行「放大」槽位同一个 lucide 字形(Maximize) */}
                    <LineIcon
                      className="search-box3-img"
                      name="maximize"
                      size={toUnit(INPUT_AREA_AI_HOME_EXPAND_GLYPH_PX)}
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
                    top: toUnit(INPUT_AREA_FANGDA_TOP_PX),
                    width: rpx(40),
                    height: rpx(40),
                    zIndex: 2,
                  }}
                >
                  <View className="search-box3">
                    {/* 缩小:Maximize 的成对档 lucide Minimize(登记表同名键 minimize) */}
                    <LineIcon
                      className="search-box3-img"
                      name="minimize"
                      size={toUnit(INPUT_AREA_AI_HOME_EXPAND_GLYPH_PX)}
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
                  <LineIcon
                    className={cn('search-box2-img', isShowIcon ? 'rotate-icon' : '')}
                    name="plus"
                    size={toUnit(INPUT_AREA_AI_HOME_ADD_GLYPH_PX)}
                  />
                </View>
                <View className="search-box3">
                  <LineIcon
                    className="search-box3-img"
                    name="send"
                    size={toUnit(INPUT_AREA_AI_HOME_ICON_BOX_PX)}
                    color="var(--color-brand)"
                    style={{ marginLeft: toUnit(INPUT_AREA_AI_HOME_SEND_ICON_MARGIN_PX) }}
                  />
                </View>
              </View>

              {/* 可见 search-right:绝对定位 right:6rpx bottom:calc(50% - 26rpx) */}
              <View
                className="search-right"
                style={{
                  position: 'absolute',
                  right: rpx(6),
                  bottom: 'calc(50% - 26rpx)',
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                  zIndex: 2,
                }}
              >
                {/* 附件按钮 search-box2:44rpx×44rpx,默认可见,isShowIcon 只控制旋转 */}
                <View className="search-box2" onClick={handleUploadToggle} hoverClass="opacity-60">
                  {/* 与 RN `PlusButton`(search-box2 的同一槽位)同字形:lucide Plus */}
                  <LineIcon
                    className={cn('search-box2-img', isShowIcon ? 'rotate-icon' : '')}
                    name="plus"
                    size={toUnit(INPUT_AREA_AI_HOME_ADD_GLYPH_PX)}
                  />
                </View>

                {/* 清空 + 发送 search-box3 */}
                <View className="search-box3">
                  {/* 清空按钮:叉号与 RN 附件删除角标同字形(lucide X),盒仍是 50rpx 档 */}
                  {mode === 'text' && value.length > 0 ? (
                    <LineIcon
                      className="search-box3-img"
                      name="x"
                      size={toUnit(INPUT_AREA_AI_HOME_ICON_BOX_PX)}
                      style={{ marginRight: toUnit(INPUT_AREA_AI_HOME_INLINE_GAP_PX) }}
                      onClick={handleClear}
                    />
                  ) : null}

                  {/* 发送按钮:与 RN `<Send>`(框外/框内两态)同字形;这一枚是纯图标无背景容器,
                      故前景取品牌色而不是 RN 的 ctaForeground(那是白字压黑底,裸图标会看不见) */}
                  <LineIcon
                    className="search-box3-img"
                    name="send"
                    size={toUnit(INPUT_AREA_AI_HOME_ICON_BOX_PX)}
                    color="var(--color-brand)"
                    style={{ marginLeft: toUnit(INPUT_AREA_AI_HOME_SEND_ICON_MARGIN_PX) }}
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
              // 在 weapp 端为死样式(:active 伪类对 View 不生效),改用 hoverClass 按压反馈
              <View
                key={i}
                className="w-11 h-11 flex items-center justify-center text-2xl"
                onClick={() => handleEmojiPick(e)}
                hoverClass="opacity-60"
              >
                <Text>{e}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      <View className="flex items-center w-full">
        <View className="flex items-center mr-2 flex-shrink-0">
          {/* 在 weapp 端为死样式(:active 伪类对 View 不生效),改用 hoverClass 按压反馈 */}
          <View
            className={`w-9 h-9 flex items-center justify-center rounded-lg ${mode === 'voice' ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={toggleMode}
            hoverClass="opacity-60"
          >
            {/* 文字态 = 切到语音(Mic)/ 语音态 = 切回文字(Keyboard),与 RN 同一对字形;
                取色沿用本 View 上原有的 text-primary / text-muted-foreground 两态 */}
            <LineIcon
              name={mode === 'text' ? 'mic' : 'keyboard'}
              size={toUnit(INPUT_AREA_GLYPH_MD_PX)}
              color={mode === 'voice' ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
            />
          </View>
        </View>

        {mode === 'text' ? (
          <View className="flex-1 min-h-10 bg-muted rounded-2xl px-3 py-2 flex items-center">
            <Textarea
              className="w-full text-sm text-foreground dark:text-muted-foreground bg-transparent"
              style={{ minHeight: rpx(40), maxHeight: rpx(200), width: '100%' }}
              value={value}
              placeholder={placeholder || t('messageInput.placeholder')}
              placeholderStyle="color: var(--color-muted-foreground); font-size: 28rpx;"
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
            className={`flex-1 min-h-10 mx-2 rounded-2xl flex items-center justify-center text-sm ${recording ? 'bg-[var(--color-danger-light)] text-destructive' : 'bg-muted text-foreground dark:text-muted-foreground'}`}
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
              className={`w-9 h-9 leading-9 text-center text-xl rounded-lg ${showEmoji ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={toggleEmoji}
            >
              😊
            </Text>
          ) : null}
          <View className="flex flex-col items-center ml-1">
            {/* 在 weapp 端为死样式(:active 伪类对 View 不生效),改用 hoverClass 按压反馈 */}
            <View
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground"
              onClick={handleUploadToggle}
              hoverClass="opacity-60"
            >
              {/* 与 RN `PlusButton`(附件槽位)同字形:lucide Plus */}
              <LineIcon name="plus" size={toUnit(INPUT_AREA_GLYPH_MD_PX)} />
            </View>
            <Text className="text-[length:18rpx] text-muted-foreground leading-none mt-[4rpx]">
              {t('messageInput.addFile')}
            </Text>
          </View>
        </View>

        {mode === 'text' ? (
          // active:bg-primary 在 weapp 端为死样式(:active 伪类对 View 不生效),改用 hoverClass 按压反馈
          <View
            className={`ml-2 px-4 h-9 leading-9 rounded-lg text-sm flex-shrink-0 ${canSend ? 'bg-cta text-cta-foreground' : 'bg-muted text-muted-foreground'}`}
            onClick={handleSend}
            hoverClass="opacity-60"
          >
            <Text>{t('messageInput.send')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
