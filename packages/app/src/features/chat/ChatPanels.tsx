// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'

export type ChatPanelMode = 'none' | 'functions' | 'source'

export interface ChatPanelItem {
  key: string
  label: string
  glyph?: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
}

export interface ChatPanelsProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  mode: ChatPanelMode
  title?: string
  items?: readonly ChatPanelItem[]
  /** 底部安全区高度;由 wrapper 注入,组件不读平台尺寸 */
  bottomInset?: number
  onClose: () => void
}

/** 面板三列网格(块 4 契约固定档) */
const PANEL_COLUMNS = 3
/** 三列等宽:100% / 3 */
const PANEL_CELL_WIDTH = `${100 / PANEL_COLUMNS}%`
const PANEL_MAX_HEIGHT = 420

/**
 * 块 4 功能 / 来源面板共享组件 — props 注入式跨端组件(纯 UI,不依赖平台 API)
 *
 * mode='none' 整块不渲染;打开时半透明遮罩点击回传 onClose;
 * 用 Modal + 静态底部位移(无动画);items 三列网格且顺序不变。
 */
export function ChatPanels({
  t,
  colorScheme = 'light',
  mode,
  title,
  items = [],
  bottomInset = 0,
  onClose,
}: ChatPanelsProps) {
  const tk = getTokens(colorScheme)
  const styles = createStyles(tk)

  if (mode === 'none') return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* 半透明遮罩:点击关闭 */}
        <Pressable style={styles.mask} onPress={onClose} accessibilityLabel={t('common.close')} />
        {/* 底部面板:静态位移,无动画 */}
        <View style={[styles.panel, { paddingBottom: bottomInset }]}>
          <View style={styles.header}>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : (
              <View style={styles.titleSpacer} />
            )}
            <TouchableOpacity
              style={styles.closeBtn}
              hitSlop={4}
              onPress={onClose}
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.closeGlyph}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.grid}>
            {items.map((item: ChatPanelItem) => (
              <View key={item.key} style={styles.cell}>
                <TouchableOpacity
                  style={[
                    styles.cellBtn,
                    item.active && styles.cellBtnActive,
                    item.disabled && styles.cellBtnDisabled,
                  ]}
                  onPress={item.onPress}
                  disabled={item.disabled === true}
                  accessibilityState={{
                    selected: item.active === true,
                    disabled: item.disabled === true,
                  }}
                  accessibilityLabel={item.label}
                >
                  {item.glyph ? <Text style={styles.cellGlyph}>{item.glyph}</Text> : null}
                  <Text style={styles.cellLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: tk.overlay.modal,
    },
    mask: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    panel: {
      maxHeight: PANEL_MAX_HEIGHT,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tk.border.light,
    },
    title: {
      flex: 1,
      fontSize: rnType.title.size,
      lineHeight: rnType.title.lineHeight,
      color: tk.text.primary,
    },
    titleSpacer: { flex: 1 },
    closeBtn: {
      width: rnSpacing['4xl'],
      height: rnSpacing['4xl'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeGlyph: {
      fontSize: rnType.subtitle.size,
      lineHeight: rnType.subtitle.lineHeight,
      color: tk.text.secondary,
    },
    body: { maxHeight: PANEL_MAX_HEIGHT },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
    },
    cell: {
      width: PANEL_CELL_WIDTH,
      padding: rnSpacing.xs,
    },
    cellBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    cellBtnActive: {
      borderColor: tk.brandAccent.DEFAULT,
      backgroundColor: tk.surface.muted,
    },
    cellBtnDisabled: { opacity: 0.4 },
    cellGlyph: {
      fontSize: rnType.title.size,
      lineHeight: rnType.title.lineHeight,
      color: tk.text.secondary,
    },
    cellLabel: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.primary,
      textAlign: 'center',
    },
  })
}
