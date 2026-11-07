// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型 / Agent / 素材选择器共享层（块 5，契约见同目录 CONTRACTS.md）。
 *
 * 零平台 API：不请求模型、Agent、素材数据，不读存储、不弹系统框、不跳路由。
 * 数据由 wrapper 查好后经 props 传入；选择、关闭、打开、删除全部经回调回传。
 *
 * 顺序口径：
 * - models / agents / categories 一律按传入顺序渲染，组件不排序；
 * - materials 仅在给了 activeCategory 时按 category 等值过滤，过滤不改组内顺序。
 */
import { useMemo } from 'react'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'

export type ChatPickerMode = 'none' | 'model' | 'agent' | 'material'

export interface ChatPickerModel {
  id: string
  name: string
  iconSrc?: string
  badge?: string
}

export interface ChatPickerAgent {
  id: string
  name: string
  description?: string
  iconSrc?: string
}

export interface ChatPickerMaterial {
  id: string
  title: string
  coverSrc?: string
  category: string
  meta?: string
}

export interface ChatPickerCategory {
  key: string
  label: string
}

export interface ChatPickersProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  mode: ChatPickerMode
  models?: readonly ChatPickerModel[]
  activeModelId?: string
  agents?: readonly ChatPickerAgent[]
  activeAgentId?: string
  materials?: readonly ChatPickerMaterial[]
  categories?: readonly ChatPickerCategory[]
  activeCategory?: string

  onClose: () => void
  onModelChange?: (id: string) => void
  onAgentChange?: (id: string) => void
  onCategoryChange?: (key: string) => void
  onMaterialOpen?: (id: string) => void
  onMaterialRemove?: (id: string) => void
}

function titleKeyFor(mode: ChatPickerMode): string {
  switch (mode) {
    case 'model':
      return 'chat.selectModel'
    case 'agent':
      return 'chat.navAgent'
    default:
      return 'common.myCreation'
  }
}

/** 过滤只做等值匹配，保持入参顺序；未给 activeCategory 时不过滤。 */
function filterMaterials(
  materials: readonly ChatPickerMaterial[],
  activeCategory?: string,
): readonly ChatPickerMaterial[] {
  if (!activeCategory) return materials
  return materials.filter((material) => material.category === activeCategory)
}

/** 无图标时的文字占位：取名称首字，不引图标库。 */
function glyphFor(label: string): string {
  return label.trim().slice(0, 1)
}

