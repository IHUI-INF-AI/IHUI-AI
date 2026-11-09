// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ChevronDown, Maximize2, Scissors, Settings, Sparkles } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnGeometry, rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'

export type ChatActionBarIconType = 'camera' | 'album' | 'file' | 'wxfile'

export interface ChatActionBarAction {
  key: string
  label: string
  glyph?: string
  visible?: boolean
  disabled?: boolean
  onPress: () => void
}

export interface ChatActionBarToggle {
  key: string
  label: string
  active: boolean
  disabled?: boolean
}

export interface ChatActionBarImage {
  id: string
  uri: string
}

export interface ChatActionBarProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  modelLabel?: string
  images?: readonly ChatActionBarImage[]
  actions?: readonly ChatActionBarAction[]
  toggles?: readonly ChatActionBarToggle[]
  compacting?: boolean

  onImageRemove?: (index: number) => void
  onToggle?: (key: string) => void
  onShowModelList?: () => void
  onShowModelConfig?: () => void
  onModelConfigChange?: (config: unknown) => void
  onCompactContext?: () => void
  onFunctionHandle?: () => void
  onPlusToggle?: () => void
  onFangda?: () => void
  onShowMyCreation?: () => void
  onIconClick?: (type: ChatActionBarIconType) => void
}

/** 动作按钮高度 44(块 4 契约固定档) */
const ACTION_HEIGHT = 44
/** 图标钮 44×44(块 4 契约固定档) */
const CONTROL_BOX = 44
/** 底部动作条外边距 12(块 4 契约固定档) */
const BAR_MARGIN = 12
const MODEL_BAR_HEIGHT = 28
const IMAGE_PREVIEW_SIZE = 48
const IMAGE_REMOVE_SIZE = 16

/** 图标类型 → 字形(共享层不依赖图标库,统一走 Text 字形) */
const ICON_GLYPHS: Record<ChatActionBarIconType, string> = {
  camera: '📷',
  album: '🖼',
  file: '📁',
  wxfile: '💬',
}

/** 图标类型 → i18n key(与 RN BottomActionBar 的入口文案同义) */
const ICON_LABEL_KEYS: Record<ChatActionBarIconType, string> = {
  camera: 'bab.camera',
  album: 'bab.album',
  file: 'bab.localFile',
  wxfile: 'bab.wxFile',
}

/** 图标组固定顺序(camera/album/file/wxfile,契约四类联合) */
const DEFAULT_ICON_ORDER: readonly ChatActionBarIconType[] = ['camera', 'album', 'file', 'wxfile']

/**
 * 块 4 底部动作条共享组件 — props 注入式跨端组件(纯 UI,不依赖平台 API)
 *
 * 渲染:模型条(名称 + 可选配置按钮) → 图片预览行(可移除) → 动作/开关行
 * → 压缩上下文入口(compacting 时不重复普通动作) → 辅助图标行 → 四类图标组。
 * 任一回调未传时对应控件不渲染。所有平台能力由 wrapper 注入。
 */
