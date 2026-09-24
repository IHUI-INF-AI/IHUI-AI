// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * InputArea 多行输入区(mobile-rn)— 聊天 / 反馈 / 评论场景通用输入区
 *
 * 设计要点:
 * - 容器:浅色 surface.card 底 + 顶部 1px border,flex row,底部对齐
 * - 多行 TextInput:自动撑高(上限 120,放大后无上限),1px 边框 + 圆角 8
 * - 发送按钮:40×40,品牌色底,圆角 12(rounded-xl 风格,非纯圆形;遵循 AGENTS.md §4 圆角守门)
 * - 字数统计:输入框内右下角浮层,超过 90% 警告色
 *
 * 2026-07-30:对齐历史项目 InputArea(微信小程序 miniapp-taro 版本),
 * 适配 mobile-rn StyleSheet 写法,样式 token 全部走 theme/active-tokens。
 *
 * 2026-08-16:复刻原 uniapp InputArea.vue 完整功能(1:1):
 * 1. 图片/视频/文档缩略图列表(imgs_list)+ 右上角删除按钮(close_input.png)
 * 2. 语音输入切换(search-box1):🎤/⌨️,语音激活时 30 线动画条(voice-bar-animation)
 * 3. 文本输入自动撑高 + 放大/缩小切换(handleFangda/handleFangdas,⤢/⤡)
 * 4. 添加文件按钮(search-box2,加号,functionHandle → onImageAdd)
 * 5. 发送按钮(search-box3)
 * 6. 参数变量输入区(pageAgentVariables,可选)
 *
 * 复刻约束:
 * - 保留原 props 契约(value/onChangeText/placeholder/maxLength/onSubmit/disabled/
 *   loading/onStop/stopLabel),新增功能走「可选 props」,调用方不传时降级为原行为。
 * - 配色走 主题 token 入口,主色 brand.DEFAULT(黑)/成功 success.DEFAULT(绿)/
 *   警告 warning.DEFAULT(橙)/错误 danger.DEFAULT(红),禁用 purple/indigo。
 * - 图标用 emoji/文字替代原图片(原图在 D:\历史项目存档\...\src\static\images\,
 *   均已存在于 apps/mobile-rn/assets/images/common/,此处为免去颜色/背景不确定风险统一用 emoji)。
 * - 图片/文件真实上传、语音识别(STT)等需原生模块/后端 API 的功能,
 *   用回调 props 预留(onImageAdd/onVoiceToggle 等),组件内注释标注「待接后端/原生模块」。
 *   未引入 expo-image-picker 等新原生依赖。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard as RNKeyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUiTextField } from '../lib/use-ui-text-field'
import { tokens } from '../theme/active-tokens'
import { formatShortDuration } from '@ihui/shared/utils'
import { PlusButton } from './AddPanel'
import {
  FileText,
  Film,
  Image as ImageIcon,
  Keyboard,
  Mic,
  Play,
  Plus,
  Send,
  X,
} from 'lucide-react-native'

import { rnRadius } from '@ihui/design-tokens'

/** 图片/视频/文档列表项。对应原 uniapp imgs_list 项(imgUrl / fileType / filename / video_url) */
export interface InputImageItem {
  id?: string | number
  /** 图片/视频封面地址(remote uri);文档类型可留空(用 📄 图标) */
  url?: string
  /** 类型:image 图片 / video 视频 / document 文档 */
  type?: 'image' | 'video' | 'document'
  /** 文档文件名(文档类型展示,底部滚动) */
  filename?: string
  /** 视频地址(预留,待接 expo-video) */
  videoUrl?: string
}

/** 参数变量组件项。对应原 uniapp pageAgentVariables[].components[] */
export interface AgentVariableComponent {
  name?: string
  type?: 'text' | 'image'
  description?: string
  default_value?: string
}

/** 参数变量分组。对应原 uniapp pageAgentVariables[] */
export interface AgentVariableGroup {
  description?: string
  components?: AgentVariableComponent[]
}