export function ChatPickers({
  t,
  colorScheme = 'light',
  mode,
  models = [],
  activeModelId,
  agents = [],
  activeAgentId,
  materials = [],
  categories = [],
  activeCategory,
  onClose,
  onModelChange,
  onAgentChange,
  onCategoryChange,
  onMaterialOpen,
  onMaterialRemove,
}: ChatPickersProps) {
  const tokens = useMemo(() => getTokens(colorScheme), [colorScheme])
  const styles = useMemo(() => createStyles(tokens), [tokens])

  if (mode === 'none') return null

  const visibleMaterials = filterMaterials(materials, activeCategory)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{t(titleKeyFor(mode))}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              hitSlop={8}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.closeGlyph}>{'✕'}</Text>
            </TouchableOpacity>
          </View>

          {mode === 'model' ? (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {models.map((model) => {
                const active = model.id === activeModelId
                return (
                  <TouchableOpacity
                    key={model.id}
                    style={[styles.row, active ? styles.rowActive : null]}
                    activeOpacity={0.7}
                    onPress={onModelChange ? () => onModelChange(model.id) : undefined}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    {model.iconSrc ? (
                      <Image
                        source={{ uri: model.iconSrc }}
                        style={styles.icon}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.icon, styles.iconFallback]}>
                        <Text style={styles.iconGlyph}>{glyphFor(model.name || model.id)}</Text>
                      </View>
                    )}
                    <View style={styles.rowBody}>
                      <Text
                        style={[styles.rowTitle, active ? styles.rowTitleActive : null]}
                        numberOfLines={1}
                      >
                        {model.name || model.id}
                      </Text>
                      {model.badge ? <Text style={styles.badge}>{model.badge}</Text> : null}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          ) : null}

          {mode === 'agent' ? (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {agents.map((agent) => {
                const active = agent.id === activeAgentId
                return (
                  <TouchableOpacity
                    key={agent.id}
                    style={[styles.row, active ? styles.rowActive : null]}
                    activeOpacity={0.7}
                    onPress={onAgentChange ? () => onAgentChange(agent.id) : undefined}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    {agent.iconSrc ? (
                      <Image
                        source={{ uri: agent.iconSrc }}
                        style={styles.icon}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.icon, styles.iconFallback]}>
                        <Text style={styles.iconGlyph}>{glyphFor(agent.name)}</Text>
                      </View>
                    )}
                    <View style={styles.rowBody}>
                      <Text
                        style={[styles.rowTitle, active ? styles.rowTitleActive : null]}
                        numberOfLines={1}
                      >
                        {agent.name}
                      </Text>
                      {agent.description ? (
                        <Text style={styles.rowDescription} numberOfLines={1}>
                          {agent.description}
                        </Text>
                      ) : null}
                    </View>
                    {active ? <Text style={styles.check}>{'✓'}</Text> : null}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          ) : null}

          {mode === 'material' ? (
            <View style={styles.materialWrap}>
              {categories.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.tabBar}
                  contentContainerStyle={styles.tabBarContent}
                >
                  {categories.map((category) => {
                    const active = category.key === activeCategory
                    return (
                      <TouchableOpacity
                        key={category.key}
                        style={[styles.chip, active ? styles.chipActive : null]}
                        activeOpacity={0.7}
                        onPress={
                          onCategoryChange ? () => onCategoryChange(category.key) : undefined
                        }
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                          {category.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              ) : null}

              <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                {visibleMaterials.map((material) => (
                  <TouchableOpacity
                    key={material.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={onMaterialOpen ? () => onMaterialOpen(material.id) : undefined}
                    accessibilityRole="button"
                  >
                    {material.coverSrc ? (
                      <Image
                        source={{ uri: material.coverSrc }}
                        style={styles.cover}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.cover, styles.iconFallback]}>
                        <Text style={styles.iconGlyph}>{glyphFor(material.title)}</Text>
                      </View>
                    )}
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {material.title}
                      </Text>
                      {material.meta ? (
                        <Text style={styles.rowDescription} numberOfLines={1}>
                          {material.meta}
                        </Text>
                      ) : null}
                    </View>
                    {onMaterialRemove ? (
                      <TouchableOpacity
                        style={styles.removeButton}
                        activeOpacity={0.7}
                        onPress={(event) => {
                          event.stopPropagation()
                          onMaterialRemove(material.id)
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.delete')}
                      >
                        <Text style={styles.removeText}>{t('common.delete')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function createStyles(tokens: AppThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: tokens.overlay.modal,
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '80%',
      backgroundColor: tokens.surface.card,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
    },
    title: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    closeButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeGlyph: {
      fontSize: rnType.title.size,
      color: tokens.text.tertiary,
    },
    body: {
      flexGrow: 0,
    },
    bodyContent: {
      paddingHorizontal: rnSpacing.md,
      paddingBottom: rnSpacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      gap: rnSpacing.sm,
    },
    rowActive: {
      backgroundColor: tokens.surface.muted,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    iconFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGlyph: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tokens.text.secondary,
    },
    cover: {
      width: 50,
      height: 50,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    rowBody: {
      flex: 1,
      gap: rnSpacing['2xs'],
    },
    rowTitle: {
      fontSize: rnType.body.size,
      color: tokens.text.medium,
    },
    rowTitleActive: {
      color: tokens.text.primary,
      fontWeight: '600',
    },
    rowDescription: {
      fontSize: rnType.label.size,
      color: tokens.text.tertiary,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing['2xs'],
      paddingVertical: 1,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.muted,
      fontSize: rnType.caption.size,
      color: tokens.text.tertiary,
    },
    check: {
      fontSize: rnType.body.size,
      color: tokens.brand.DEFAULT,
    },
    materialWrap: {
      flexGrow: 0,
    },
    tabBar: {
      flexGrow: 0,
      paddingHorizontal: rnSpacing.md,
    },
    tabBarContent: {
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
    },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    chipActive: {
      backgroundColor: tokens.brand.cta,
    },
    chipText: {
      fontSize: rnType.bodySm.size,
      color: tokens.text.secondary,
    },
    chipTextActive: {
      color: tokens.brand.ctaForeground,
    },
    removeButton: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.muted,
    },
    removeText: {
      fontSize: rnType.caption.size,
      color: tokens.danger.DEFAULT,
    },
  })
}
