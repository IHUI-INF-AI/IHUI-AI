// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AddPanel 统一「添加」入口组件组 (mobile-rn 端)
 *
 * 2026-09-22 用户明令「把这些加号都整合成一个,别乱七八糟」——全项目加号按钮与
 * 添加面板收敛到本文件单一真源,禁止各输入组件再自绘 Plus 按钮 / 图标组面板:
 *   - PlusButton:统一加号触发按钮(激活时旋转 45° + 品牌色高亮,
 *     对齐 Uniapp InputArea search-box2:functionHandle 的 rotate-icon 动画)
 *   - AddPanel:统一底部滑出「添加」面板(BottomPops + 可选主入口行(heroItem)
 *     + 图标组网格,对齐 Uniapp isShowIcon 图标按钮组:相机/相册/本地文件/微信文件)
 *
 * 接入方:
 *   - InputArea(大输入框 showVoiceMic 分支,HomeScreen 用)→ PlusButton + 调用方 AddPanel
 *   - BottomActionBar(ChatScreen / AssistantScreen 用)→ PlusButton + AddPanel
 *     (原内嵌滑出图标组收敛为统一底部滑出面板,回调 onIconClick 契约不变)
 *
 * 交互契约:点击 PlusButton → 调用方切换 visible → AddPanel 底部滑出(键盘需调用方收起);
 * 上传/选择行为由调用方经 items[].onPress 注入,本组件不做任何业务;点按任意项
 * (含 heroItem)执行业务后统一收起面板。
 */
import { type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronRight, Plus } from 'lucide-react-native'
import { tokens } from '../theme/active-tokens'
import { BottomPops } from './BottomPops'

import { rnGeometry, rnRadius, rnSpacing } from '@ihui/design-tokens'
import { useI18n } from '../i18n'

// ── PlusButton 统一加号按钮 ──────────────────────────────────────────────

export interface PlusButtonProps {
  /** 激活态:图标旋转 45° + 品牌色高亮(面板展开时由调用方传入) */
  active?: boolean
  onPress?: () => void
  disabled?: boolean
  /** 图标尺寸,默认 20 */
  size?: number
  /** 无障碍标签,默认按激活态取「展开面板/收起面板」 */
  label?: string
}

export function PlusButton({
  active = false,
  onPress,
  disabled = false,
  size = rnGeometry.controlGlyph,
  label,
}: PlusButtonProps) {
  const { t } = useI18n()
  return (
    <Pressable
      style={[styles.plusButton, active ? styles.plusButtonActive : null]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label ?? (active ? t('common.panelCollapse') : t('common.panelExpand'))}
      accessibilityState={{ expanded: active, disabled }}
    >
      <View style={{ transform: [{ rotate: active ? '45deg' : '0deg' }] }}>
        {/* 实底取 brand.cta,前景必须取它的**配对档** ctaForeground —— 此前写的是 surface.light,
            而 AGENTS §4 明列"底取 brand.cta、字却取 surface.light"为跨档错配(亮档下白压白)。
            前景与底不同档不是观感偏好问题:守门 83 的 R1/R7 就是把这一型判红的。 */}
        <Plus size={size} color={active ? tokens.brand.ctaForeground : tokens.text.secondary} />
      </View>
    </Pressable>
  )
}

// ── AddPanel 统一底部滑出「添加」面板 ─────────────────────────────────────

export interface AddPanelItem {
  /** 稳定 key */
  key: string
  /** 图标(ReactNode,由调用方传入,统一 24 尺寸 + text.secondary 色) */
  icon: ReactNode
  /** 图标下方文字标签 */
  label: string
  /** 主入口行(heroItem)专用副标题;网格项不渲染 */
  subtitle?: string
  /** 点击回调(上传/选择等业务逻辑由调用方注入) */
  onPress: () => void
  disabled?: boolean
}

export interface AddPanelProps {
  visible: boolean
  onClose: () => void
  /** 主入口项(可选):全宽单行,渲染在图标网格上方(如「我的创作」) */
  heroItem?: AddPanelItem
  /** 面板项(图标组网格,一行 4 个自动换行) */
  items: ReadonlyArray<AddPanelItem>
  /** 面板标题,默认「添加」 */
  title?: string
}

export function AddPanel({
  visible,
  onClose,
  heroItem,
  items,
  title: titleProp = '',
}: AddPanelProps) {
  const { t } = useI18n()
  /** 点按任意项执行业务后即收起面板(收敛 HomeScreen 各处理器自带的 setPlusPanelVisible(false)) */
  const pressItem = (item: AddPanelItem): void => {
    item.onPress()
    onClose()
  }

  return (
    <BottomPops visible={visible} onClose={onClose} title={titleProp ?? t('common.add')}>
      {heroItem ? (
        <Pressable
          disabled={heroItem.disabled}
          onPress={() => pressItem(heroItem)}
          accessibilityRole="button"
          accessibilityLabel={
            heroItem.subtitle ? `${heroItem.label},${heroItem.subtitle}` : heroItem.label
          }
        >
          {({ pressed }) => (
            <View
              style={[
                styles.heroItem,
                pressed ? styles.pressed : null,
                heroItem.disabled ? styles.disabled : null,
              ]}
            >
              <View style={styles.heroIconTile}>{heroItem.icon}</View>
              <View style={styles.heroTextGroup}>
                <Text style={styles.heroLabel} numberOfLines={1}>
                  {heroItem.label}
                </Text>
                {heroItem.subtitle ? (
                  <Text style={styles.heroSubtitle} numberOfLines={1}>
                    {heroItem.subtitle}
                  </Text>
                ) : null}
              </View>
              <ChevronRight size={rnGeometry.glyphMd} color={tokens.text.tertiary} />
            </View>
          )}
        </Pressable>
      ) : null}
      <View style={[styles.iconGroup, heroItem ? styles.iconGroupWithHero : null]}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            disabled={item.disabled}
            onPress={() => pressItem(item)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.iconGroupItem,
                  pressed ? styles.pressed : null,
                  item.disabled ? styles.disabled : null,
                ]}
              >
                {item.icon}
                <Text style={styles.iconGroupLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </BottomPops>
  )
}

// ── 样式(单一真源,原 BottomActionBar / HomeScreen 各自的 iconGroup 样式已收敛至此) ──

const styles = StyleSheet.create({
  plusButton: {
    width: rnGeometry.controlBox,
    height: rnGeometry.controlBox,
    borderRadius: rnRadius.sm, // control 档 sm(4)(RADIUS_ROLES:control→sm)
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButtonActive: {
    backgroundColor: tokens.brand.cta,
  },
  iconGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rnSpacing.sm,
    paddingBottom: rnSpacing.md,
  },
  iconGroupWithHero: {
    marginTop: rnSpacing.md,
  },
  iconGroupItem: {
    width: 72,
    height: 72,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.muted,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 主入口行(heroItem):全宽单行,与网格项同底同圆角,靠 36 图标方砖 + 副标题 + 箭头建立层级
  heroItem: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing.md,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.muted,
    paddingHorizontal: 14,
  },
  heroIconTile: {
    width: rnGeometry.tapBox,
    height: rnGeometry.tapBox,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextGroup: {
    flex: 1,
  },
  heroLabel: {
    fontSize: rnGeometry.textBody,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  heroSubtitle: {
    fontSize: rnGeometry.textCaption,
    color: tokens.text.tertiary,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.5,
  },
  iconGroupLabel: {
    fontSize: rnGeometry.textLabel,
    color: tokens.text.primary,
    marginTop: 2,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