export interface InputAreaProps {
  /** 受控输入值 */
  value: string
  /** 输入变化回调(父组件维护 value 状态) */
  onChangeText: (text: string) => void
  /** 占位提示 */
  placeholder?: string
  /** 字符上限,默认 500 */
  maxLength?: number
  /** 点击发送按钮(且文本非空)时回调,已 trim */
  onSubmit: (text: string) => void
  /** 禁用输入(同时禁用发送按钮,变 muted 色) */
  disabled?: boolean
  /** 发送中:按钮显示 ActivityIndicator 替代 ➤ 图标 */
  loading?: boolean
  /** 停止回调:提供后,loading 时发送按钮切换为停止按钮(danger 色)。用于流式对话中断 */
  onStop?: () => void
  /** 停止按钮文字,缺省"停止" */
  stopLabel?: string
  /** 发送按钮可访问文案(i18n 注入);未提供时回退 "send" */
  sendLabel?: string

  // ── 新增(可选,不传则降级为原行为)──────────────────────────────
  /** 图片/视频/文档列表 */
  images?: InputImageItem[]
  /** 删除某张缩略图回调(参数为索引)。已 trim 后由父组件维护 images 状态 */
  onImageRemove?: (index: number) => void
  /** 添加文件/图片回调。待接后端/原生模块(expo-image-picker / 文件选择) */
  onImageAdd?: () => void
  /** 是否语音输入模式(切换 🎤/⌨️) */
  voiceInput?: boolean
  /** 是否语音激活(录音中,显示 30 线动画条 + 禁用文本输入) */
  voiceActive?: boolean
  /** 语音/键盘切换回调。待接后端/原生模块(STT 录音) */
  onVoiceToggle?: () => void
  /** 语音动画开始回调(按住说话按下)。待接后端/原生模块 */
  onVoiceAnimationStart?: () => void
  /** 语音动画结束回调(松开结束)。待接后端/原生模块 */
  onVoiceAnimationStop?: () => void
  /** 是否放大(受控);不传时组件内部自维护放大状态 */
  expanded?: boolean
  /** 放大/缩小切换回调 */
  onExpandToggle?: () => void
  /** 参数变量区(可选) */
  pageAgentVariables?: AgentVariableGroup[]
  /** 参数变量输入回调(value, componentIndex, groupIndex) */
  onPageAgentVariablesChange?: (value: string, componentIndex: number, groupIndex: number) => void
  /** 参数变量「图片类型」添加回调(groupIndex, componentIndex)。待接后端/原生模块 */
  onParamImageAdd?: (groupIndex: number, componentIndex: number) => void

  // ── collapsible 折叠态(可选,默认 false 不破坏现有调用方)─────────────────
  /** 启用折叠态:首次进入折叠,FAB 浮动按钮位于右下角;点击 FAB 展开完整输入栏,
   *  完整栏顶部右上角有「×」按钮可折叠回。HomeScreen 等场景用此获得默认隐藏 +
   *  点击 + 滑出的交互(对齐历史 Uniapp 抽屉式输入)。 */
  collapsible?: boolean
  /** collapsible=true 时,初始是否折叠(默认 true)。HomeScreen 默认折叠让首屏更整洁 */
  defaultCollapsed?: boolean
  /** 折叠态切换通知(展开→true=折叠中 / false=展开中),非受控 */
  onCollapsedChange?: (collapsed: boolean) => void
  /** 折叠态 FAB 按钮的可访问标签(供 i18n 注入);未提供时回退「提问」 */
  collapsedFabLabel?: string
  /** 折叠按钮(完整态右上「×」)的可访问标签;未提供时回退「收起输入区」 */
  collapseButtonLabel?: string