export function ChatActionBar({
  t,
  colorScheme = 'light',
  modelLabel,
  images = [],
  actions = [],
  toggles = [],
  compacting = false,
  onImageRemove,
  onToggle,
  onShowModelList,
  onShowModelConfig,
  onModelConfigChange,
  onCompactContext,
  onFunctionHandle,
  onPlusToggle,
  onFangda,
  onShowMyCreation,
  onIconClick,
}: ChatActionBarProps) {
  const tk = getTokens(colorScheme)
  const styles = createStyles(tk)

  const visibleActions = actions.filter((a) => a.visible !== false)
  const showModelBar = modelLabel !== undefined
  const hasAux =
    onFunctionHandle !== undefined ||
    onPlusToggle !== undefined ||
    onFangda !== undefined ||
    onShowMyCreation !== undefined

  const handleActionPress = (action: ChatActionBarAction): void => {
    if (action.disabled === true) return
    action.onPress()
  }

  return (
    <View style={styles.container}>
      {/* 模型条:名称可点开列表,长按回传配置变更 */}
      {showModelBar ? (
        <View style={styles.modelBar}>
          <Pressable
            style={styles.modelNameBtn}
            onPress={onShowModelList}
            onLongPress={
              onModelConfigChange
                ? () => onModelConfigChange({ trigger: 'model-name-longpress' })
                : undefined
            }
            disabled={compacting}
          >
            <Text style={styles.modelName} numberOfLines={1}>
              {modelLabel}
            </Text>
            {onShowModelList ? <ChevronDown size={12} color={tk.text.tertiary} /> : null}
          </Pressable>
          {onShowModelConfig ? (
            <TouchableOpacity
              style={styles.configBtn}
              onPress={onShowModelConfig}
              hitSlop={4}
              accessibilityLabel={t('bab.modelConfig')}
            >
              <Settings size={14} color={tk.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* 图片预览行:位于模型条下方,缩略图 48 + 右上角移除 16 */}
      {images.length > 0 ? (
        <View style={styles.imageRow}>
          {images.map((img: ChatActionBarImage, index: number) => (
            <View key={img.id} style={styles.imagePreview}>
              <Image source={{ uri: img.uri }} style={styles.imagePreviewImg} resizeMode="cover" />
              {onImageRemove ? (
                <TouchableOpacity
                  style={styles.imageRemove}
                  hitSlop={8}
                  onPress={() => onImageRemove(index)}
                  accessibilityLabel={t('chat.imageDelete')}
                >
                  <Text style={styles.imageRemoveText}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* 动作 + 开关行:compacting 时隐藏,避免与压缩入口重复 */}
      {!compacting && (visibleActions.length > 0 || toggles.length > 0) ? (
        <View style={styles.row}>
          {visibleActions.map((a: ChatActionBarAction) => (
            <TouchableOpacity
              key={a.key}
              style={[styles.actionBtn, a.disabled && styles.disabled]}
              onPress={() => handleActionPress(a)}
              disabled={a.disabled === true}
              accessibilityLabel={a.label}
            >
              {a.glyph ? <Text style={styles.actionGlyph}>{a.glyph}</Text> : null}
              <Text style={styles.actionText} numberOfLines={1}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
          {toggles.map((tg: ChatActionBarToggle) => (
            <TouchableOpacity
              key={tg.key}
              style={[
                styles.toggleChip,
                tg.active && styles.toggleChipActive,
                tg.disabled && styles.disabled,
              ]}
              onPress={() => onToggle?.(tg.key)}
              disabled={tg.disabled === true}
              accessibilityState={{ selected: tg.active }}
              accessibilityLabel={tg.label}
            >
              <Text style={[styles.toggleText, tg.active && styles.toggleTextActive]}>
                {tg.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* 压缩上下文入口:compacting 时仍显示(其余动作已隐藏) */}
      {onCompactContext ? (
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onCompactContext}
            accessibilityLabel={t('messageInput.compactButton')}
          >
            <Scissors size={16} color={tk.text.secondary} />
            <Text style={styles.actionText} numberOfLines={1}>
              {t('messageInput.compactButton')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 辅助图标行(功能/加号/放大/我的创作) */}
      {hasAux ? (
        <View style={styles.row}>
          {onFunctionHandle ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onFunctionHandle}
              accessibilityLabel={t('chat.fnTitle')}
            >
              <Text style={styles.iconGlyph}>ƒ</Text>
            </TouchableOpacity>
          ) : null}
          {onPlusToggle ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onPlusToggle}
              accessibilityLabel={t('common.more')}
            >
              <Text style={styles.iconGlyph}>＋</Text>
            </TouchableOpacity>
          ) : null}
          {onFangda ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onFangda}
              accessibilityLabel={t('bab.enlarge')}
            >
              <Maximize2 size={16} color={tk.text.secondary} />
            </TouchableOpacity>
          ) : null}
          {onShowMyCreation ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onShowMyCreation}
              accessibilityLabel={t('common.myCreation')}
            >
              <Sparkles size={16} color={tk.text.secondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* 四类图标组(相机/相册/文件/微信文件),每个 44×44 */}
      {onIconClick ? (
        <View style={styles.iconGroup}>
          {DEFAULT_ICON_ORDER.map((type: ChatActionBarIconType) => (
            <TouchableOpacity
              key={type}
              style={styles.iconBtn}
              onPress={() => onIconClick(type)}
              accessibilityLabel={t(ICON_LABEL_KEYS[type])}
            >
              <Text style={styles.iconGlyph}>{ICON_GLYPHS[type]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: BAR_MARGIN,
      paddingVertical: rnSpacing['xs-loose'],
      rowGap: rnSpacing.md,
      backgroundColor: tk.surface.bg,
    },
    modelBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: MODEL_BAR_HEIGHT,
    },
    modelNameBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['2xs'],
      flexShrink: 1,
    },
    modelName: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.tertiary,
      flexShrink: 1,
    },
    configBtn: {
      width: rnGeometry.tapBox,
      height: rnGeometry.tapBox,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageRow: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
    },
    imagePreview: {
      position: 'relative',
      width: IMAGE_PREVIEW_SIZE,
      height: IMAGE_PREVIEW_SIZE,
      borderRadius: rnRadius.sm,
      overflow: 'hidden',
      backgroundColor: tk.surface.muted,
    },
    imagePreviewImg: { width: '100%', height: '100%' },
    imageRemove: {
      position: 'absolute',
      top: rnSpacing['2xs'],
      right: rnSpacing['2xs'],
      width: IMAGE_REMOVE_SIZE,
      height: IMAGE_REMOVE_SIZE,
      borderRadius: IMAGE_REMOVE_SIZE / 2,
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageRemoveText: {
      color: tk.surface.light,
      fontSize: rnType.badge.size,
      lineHeight: rnType.badge.lineHeight,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
    },
    actionBtn: {
      height: ACTION_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadiusFor.control,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    actionGlyph: {
      fontSize: rnType.title.size,
      lineHeight: rnType.title.lineHeight,
      color: tk.text.secondary,
    },
    actionText: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.secondary,
    },
    toggleChip: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    toggleChipActive: {
      borderColor: tk.brandAccent.DEFAULT,
      backgroundColor: tk.surface.muted,
    },
    toggleText: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.secondary,
    },
    toggleTextActive: { color: tk.text.primary, fontWeight: '600' },
    iconGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['sm-loose'],
    },
    iconBtn: {
      width: CONTROL_BOX,
      height: CONTROL_BOX,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGlyph: {
      fontSize: rnType.title.size,
      lineHeight: rnType.title.lineHeight,
      color: tk.text.secondary,
    },
    disabled: { opacity: 0.4 },
  })
}
