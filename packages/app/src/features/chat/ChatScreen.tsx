// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { ChevronDown } from 'lucide-react-native'
import type {
  ChatScreenMessage,
  ChatScreenModel,
  ChatScreenNavItem,
  ChatScreenProps,
} from '../../types'
import { MessageInput } from './MessageInput'
import { ContextUsagePanel } from './ContextUsagePanel'
import { ChatHeader } from './ChatHeader'
import { ChatMessageList } from './ChatMessageList'
import { ScrollJumpButton } from '../../components/ScrollJumpButton'
import { scrollJumpInsetPx } from '@ihui/shared/ui/scroll-jump-spec'
import { JUMP_FAR_THRESHOLD, type JumpVisibility, type ScrollJumpReading } from '@ihui/shared/chat'

import { rnRadius, rnSpacing, rnType, rnCssLight } from '@ihui/design-tokens'
import { Tappable } from '@ihui/ui-native'
import { assertRequiredPort } from '../../host/ports'

export type { ChatScreenMessage, ChatScreenModel, ChatScreenNavItem, ChatScreenProps }

/**
 * AI 主聊天共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API)
 *
 * 平台无关:渲染顶栏(标题 + 导航条目)+ 模型选择条 + Modal 选择器
 * + 消息列表(用户/助手气泡)+ 错误提示 + 输入栏(发送/停止)。
 * 平台特定(SSE 流式 / 截图 / 分享 / Alert / 导航跳转)由 wrapper 通过 props 注入。
 */
