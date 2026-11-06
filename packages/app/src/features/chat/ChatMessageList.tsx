// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ChatScreenMessage, TFunction } from '../../types'

/**
 * 块 2:AI 聊天消息列表 —— 跨端共享(纯展示,零平台 API)
 *
 * 冻结语义(与 A3 spec §2.2 逐条对应):
 * ① keyExtractor=(item)=>item.id;renderItem({item,index});不排序、不过滤
 * ② 流式末条 assistant 且正文为空才追加 thinking 占位
 * ③ 默认气泡 delayLongPress=500
 * ④ 图片点击内置全屏 Modal
 * ⑤ 三反引号代码块展开/复制(复制只走 onCopyText)
 * ⑥ reasoning 折叠,默认收起
 */

export interface ChatMessageListProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  /** 顺序即渲染顺序,组件内不得排序/过滤 */
  data: readonly ChatScreenMessage[]
  isStreaming?: boolean
  /** 富内容覆盖;传入时逐项渲染,组件只负责宿主语义 */
  renderItem?: (item: ChatScreenMessage, index: number) => ReactNode
  /** 按行 id 锚定的条尾节点(声明式数据;共享层按 item.id 取用,不做业务判断) */
  tailNodes?: ReadonlyMap<string, ReactNode>
  /** 锚不到任何行的条尾节点(共享层落在列表尾) */
  orphanTailNode?: ReactNode
  /** 列表头节点(声明式;共享层只负责挂载位置) */
  headerNode?: ReactNode
  renderFooter?: () => ReactNode
  /** 流式末条占位节点;不传用内置 thinking 占位 */
  thinkingNode?: ReactNode
  showThinkingPlaceholder?: boolean
  onLongPressMessage?: (item: ChatScreenMessage, index: number) => void
  onMessageRef?: (id: string, node: View | null) => void
  onListRef?: (ref: FlatList<ChatScreenMessage> | null) => void
  /** 复制代码块正文;不传则复制按钮不渲染 */
  onCopyText?: (text: string) => void
  itemSeparator?: ReactNode | null
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  /** 小程序 rn-compat 列表样式名(小端 CSS 承载高度/滚动域);RN 忽略 */
  className?: string
  /** 小程序滚动锚(与页内 scrollTop 状态同源);RN 忽略 */
  scrollTop?: number
  /** 小程序滚动动画开关;RN 忽略 */
  scrollWithAnimation?: boolean
}

export interface ChatMessageBubbleProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  item: ChatScreenMessage
  /** 最后一条 assistant 且流式中:正文为空时显示 thinking 占位 */
  isLastAi?: boolean
  onLongPress?: () => void
  onCopyText?: (text: string) => void
}

type RichSegment =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string; lang: string }
  | { kind: 'image'; uri: string }

const CODE_FENCE = /```([a-zA-Z0-9+-]*)\n?([\s\S]*?)```/g
const IMAGE_MARK = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g

/** 正文切分:代码块优先,其余段再切 markdown 图片。 */
function splitRichContent(content: string): RichSegment[] {
  const out: RichSegment[] = []
  let cursor = 0
  CODE_FENCE.lastIndex = 0
  let match: RegExpExecArray | null = CODE_FENCE.exec(content)
  while (match !== null) {
    if (match.index > cursor) pushText(out, content.slice(cursor, match.index))
    out.push({ kind: 'code', value: match[2] ?? '', lang: match[1] ?? '' })
    cursor = match.index + match[0].length
    match = CODE_FENCE.exec(content)
  }
  if (cursor < content.length) pushText(out, content.slice(cursor))
  return out.length > 0 ? out : [{ kind: 'text', value: content }]
}

function pushText(out: RichSegment[], text: string) {
  if (!text) return
  let cursor = 0
  IMAGE_MARK.lastIndex = 0
  let match: RegExpExecArray | null = IMAGE_MARK.exec(text)
  while (match !== null) {
    if (match.index > cursor) out.push({ kind: 'text', value: text.slice(cursor, match.index) })
    out.push({ kind: 'image', uri: match[1]! })
    cursor = match.index + match[0].length
    match = IMAGE_MARK.exec(text)
  }
  if (cursor < text.length) out.push({ kind: 'text', value: text.slice(cursor) })
}