  // ── 内嵌语音(可选,HomeScreen 大输入框:麦克风+文本+发送同框)─────────────────
  /** 显示框内麦克风按钮(长按录音,松开转写)。传入后输入区渲染为「一个大输入框」:
   *  [🎤 长按] [TextInput/录音波形] [发送] 同处一个圆角边框内,发送按钮移入框内 */
  showVoiceMic?: boolean
  /** 录音中(showVoiceMic=true 时生效):输入区显示波形 + 时长「松开结束」 */
  voiceRecording?: boolean
  /** 转写中(showVoiceMic=true 时生效):输入区显示「转写中…」 */
  voiceTranscribing?: boolean
  /** 录音时长(秒,showVoiceMic=true 时生效) */
  voiceDuration?: number
  /** 长按麦克风开始录音(showVoiceMic=true 时生效) */
  onVoiceStart?: () => void
  /** 松开麦克风结束录音并转写(showVoiceMic=true 时生效) */
  onVoiceEnd?: () => void
  /** 「+」按钮回调(对齐 Uniapp functionHandle → 底部滑出菜单;提供后在大输入框发送按钮左侧渲染;
   *  激活时旋转 45° + 品牌色高亮,对齐 BottomActionBar plusBtn 同款交互) */
  onPlusToggle?: () => void
  /** 「+」按钮激活态(底部菜单展开时高亮 + 旋转 45°) */
  plusActive?: boolean
}

const DEFAULT_MAX_LENGTH = 500
const WARNING_RATIO = 0.9
const MIN_INPUT_HEIGHT = 48
const MAX_INPUT_HEIGHT = 120
const VOICE_BAR_COUNT = 30

/** 语音激活时的 30 线动画条(对应原 voice-bar-animation,纯前端 UI) */
function VoiceWave() {
  const bars = useRef<Animated.Value[]>(
    Array.from({ length: VOICE_BAR_COUNT }, () => new Animated.Value(0)),
  ).current

  useEffect(() => {
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration: 280,
            delay: i * 45,
            useNativeDriver: true,
          }),
          Animated.timing(v, { toValue: 0, duration: 280, useNativeDriver: true }),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [bars])

  return (
    <View style={styles.voiceBars}>
      {bars.map((v, i) => {
        const scaleY = v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] })
        const baseHeight = 8 + (i % 6) * 4
        return (
          <Animated.View
            key={i}
            style={[styles.voiceBar, { height: baseHeight, transform: [{ scaleY }] }]}
          />
        )
      })}
    </View>
  )
}

/** 文档文件名滚动(对应原 scroll-container 跑马灯) */
function FilenameMarquee({ text }: { text: string }) {
  const translateX = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: -140,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [translateX])

  return (
    <View style={styles.docMarquee}>
      <Animated.View style={[styles.docMarqueeInner, { transform: [{ translateX }] }]}>
        <Text numberOfLines={1} style={styles.docName}>
          {text}
        </Text>
        <Text numberOfLines={1} style={styles.docName}>
          {'　　　'}
        </Text>
        <Text numberOfLines={1} style={styles.docName}>
          {text}
        </Text>
      </Animated.View>
    </View>
  )
}