export function ChatScreen({
  t,
  messages,
  inputText,
  isStreaming,
  error,
  models,
  model,
  pickerOpen,
  navItems,
  inputFiles = [],
  agentVariables,
  isInputFocused = false,
  isInputFullscreen = false,
  isVoiceMode = false,
  isRecording = false,
  isSending = false,
  inputError = '',
  onInputTextChange,
  onSend,
  onStop,
  onModelChange,
  onPickerOpenChange,
  onLongPressMessage,
  onMessageRef,
  onInputFocus,
  onInputBlur,
  onInputFullscreenToggle,
  onInputVoiceToggle,
  onInputAddImage,
  onInputAddFile,
  onInputRemoveFile,
  onInputClear,
  onInputVoiceStart,
  onInputVoiceEnd,
  onInputAgentVariableTextChange,
  onInputAgentVariableImageChange,
  colorScheme = 'light',
  showHeader = true,
  showModelBar = true,
  showInput = true,
  renderMessage,
  renderListHeader,
  renderListFooter,
  itemSeparatorComponent,
  containerStyle,
  flatListStyle,
  onListRef,
  statusSlot,
  queueSlot,
  headerNode,
  topSlot,
  messageListSlots,
  inputSlot,
  overlaySlot,
  onNavigate,
  onToast,
}: ChatScreenProps) {
  assertRequiredPort('onNavigate', onNavigate)
  assertRequiredPort('onToast', onToast)

  const tk = getTokens(colorScheme)
  const listRef = useRef<FlatList<ChatScreenMessage> | null>(null)
  const styles = useMemo(() => createStyles(tk), [tk])

  // ── 跳顶 / 跳到最新浮层(D3 的移动端那一格,2026-11-26 补齐)──────────────
  // 判据与阈值都来自 @ihui/shared/chat/scroll-jump(唯一真相源),本层只做"跨阈值才 setState"
  // 的渲染防护:滚动每帧都进这里,无脑 setState 会让整列消息重渲染。
  // visibility === null ⇒ 本端(小程序 Taro ScrollView)取不到视口高,只有顶部档可信,
  // 底部档保守取 false —— 不亮按钮,而不是按 0 距离恒亮。
  const [jump, setJump] = useState<{ top: boolean; bottom: boolean }>({ top: false, bottom: false })
  const handleJumpGeometry = useCallback(
    (reading: ScrollJumpReading, visibility: JumpVisibility | null): void => {
      const top = visibility ? visibility.isFarFromTop : reading.scrollTop > JUMP_FAR_THRESHOLD
      const bottom = visibility ? visibility.isFarFromBottom : false
      setJump((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }))
    },
    [],
  )
  const jumpToTop = useCallback((): void => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])
  const jumpToLatest = useCallback((): void => {
    listRef.current?.scrollToEnd({ animated: true })
  }, [])

  const currentModelName = models.find((m) => m.id === model)?.name || model
  const currentModelContext = models.find((m) => m.id === model)?.context_length ?? 0

  return (
    <View style={[styles.container, containerStyle]}>
      {headerNode !== undefined ? (
        headerNode
      ) : showHeader ? (
        <ChatHeader
          t={t}
          colorScheme={colorScheme}
          title={t('chat.title')}
          navItems={navItems.map((n) => ({ key: n.key, label: n.label, onPress: n.onPress }))}
        />
      ) : null}

      {topSlot ?? null}

      {showModelBar ? (
        <TouchableOpacity
          onPress={() => onPickerOpenChange(true)}
          style={styles.modelBar}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={styles.modelText}>
            {t('chatSettingsPage.model')}: {currentModelName}{' '}
            <ChevronDown size={14} color={tk.text.secondary} />
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* 上下文占用归因(消费共享引擎,tailPreview 语义与 web 端一致) */}
      {showModelBar ? (
        <ContextUsagePanel
          t={t}
          messages={messages}
          maxTokens={currentModelContext}
          colorScheme={colorScheme}
        />
      ) : null}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => onPickerOpenChange(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => onPickerOpenChange(false)}
        >
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{t('chat.selectModel')}</Text>
            </View>
            <FlatList
              data={models}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => {
                const active = item.id === model
                return (
                  <Tappable
                    onPress={() => {
                      onModelChange(item.id)
                      onPickerOpenChange(false)
                    }}
                    style={styles.pickerItem}
                  >
                    <Text style={[styles.pickerItemName, active && styles.pickerItemNameActive]}>
                      {item.name || item.id}
                    </Text>
                    <Text style={styles.pickerItemProvider}>{item.provider}</Text>
                  </Tappable>
                )
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <ChatMessageList
        t={t}
        colorScheme={colorScheme}
        data={messages}
        isStreaming={isStreaming}
        renderItem={renderMessage}
        headerNode={renderListHeader}
        renderFooter={renderListFooter === undefined ? undefined : () => <>{renderListFooter}</>}
        showThinkingPlaceholder={messageListSlots?.showThinkingPlaceholder ?? false}
        tailNodes={messageListSlots?.tailNodes}
        orphanTailNode={messageListSlots?.orphanTailNode}
        thinkingNode={messageListSlots?.thinkingNode}
        className={messageListSlots?.className}
        scrollTop={messageListSlots?.scrollTop}
        scrollWithAnimation={messageListSlots?.scrollWithAnimation}
        followStream={messageListSlots?.followStream}
        onScroll={messageListSlots?.onScroll}
        onEndReached={messageListSlots?.onEndReached}
        onScrollGeometry={handleJumpGeometry}
        onLongPressMessage={onLongPressMessage}
        onMessageRef={onMessageRef}
        onListRef={(ref) => {
          listRef.current = ref
          onListRef?.(ref)
        }}
        itemSeparator={itemSeparatorComponent}
        style={flatListStyle}
      />

      {/*
        跳顶 / 跳到最新浮层(2026-11-26 补齐 D3 的移动端那一格)。
        - 复用两端既有 ScrollJumpButton(packages/shared/src/ui/scroll-jump-core 一份源 +
          RN / 小程序 adapter),不新造盒子、不新造观感、不新增文案键:
          标签 common.backToTop 与 planPage.backToLatest 在 mobile-rn / miniapp-taro
          两份宿主词包里五语言齐备(现读核对过),可见侧是裸箭头、label 只喂无障碍名称。
        - 显隐判据同源 computeJumpVisibility(阈值 800 与严格不等都只有一份)。
        - 小程序 Taro ScrollView 不供给视口高 ⇒ visibility 为 null ⇒ 本端只有「跳顶」会亮,
          「跳到最新」仍由 followStream 贴底机制负责。这是保守少亮,不是恒亮一枚无用按钮。
        - 定位用 spec 的 scrollJumpInsetPx(),不用裸数字;它排在输入区之前渲染,
          故不会浮到输入控件之上挡住交互。
      */}
      {jump.top ? (
        <ScrollJumpButton
          direction="top"
          onPress={jumpToTop}
          label={t('common.backToTop')}
          colorScheme={colorScheme}
          testID="chat-jump-top"
          style={{ position: 'absolute', right: scrollJumpInsetPx(), top: scrollJumpInsetPx() }}
        />
      ) : null}
      {jump.bottom ? (
        <ScrollJumpButton
          direction="latest"
          onPress={jumpToLatest}
          label={t('planPage.backToLatest')}
          colorScheme={colorScheme}
          testID="chat-jump-latest"
          style={{ position: 'absolute', right: scrollJumpInsetPx(), bottom: scrollJumpInsetPx() }}
        />
      ) : null}

      {statusSlot ?? null}
      {queueSlot ?? null}

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {inputSlot !== undefined ? (
        inputSlot
      ) : showInput ? (
        <MessageInput
          t={t}
          text={inputText}
          isStreaming={isStreaming}
          isSending={isSending}
          disabled={false}
          files={inputFiles}
          agentVariables={agentVariables}
          showAddFileBtn={true}
          isFocused={isInputFocused}
          isFullscreen={isInputFullscreen}
          isVoiceMode={isVoiceMode}
          isRecording={isRecording}
          error={inputError}
          onTextChange={onInputTextChange}
          onSend={onSend}
          onStop={onStop}
          onFocus={onInputFocus ?? (() => undefined)}
          onBlur={onInputBlur ?? (() => undefined)}
          onFullscreenToggle={onInputFullscreenToggle ?? (() => undefined)}
          onVoiceToggle={onInputVoiceToggle ?? (() => undefined)}
          onAddImage={onInputAddImage ?? (() => undefined)}
          onAddFile={onInputAddFile ?? (() => undefined)}
          onRemoveFile={onInputRemoveFile ?? (() => undefined)}
          onClear={onInputClear ?? (() => undefined)}
          onVoiceStart={onInputVoiceStart ?? (() => undefined)}
          onVoiceEnd={onInputVoiceEnd ?? (() => undefined)}
          onAgentVariableTextChange={onInputAgentVariableTextChange}
          onAgentVariableImageChange={onInputAgentVariableImageChange}
          colorScheme={colorScheme}
        />
      ) : null}

      {overlaySlot ?? null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    navRow: { flexDirection: 'row', gap: rnSpacing.md },
    navText: { fontSize: rnType.body.size, color: tk.text.secondary },
    modelBar: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    modelText: { fontSize: rnType.body.size, color: tk.text.secondary },
    list: { flex: 1, paddingHorizontal: rnSpacing.md },
    listContent: { paddingVertical: rnSpacing.md },
    listGap: { height: 10 },
    msgEnd: { alignItems: 'flex-end' },
    msgStart: { alignItems: 'flex-start' },
    bubble: {
      maxWidth: '80%',
      borderRadius: rnRadius['2xl'], // 原 15,R1 吸附至 2xl(16)
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing['sm-loose'],
    },
    bubbleUser: { backgroundColor: tk.surface.muted, borderRadius: rnRadius.xl },
    bubbleAi: {
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    bubbleText: {
      fontSize: rnType.title.size,
      lineHeight: rnType.strong.lineHeight,
      color: tk.text.primary,
    },
    errorWrap: { paddingHorizontal: rnSpacing.lg, paddingBottom: rnSpacing.sm },
    errorText: { fontSize: rnType.body.size, color: tk.danger.deepText },
    pickerOverlay: { flex: 1, backgroundColor: rnCssLight.black20 },
    pickerSheet: {
      marginTop: 'auto',
      backgroundColor: tk.surface.light,
    },
    pickerHeader: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
    },
    pickerTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    pickerItem: { paddingHorizontal: rnSpacing.lg, paddingVertical: rnSpacing.md },
    pickerItemName: { fontSize: rnType.body.size, color: tk.text.medium },
    pickerItemNameActive: { color: tk.text.primary, fontWeight: '500' },
    pickerItemProvider: {
      marginTop: rnSpacing['2xs'],
      fontSize: rnType.label.size,
      color: tk.text.medium,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
