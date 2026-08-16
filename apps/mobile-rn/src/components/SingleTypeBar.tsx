/**
 * SingleTypeBar 单选/多选分类条(mobile-rn 端)
 *
 * 对齐历史 Uniapp components/type-bar/single.vue + tab.vue 两个变体:
 *   - single.vue(单选):横向 scroll-x 分类条,active 项高亮,点击 emit change(整项)。
 *   - tab.vue(变体):在单选基础上扩展 showAll(「全部」入口)、customize(「自定义」+ 输入弹窗)、
 *     isSingleSelect(单选/多选切换),多选时 emit change 传选中项数组。
 *
 * 本组件以「单选」为默认形态(selectedId + onSelect),tab.vue 的能力全部下沉为可选 props,
 * 不破坏现有单选调用方。与 TitleSwitchTypeBar 区分:本组件单选时 selectedId 唯一。
 * 浅色优雅风;圆角守门(8,无 rounded-full);无分割线(gap 间距);类型零 any;禁用 purple/indigo。
 */
import { useState } from 'react'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export interface SingleTypeBarItem {
  id: string
  label: string
  /** 图标 URL(对齐 Uniapp butUrl/field1:选中/未选中各一张);不传则纯文字 */
  iconActive?: string
  iconInactive?: string
}

export interface SingleTypeBarProps {
  items: readonly SingleTypeBarItem[]
  /** 当前选中项 id(单选模式) */
  selectedId: string
  /** 选中项变更回调(单选模式,对齐 Uniapp single.vue emit change) */
  onSelect: (id: string) => void

  /** 显示「全部」入口(对齐 tab.vue showAll,默认 false);单选时点击清空为 '' */
  showAll?: boolean
  /** 显示「自定义」入口 + 输入弹窗(对齐 tab.vue customize,默认 false) */
  customize?: boolean
  /** 单选/多选(对齐 tab.vue isSingleSelect;默认 true 单选,保持既有行为) */
  isSingleSelect?: boolean
  /** 多选模式已选中 id 列表(对齐 tab.vue values → viewIds) */
  selectedIds?: readonly string[]
  /** 多选模式变更回调(对齐 tab.vue emit change 传选中数组) */
  onValuesChange?: (ids: string[]) => void

  /** 「全部」图标(选中/未选中;对齐 tab.vue 静态资源,可选,不传则纯文字) */
  allIconActive?: string
  allIconInactive?: string
  /** 「自定义」入口图标(可选) */
  customizeIcon?: string
  /** 「全部」文案(默认「全部」) */
  allLabel?: string
  /** 「自定义」文案(默认「自定义」) */
  customizeLabel?: string
  /** 自定义提交回调(预留:分类持久化/后端请求由调用方负责) */
  onCustomizeAdd?: (name: string) => void
}

export function SingleTypeBar({
  items,
  selectedId,
  onSelect,
  showAll = false,
  customize = false,
  isSingleSelect = true,
  selectedIds,
  onValuesChange,
  allIconActive,
  allIconInactive,
  customizeIcon,
  allLabel = '全部',
  customizeLabel = '自定义',
  onCustomizeAdd,
}: SingleTypeBarProps): React.JSX.Element {
  const [customizeVisible, setCustomizeVisible] = useState(false)
  const [customizeName, setCustomizeName] = useState('')

  const selectedIdSet = new Set<string>(selectedIds ?? [])
  const allActive = isSingleSelect ? selectedId === '' : (selectedIds?.length ?? 0) === 0
  const isActive = (id: string): boolean =>
    isSingleSelect ? id === selectedId : selectedIdSet.has(id)

  const handleAll = (): void => {
    if (isSingleSelect) onSelect('')
    else onValuesChange?.([])
  }

  const handleItem = (id: string): void => {
    if (isSingleSelect) {
      onSelect(id)
      return
    }
    const next = new Set<string>(selectedIds ?? [])
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onValuesChange?.(Array.from(next))
  }

  const closeCustomize = (): void => {
    setCustomizeVisible(false)
    setCustomizeName('')
  }

  const handleCustomizeConfirm = (): void => {
    const name = customizeName.trim()
    closeCustomize()
    if (name) onCustomizeAdd?.(name)
  }

  const renderTab = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
    iconSrc?: string,
  ): React.JSX.Element => (
    <Pressable
      key={key}
      style={({ pressed }) => [
        styles.item,
        active ? styles.itemActive : null,
        pressed ? styles.itemPressed : null,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      {iconSrc ? (
        <Image source={{ uri: iconSrc }} style={styles.icon} resizeMode="contain" />
      ) : null}
      <Text style={[styles.text, active ? styles.textActive : null]}>{label}</Text>
    </Pressable>
  )

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {showAll
          ? renderTab(
              '__all__',
              allLabel,
              allActive,
              handleAll,
              allActive ? allIconActive : allIconInactive,
            )
          : null}
        {items.map((item) =>
          renderTab(
            item.id,
            item.label,
            isActive(item.id),
            () => handleItem(item.id),
            isActive(item.id) ? item.iconActive : item.iconInactive,
          ),
        )}
        {customize
          ? renderTab(
              '__customize__',
              customizeLabel,
              false,
              () => setCustomizeVisible(true),
              customizeIcon,
            )
          : null}
      </ScrollView>

      <Modal
        visible={customizeVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCustomize}
      >
        <Pressable style={styles.mask} onPress={closeCustomize}>
          <View style={styles.customizeCard}>
            <Text style={styles.customizeTitle}>请设置自定义种类</Text>
            <TextInput
              style={styles.customizeInput}
              value={customizeName}
              onChangeText={setCustomizeName}
              maxLength={4}
              placeholder="请输入种类"
              placeholderTextColor={tokens.text.tertiary}
            />
            <Pressable
              style={({ pressed }) => [
                styles.customizeConfirm,
                pressed ? styles.itemPressed : null,
              ]}
              onPress={handleCustomizeConfirm}
              accessibilityRole="button"
              accessibilityLabel="确定"
            >
              <Text style={styles.customizeConfirmText}>确定</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
  } as ViewStyle,
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
  } as ViewStyle,
  icon: {
    width: 14,
    height: 14,
    marginRight: 4,
  } as ImageStyle,
  itemActive: {
    backgroundColor: tokens.brand.DEFAULT,
    borderColor: tokens.brand.DEFAULT,
  } as ViewStyle,
  itemPressed: {
    opacity: 0.85,
  } as ViewStyle,
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.text.secondary,
  } as TextStyle,
  textActive: {
    color: tokens.surface.light,
  } as TextStyle,
  mask: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.overlay.modal,
  } as ViewStyle,
  customizeCard: {
    width: 214,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    backgroundColor: tokens.surface.light,
  } as ViewStyle,
  customizeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.text.medium,
    marginBottom: 20,
  } as TextStyle,
  customizeInput: {
    width: 160,
    height: 28,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    borderRadius: 4,
    paddingHorizontal: 6,
    fontSize: 14,
    color: tokens.text.primary,
    marginBottom: 20,
  } as TextStyle,
  customizeConfirm: {
    width: 50,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
  } as ViewStyle,
  customizeConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.surface.light,
  } as TextStyle,
})

export default SingleTypeBar