export function InputArea({
  value,
  onChangeText,
  placeholder,
  maxLength = DEFAULT_MAX_LENGTH,
  onSubmit,
  disabled = false,
  loading = false,
  onStop,
  stopLabel,
  sendLabel,
  images,
  onImageRemove,
  onImageAdd,
  voiceInput = false,
  voiceActive = false,
  onVoiceToggle,
  onVoiceAnimationStart,
  onVoiceAnimationStop,
  expanded,
  onExpandToggle,
  pageAgentVariables,
  onPageAgentVariablesChange,
  onParamImageAdd,
  collapsible = false,
  defaultCollapsed = true,
  onCollapsedChange,
  collapsedFabLabel,
  collapseButtonLabel,
  showVoiceMic = false,
  voiceRecording = false,
  voiceTranscribing = false,
  voiceDuration = 0,
  onVoiceStart,
  onVoiceEnd,
  onPlusToggle,
  plusActive = false,
}: InputAreaProps) {
  const insets = useSafeAreaInsets()
  useUiTextField({
    label: placeholder ?? '',
    value,
    setValue: onChangeText,
    multiline: true,
    maxLength,
  })
  const isSendBlocked = disabled || loading
  const canSend = value.trim().length > 0 && !isSendBlocked
  const isOverWarning = value.length >= Math.floor(maxLength * WARNING_RATIO)

  // 文本自动撑高(上限 MAX_INPUT_HEIGHT,放大后无上限)
  const [contentHeight, setContentHeight] = useState(MIN_INPUT_HEIGHT)
  // Android 的 onContentSizeChange 在文本收缩时不再回调,清空后输入框会卡在多行
  // 高度上(计数徽章随之误显 0/500)。value 清空时主动复位到单行高度。
  useEffect(() => {
    if (value.length === 0) setContentHeight(MIN_INPUT_HEIGHT)
  }, [value])
  const [expandedInternal, setExpandedInternal] = useState(false)
  const isExpanded = expanded ?? expandedInternal
  const inputHeight = isExpanded
    ? Math.max(MIN_INPUT_HEIGHT, contentHeight)
    : Math.min(Math.max(MIN_INPUT_HEIGHT, contentHeight), MAX_INPUT_HEIGHT)

  // collapsible 折叠态:非受控(defaultCollapsed 默认 true → 首屏折叠)
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed)
  const isCollapsed = collapsible ? internalCollapsed : false

  // showVoiceMic 大输入框:短按聚焦输入,长按 450ms 开始录音(2026-09-22 用户定稿:
  // 长按输入框直接语音,微信同款交互)。Pressable 恒挂载持有触摸序列,
  // 录音态内部切换波形/TextInput 不丢松开事件;TextInput 包 pointerEvents="none"
  // 纯展示,短按由 Pressable 手动 focus(软键盘按键注入不依赖触摸 TextInput 本体)。
  const inputRef = useRef<TextInput | null>(null)

  const hasImages = (images?.length ?? 0) > 0
  const hasParams = (pageAgentVariables?.length ?? 0) > 0
  const showVoiceBtn = onVoiceToggle !== null
  const showAddBtn = onImageAdd !== undefined
  const showExpandBtn = onExpandToggle !== null && value.length > 0

  const handleSubmit = useCallback((): void => {
    if (!canSend) return
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }, [canSend, onSubmit, value])

  const handleExpandToggle = useCallback((): void => {
    if (onExpandToggle) onExpandToggle()
    if (expanded === undefined) setExpandedInternal((v) => !v)
  }, [expanded, onExpandToggle])

  const handleContentSizeChange = useCallback((_w: number, h: number): void => {
    setContentHeight(h)
  }, [])

  // 折叠/展开切换(collapsible=true 时生效)
  const handleCollapseToggle = useCallback((): void => {
    setInternalCollapsed((v) => {
      const next = !v
      onCollapsedChange?.(next)
      return next
    })
  }, [onCollapsedChange])

  // 折叠态早返回:FAB 浮动按钮(底部中央,绝对定位),对齐历史 Uniapp 抽屉式输入
  // P1-2:避开 HomeScreen 右下角 GlobalFloatBox(赚米/客服/反馈)遮挡,FAB 居中放
  if (collapsible && isCollapsed) {
    return (
      <View style={[styles.collapsedWrap, { bottom: 24 + insets.bottom }]} pointerEvents="box-none">
        <Pressable
          style={styles.collapsedFab}
          onPress={() => {
            setInternalCollapsed(false)
            onCollapsedChange?.(false)
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={collapsedFabLabel ?? '展开提问输入'}
          accessibilityState={{ expanded: false }}
        >
          <Plus size={26} color={tokens.brand.ctaForeground} />
        </Pressable>
      </View>
    )
  }

  const renderThumb = (item: InputImageItem, index: number) => {
    const isDoc = item.type === 'document'
    const isVideo = item.type === 'video'
    return (
      <View key={item.id ?? index} style={styles.thumbWrap}>
        {isDoc ? (
          <View style={[styles.thumb, styles.thumbDoc]}>
            <FileText size={26} color={tokens.text.secondary} />
            {item.filename ? <FilenameMarquee text={item.filename} /> : null}
          </View>
        ) : (
          <View style={[styles.thumb, styles.thumbMedia]}>
            {item.url ? (
              <Image source={{ uri: item.url }} style={styles.thumbImage} resizeMode="cover" />
            ) : (
              <View style={styles.thumbPlaceholder}>
                {isVideo ? (
                  <Film size={24} color={tokens.text.secondary} />
                ) : (
                  <ImageIcon size={24} color={tokens.text.secondary} />
                )}
              </View>
            )}
            {/* 视频封面角标:播放图标(真实播放待接 expo-video) */}
            {isVideo ? (
              <View style={styles.videoBadge}>
                <Play size={20} color={tokens.surface.light} />
              </View>
            ) : null}
          </View>
        )}
        <TouchableOpacity
          style={styles.thumbClose}
          onPress={() => onImageRemove?.(index)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="删除附件"
        >
          <X size={10} color={tokens.text.secondary} />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* collapsible=true 时,完整态右上角加「×」按钮,折叠回 FAB 态 */}
      {collapsible ? (
        <TouchableOpacity
          style={styles.collapseBtn}
          onPress={handleCollapseToggle}
          activeOpacity={0.7}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={collapseButtonLabel ?? '收起输入区'}
        >
          <X size={14} color={tokens.text.secondary} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.main}>
        {/* 图片/视频/文档缩略图列表(imgs_list) */}
        {hasImages ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbsList}
            style={styles.thumbsListScroll}
          >
            {(images ?? []).map(renderThumb)}
          </ScrollView>
        ) : null}

        {/* 输入行:showVoiceMic 时为一个「大输入框」(麦克风+文本/语音+发送同框);
            否则原布局(独立语音按钮 + 文本框 + 框外发送按钮) */}
        {showVoiceMic ? (
          <View
            style={[
              styles.fieldShell,
              voiceRecording || voiceTranscribing ? styles.fieldShellRecording : null,
            ]}
          >
            {/* 麦克风:长按开始录音,松开结束并转写 */}
            <Pressable
              style={styles.micInShell}
              onLongPress={onVoiceStart}
              onPressOut={onVoiceEnd}
              delayLongPress={300}
              disabled={disabled || voiceTranscribing}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="按住说出你的问题"
            >
              {voiceTranscribing ? (
                <ActivityIndicator size="small" color={tokens.text.secondary} />
              ) : (
                <Mic
                  size={20}
                  color={voiceRecording ? tokens.danger.DEFAULT : tokens.text.secondary}
                />
              )}
            </Pressable>

            {/* 中部(恒挂载 Pressable 持有触摸):短按聚焦输入,长按开始录音,
                录音态显示波形+时长,转写态显示「转写中…」;松开结束并转写 */}
            <Pressable
              style={styles.voiceTouchArea}
              delayLongPress={450}
              onLongPress={() => {
                RNKeyboard.dismiss()
                onVoiceStart?.()
              }}
              onPressOut={() => {
                if (voiceRecording || voiceTranscribing) onVoiceEnd?.()
              }}
              onPress={() => inputRef.current?.focus()}
              accessibilityLabel={placeholder ?? '请输入您的问题,或长按说话'}
            >
              {voiceRecording || voiceTranscribing ? (
                <View style={styles.voiceAreaInShell}>
                  {voiceTranscribing ? (
                    <View style={styles.transcribingRow}>
                      <ActivityIndicator size="small" color={tokens.danger.DEFAULT} />
                      <Text style={styles.voiceAreaText}>转写中…</Text>
                    </View>
                  ) : (
                    <>
                      <VoiceWave />
                      <Text style={styles.voiceAreaDuration}>
                        {formatShortDuration(voiceDuration)} 松开结束
                      </Text>
                    </>
                  )}
                </View>
              ) : (
                <View pointerEvents="none" style={styles.inputColumn}>
                  <TextInput
                    ref={inputRef}
                    style={[styles.inputBare, { height: inputHeight }]}
                    value={value}
                    onChangeText={onChangeText}
                    onContentSizeChange={(e) =>
                      handleContentSizeChange(
                        e.nativeEvent.contentSize.width,
                        e.nativeEvent.contentSize.height,
                      )
                    }
                    placeholder={placeholder}
                    placeholderTextColor={tokens.text.tertiary}
                    maxLength={maxLength}
                    multiline
                    textAlignVertical="top"
                    editable={!disabled}
                  />
                  {/* 字数统计:仅输入框被多行内容拉开(两行及以上)时显示,单行不显示 */}
                  {inputHeight > MIN_INPUT_HEIGHT + 10 ? (
                    <Text style={[styles.counter, isOverWarning ? styles.counterWarning : null]}>
                      {value.length}/{maxLength}
                    </Text>
                  ) : null}
                </View>
              )}
            </Pressable>

            {/* 放大/缩小切换(移出 pointerEvents="none" 区域保持可点) */}
            {showExpandBtn && !voiceRecording && !voiceTranscribing ? (
              <TouchableOpacity
                style={styles.expandBtnInShell}
                onPress={handleExpandToggle}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={isExpanded ? '缩小输入框' : '放大输入框'}
              >
                <Text style={styles.expandBtnIcon}>{isExpanded ? '⤡' : '⤢'}</Text>
              </TouchableOpacity>
            ) : null}

            {/* 「+」按钮(对齐 Uniapp functionHandle → 底部滑出菜单;视觉统一走共享 PlusButton,
                激活旋转 45° + 品牌高亮,面板由调用方渲染共享 AddPanel) */}
            {onPlusToggle !== undefined ? (
              <PlusButton active={plusActive} onPress={onPlusToggle} />
            ) : null}

            {/* 发送按钮(框内右侧) */}
            {loading && onStop ? (
              <TouchableOpacity
                style={[styles.sendInShell, styles.stopButton]}
                onPress={onStop}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={stopLabel ?? 'stop'}
              >
                <Text style={styles.sendIcon}>{stopLabel ?? '停止'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sendInShell, isSendBlocked ? styles.sendButtonDisabled : null]}
                onPress={handleSubmit}
                activeOpacity={0.7}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={sendLabel ?? 'send'}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={tokens.surface.light} />
                ) : (
                  <Send size={16} color={tokens.surface.light} />
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.inputRow}>
            {showVoiceBtn ? (
              <TouchableOpacity
                style={styles.voiceBtn}
                onPress={onVoiceToggle}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={voiceActive || voiceInput ? '切换到键盘' : '切换到语音'}
              >
                {voiceActive || voiceInput ? (
                  <Keyboard size={20} color={tokens.text.secondary} />
                ) : (
                  <Mic size={20} color={tokens.text.secondary} />
                )}
              </TouchableOpacity>
            ) : null}

            <View style={styles.inputColumn}>
              {voiceActive ? (
                <Pressable
                  style={styles.voiceWaveWrap}
                  onPressIn={onVoiceAnimationStart}
                  onPressOut={onVoiceAnimationStop}
                  accessibilityLabel="按住说话,松开结束"
                >
                  <VoiceWave />
                </Pressable>
              ) : voiceInput ? (
                <Pressable
                  style={styles.voiceWaveWrap}
                  onPressIn={onVoiceAnimationStart}
                  onPressOut={onVoiceAnimationStop}
                  accessibilityLabel="按住说话,松开结束"
                >
                  <Text style={styles.voiceHint}>按住说话</Text>
                </Pressable>
              ) : (
                <TextInput
                  style={[styles.input, { height: inputHeight }]}
                  value={value}
                  onChangeText={onChangeText}
                  onContentSizeChange={(e) =>
                    handleContentSizeChange(
                      e.nativeEvent.contentSize.width,
                      e.nativeEvent.contentSize.height,
                    )
                  }
                  placeholder={placeholder}
                  placeholderTextColor={tokens.text.tertiary}
                  maxLength={maxLength}
                  multiline
                  textAlignVertical="top"
                  editable={!disabled}
                />
              )}

              {/* 字数统计(输入框内右下角浮层) */}
              {!voiceActive && !voiceInput ? (
                <Text style={[styles.counter, isOverWarning ? styles.counterWarning : null]}>
                  {value.length}/{maxLength}
                </Text>
              ) : null}

              {/* 放大/缩小切换(handleFangda/handleFangdas) */}
              {showExpandBtn ? (
                <TouchableOpacity
                  style={styles.expandBtn}
                  onPress={handleExpandToggle}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={isExpanded ? '缩小输入框' : '放大输入框'}
                >
                  <Text style={styles.expandBtnIcon}>{isExpanded ? '⤡' : '⤢'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* 添加文件按钮(search-box2,functionHandle;视觉统一走共享 PlusButton,
              点击回调 onImageAdd 由调用方注入——弹统一 AddPanel 或直接选图) */}
            {showAddBtn ? <PlusButton onPress={onImageAdd} label="添加图片或文件" /> : null}
          </View>
        )}

        {/* 参数变量输入区(pageAgentVariables,可选) */}
        {hasParams ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.paramsList}
            keyboardShouldPersistTaps="handled"
          >
            {(pageAgentVariables ?? []).map((group, gi) =>
              (group.components ?? []).map((comp, ci) => {
                const title = comp.name || group.description || ''
                return (
                  <View key={`${gi}-${ci}`} style={styles.paramItem}>
                    {title ? <Text style={styles.paramTitle}>{title}</Text> : null}
                    {comp.type === 'image' ? (
                      <TouchableOpacity
                        style={styles.paramAddBtn}
                        onPress={() => onParamImageAdd?.(gi, ci)}
                        accessibilityRole="button"
                        accessibilityLabel="添加参数图片"
                      >
                        <Plus size={16} color={tokens.text.secondary} />
                      </TouchableOpacity>
                    ) : (
                      <TextInput
                        style={styles.paramInput}
                        value={comp.default_value ?? ''}
                        onChangeText={(t) => onPageAgentVariablesChange?.(t, ci, gi)}
                        placeholder={comp.description}
                        placeholderTextColor={tokens.text.tertiary}
                      />
                    )}
                  </View>
                )
              }),
            )}
          </ScrollView>
        ) : null}
      </View>

      {/* 发送按钮(search-box3,框外;showVoiceMic 时已移入大输入框内,不重复渲染) */}
      {!showVoiceMic ? (
        loading && onStop ? (
          <TouchableOpacity
            style={[styles.sendButton, styles.stopButton]}
            onPress={onStop}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={stopLabel ?? 'stop'}
          >
            <Text style={styles.sendIcon}>{stopLabel ?? '停止'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, isSendBlocked ? styles.sendButtonDisabled : null]}
            onPress={handleSubmit}
            activeOpacity={0.7}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={sendLabel ?? 'send'}
          >
            {loading ? (
              <ActivityIndicator size="small" color={tokens.surface.light} />
            ) : (
              <Send size={18} color={tokens.surface.light} />
            )}
          </TouchableOpacity>
        )
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.surface.card,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  main: {
    flex: 1,
    flexDirection: 'column',
  },
  // 缩略图列表
  thumbsListScroll: {
    flexGrow: 0,
  },
  thumbsList: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
    paddingTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.light,
    marginBottom: 8,
  },
  thumbWrap: {
    position: 'relative',
    width: 72,
    height: 72,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: rnRadius.lg,
    overflow: 'hidden',
  },
  thumbDoc: {
    backgroundColor: tokens.surface.muted,
    borderWidth: 1,
    borderColor: tokens.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMedia: {
    backgroundColor: tokens.surface.muted,
    borderWidth: 1,
    borderColor: tokens.border.light,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderIcon: {
    fontSize: 24,
  },
  docIcon: {
    fontSize: 26,
    marginBottom: 2,
  },
  docMarquee: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 16,
    overflow: 'hidden',
    backgroundColor: tokens.surface.muted,
    justifyContent: 'center',
  },
  docMarqueeInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docName: {
    fontSize: 10,
    color: tokens.text.primary,
  },
  thumbClose: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 18 / 2, // radius-exempt: 缩略图删除角标正圆(18dp 直径/2)
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  thumbCloseIcon: {
    fontSize: 10,
    color: tokens.text.secondary,
    lineHeight: 12,
  },
  videoBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadgeIcon: {
    fontSize: 20,
    color: tokens.surface.light,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // 输入行
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // ── showVoiceMic 大输入框(麦克风+文本/语音+发送同框)──
  fieldShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: rnRadius.xl,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  micInShell: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBare: {
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 24,
    fontSize: 14,
    color: tokens.text.primary,
  },
  voiceAreaInShell: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  transcribingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceAreaText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  voiceAreaDuration: {
    fontSize: 12,
    color: tokens.danger.DEFAULT,
    fontWeight: '500',
  },
  fieldShellRecording: {
    alignItems: 'center',
    backgroundColor: tokens.danger.light,
    borderColor: tokens.danger.light,
  },
  voiceTouchArea: {
    flex: 1,
    justifyContent: 'center',
  },
  expandBtnInShell: {
    position: 'absolute',
    right: 52,
    top: 4,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  sendInShell: {
    width: 40,
    height: 40,
    borderRadius: rnRadius.lg, // 原 10,R1 吸附至 lg(8)
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
    // 深色下 brand.DEFAULT=#FFFFFF(纯白),与深色主题不协调;
    // 改用 gray[900]=#171717(深灰),两态均为深灰底白字,与深色主题协调
    backgroundColor: tokens.gray[900],
  },

  voiceBtn: {
    width: 32,
    height: 48,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBtnIcon: {
    fontSize: 20,
  },
  inputColumn: {
    flex: 1,
    position: 'relative',
  },
  input: {
    minHeight: MIN_INPUT_HEIGHT,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    borderRadius: rnRadius.xl,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    fontSize: 14,
    color: tokens.text.primary,
  },
  voiceWaveWrap: {
    minHeight: MIN_INPUT_HEIGHT,
    maxHeight: MAX_INPUT_HEIGHT,
    borderRadius: rnRadius.xl,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 32,
    justifyContent: 'center',
  },
  voiceBar: {
    width: 3,
    borderRadius: rnRadius.xs,
    backgroundColor: tokens.danger.DEFAULT,
  },
  voiceHint: {
    fontSize: 14,
    color: tokens.text.secondary,
  },
  counter: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    fontSize: 11,
    color: tokens.text.tertiary,
    marginTop: 4,
    textAlign: 'right',
  },
  counterWarning: {
    color: tokens.warning.DEFAULT,
  },
  expandBtn: {
    position: 'absolute',
    right: 8,
    top: 6,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBtnIcon: {
    fontSize: 15,
    color: tokens.text.secondary,
  },

  // 参数变量区
  paramsList: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 2,
  },
  paramItem: {
    flexDirection: 'column',
    gap: 4,
    minWidth: 100,
  },
  paramTitle: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  paramInput: {
    minHeight: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    fontSize: 12,
    color: tokens.text.primary,
  },
  paramAddBtn: {
    minHeight: 32,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderStyle: 'dashed',
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paramAddIcon: {
    fontSize: 16,
    color: tokens.text.secondary,
  },
  // 发送按钮
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: rnRadius.xl,
    // 深色下 brand.DEFAULT=#FFFFFF(纯白),与深色主题不协调;
    // 改用 gray[900]=#171717(深灰),两态均为深灰底白字,与深色主题协调
    backgroundColor: tokens.gray[900],
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: tokens.danger.DEFAULT,
  },
  sendButtonDisabled: {
    backgroundColor: tokens.surface.muted,
  },
  sendIcon: {
    fontSize: 18,
    // stopButton 红底配白色文字;原 brand.foreground 深色=#000000(黑)红底黑字不可读
    color: tokens.surface.light,
    fontWeight: '600',
  },

  // ── collapsible 折叠态(底部中央浮动 FAB,绝对定位,避开 GlobalFloatBox 右侧) ──
  collapsedWrap: {
    position: 'absolute',
    // 屏幕水平居中,减去 FAB 一半宽度(28)使按钮中心对齐屏幕中线
    left: '50%',
    marginLeft: -28,
    // bottom 在 JSX 内根据 insets.bottom 计算,这里只设兜底
    bottom: 24,
    // zIndex/elevation 必须高于 GlobalFloatBox,避免被遮挡
    zIndex: 9999,
    elevation: 24,
  },
  collapsedFab: {
    width: 56,
    height: 56,
    borderRadius: 56 / 2, // radius-exempt: 折叠态 FAB 几何正圆(56dp 直径/2)
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
    // shadow(iOS)
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    // shadow(Android)
  },
  // 完整态右上角「×」折叠按钮(absolute 覆盖在 main 顶部右上)
  collapseBtn: {
    position: 'absolute',
    top: 4,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: rnRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
})

export default InputArea
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