export function ChatMessageBubble({
  t,
  colorScheme = 'light',
  item,
  isLastAi = false,
  onLongPress,
  onCopyText,
}: ChatMessageBubbleProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [openCode, setOpenCode] = useState<Record<number, boolean>>({})
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [reasoningOpen, setReasoningOpen] = useState(false)

  const isUser = item.role === 'user'
  const reasoning = (item as ChatScreenMessage & { reasoning?: string }).reasoning
  const content = item.content || (isLastAi ? t('chat.thinking') : '')
  const segments = useMemo(() => splitRichContent(content), [content])

  return (
    <View style={isUser ? styles.rowUser : styles.rowAi}>
      <TouchableOpacity
        activeOpacity={0.9}
        delayLongPress={500}
        onLongPress={onLongPress}
        disabled={onLongPress === undefined}
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}
      >
        {reasoning ? (
          <TouchableOpacity
            onPress={() => setReasoningOpen((v) => !v)}
            style={styles.reasoningToggle}
            accessibilityRole="button"
          >
            <Text style={styles.reasoningToggleText}>
              {reasoningOpen
                ? t('ai.chatMessageItem.collapse')
                : t('ai.chatMessageItem.thinkingProcess')}
            </Text>
          </TouchableOpacity>
        ) : null}
        {reasoning && reasoningOpen ? <Text style={styles.reasoningBody}>{reasoning}</Text> : null}

        {segments.map((seg, i) => {
          if (seg.kind === 'code') {
            const expanded = openCode[i] === true
            return (
              <View key={`code-${i}`} style={styles.codeWrap}>
                <View style={styles.codeHead}>
                  <Text style={styles.codeLang}>{seg.lang || 'code'}</Text>
                  {onCopyText ? (
                    <TouchableOpacity
                      onPress={() => onCopyText(seg.value)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.codeAction}>{t('ai.chatMessageItem.copy')}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => setOpenCode((prev) => ({ ...prev, [i]: !expanded }))}
                  >
                    <Text style={styles.codeAction}>
                      {expanded ? t('ai.chatMessageItem.collapse') : t('ai.tishi.view')}
                    </Text>
                  </TouchableOpacity>
                </View>
                {expanded ? <Text style={styles.codeBody}>{seg.value}</Text> : null}
              </View>
            )
          }
          if (seg.kind === 'image') {
            return (
              <TouchableOpacity key={`img-${i}`} onPress={() => setPreviewUri(seg.uri)}>
                <Image source={{ uri: seg.uri }} style={styles.image} resizeMode="cover" />
              </TouchableOpacity>
            )
          }
          return (
            <Text key={`txt-${i}`} style={styles.bubbleText}>
              {seg.value}
            </Text>
          )
        })}
      </TouchableOpacity>

      {previewUri !== null ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
          <TouchableOpacity
            style={styles.fullscreen}
            activeOpacity={1}
            onPress={() => setPreviewUri(null)}
            accessibilityRole="button"
          >
            <Image
              source={{ uri: previewUri }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Modal>
      ) : null}
    </View>
  )
}

export function ChatMessageList({
  t,
  colorScheme = 'light',
  data,
  isStreaming = false,
  renderItem,
  tailNodes,
  orphanTailNode,
  headerNode,
  renderFooter,
  thinkingNode,
  showThinkingPlaceholder = true,
  onLongPressMessage,
  onMessageRef,
  onListRef,
  onCopyText,
  itemSeparator,
  style,
  contentContainerStyle,
  className,
  scrollTop,
  scrollWithAnimation,
}: ChatMessageListProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const listRef = useRef<FlatList<ChatScreenMessage> | null>(null)

  const last = data.length > 0 ? data[data.length - 1] : undefined
  const showThinking =
    showThinkingPlaceholder &&
    isStreaming &&
    last !== undefined &&
    last.role === 'assistant' &&
    last.content === '' &&
    // 默认气泡自身已按同一判据显示 thinking(见 ChatMessageBubble),此处在
    // 「自定义渲染器」或「显式 thinkingNode」时才追加,避免同屏两坨占位。
    (renderItem !== undefined || thinkingNode !== undefined)

  const renderRow = ({ item, index }: { item: ChatScreenMessage; index: number }) => {
    const isLastAi = item.role === 'assistant' && isStreaming && index === data.length - 1
    const setRef = (el: View | null) => {
      if (onMessageRef) onMessageRef(item.id, el)
    }
    return (
      <View ref={setRef}>
        {renderItem ? (
          <>{renderItem(item, index)}</>
        ) : (
          <ChatMessageBubble
            t={t}
            colorScheme={colorScheme}
            item={item}
            isLastAi={isLastAi}
            onLongPress={
              onLongPressMessage === undefined ? undefined : () => onLongPressMessage(item, index)
            }
            onCopyText={onCopyText}
          />
        )}
        {tailNodes?.get(item.id) ?? null}
      </View>
    )
  }

  // rn-compat 专用透传(className / scrollTop / scrollWithAnimation):RN 侧落到 ScrollView
  // 的未知属性上会被忽略,小程序侧由 rn-compat 的列表宿主承接。
  const compatProps = { className, scrollTop, scrollWithAnimation }

  return (
    <FlatList
      ref={(ref) => {
        listRef.current = ref
        onListRef?.(ref)
      }}
      style={[styles.list, style]}
      {...compatProps}
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={renderRow}
      ItemSeparatorComponent={
        itemSeparator !== undefined && itemSeparator !== null
          ? () => <>{itemSeparator}</>
          : () => <View style={styles.listGap} />
      }
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={headerNode === undefined ? undefined : () => <>{headerNode}</>}
      ListFooterComponent={() => (
        <>
          {orphanTailNode ?? null}
          {renderFooter ? renderFooter() : null}
          {showThinking
            ? (thinkingNode ?? (
                <View style={styles.thinkingRow}>
                  <Text style={styles.thinkingText}>{t('chat.thinking')}</Text>
                </View>
              ))
            : null}
        </>
      )}
    />
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    list: { flex: 1 },
    listContent: { paddingHorizontal: rnSpacing.md, paddingVertical: rnSpacing.sm },
    listGap: { height: rnSpacing.sm },
    rowUser: { alignItems: 'flex-end' },
    rowAi: { alignItems: 'flex-start' },
    bubble: {
      maxWidth: '82%',
      borderRadius: rnRadius.lg,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
    },
    bubbleUser: { backgroundColor: tk.brand.DEFAULT },
    bubbleAi: { backgroundColor: tk.surface.muted },
    bubbleText: { fontSize: rnType.body.size, color: tk.text.primary, lineHeight: 22 },
    reasoningToggle: { paddingVertical: rnSpacing['2xs'] },
    reasoningToggleText: { fontSize: rnType.label.size, color: tk.text.secondary },
    reasoningBody: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
      lineHeight: 18,
      marginBottom: rnSpacing.xs,
    },
    codeWrap: {
      marginVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.light,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      overflow: 'hidden',
    },
    codeHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: rnSpacing['2xs'],
    },
    codeLang: { flex: 1, fontSize: rnType.label.size, color: tk.text.tertiary },
    codeAction: { fontSize: rnType.label.size, color: tk.brand.DEFAULT },
    codeBody: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: rnSpacing.xs,
      fontSize: rnType.label.size,
      color: tk.text.primary,
    },
    image: { width: 160, height: 120, borderRadius: rnRadius.sm },
    fullscreen: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullscreenImage: { width: '100%', height: '80%' },
    thinkingRow: { paddingVertical: rnSpacing.sm },
    thinkingText: { fontSize: rnType.label.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
