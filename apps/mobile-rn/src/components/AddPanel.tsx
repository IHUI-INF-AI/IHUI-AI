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
 *   - AddPanel:统一底部滑出「添加」面板(BottomPops + 图标组网格,
 *     对齐 Uniapp isShowIcon 图标按钮组:相机/相册/本地文件/微信文件)
 *
 * 接入方:
 *   - InputArea(大输入框 showVoiceMic 分支,HomeScreen 用)→ PlusButton + 调用方 AddPanel
 *   - BottomActionBar(ChatScreen / AssistantScreen 用)→ PlusButton + AddPanel
 *     (原内嵌滑出图标组收敛为统一底部滑出面板,回调 onIconClick 契约不变)
 *
 * 交互契约:点击 PlusButton → 调用方切换 visible → AddPanel 底部滑出(键盘需调用方收起);
 * 上传/选择行为由调用方经 items[].onPress 注入,本组件不做任何业务。
 */
import { type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { tokens } from '../theme/active-tokens'
import { BottomPops } from './BottomPops'

import { rnRadius } from '@ihui/design-tokens'

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
  size = 20,
  label,
}: PlusButtonProps) {
  return (
    <Pressable
      style={[styles.plusButton, active ? styles.plusButtonActive : null]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label ?? (active ? '收起面板' : '展开面板')}
      accessibilityState={{ expanded: active, disabled }}
    >
      <View style={{ transform: [{ rotate: active ? '45deg' : '0deg' }] }}>
        <Plus size={size} color={active ? tokens.surface.light : tokens.text.secondary} />
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
  /** 点击回调(上传/选择等业务逻辑由调用方注入) */
  onPress: () => void
  disabled?: boolean
}

export interface AddPanelProps {
  visible: boolean
  onClose: () => void
  /** 面板项(图标组网格,一行 4 个自动换行) */
  items: ReadonlyArray<AddPanelItem>
  /** 面板标题,默认「添加」 */
  title?: string
}

export function AddPanel({ visible, onClose, items, title = '添加' }: AddPanelProps) {
  return (
    <BottomPops visible={visible} onClose={onClose} title={title}>
      <View style={styles.iconGroup}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.iconGroupItem, item.disabled ? styles.iconGroupItemDisabled : null]}
            onPress={item.onPress}
            disabled={item.disabled}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            {item.icon}
            <Text style={styles.iconGroupLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </BottomPops>
  )
}

// ── 样式(单一真源,原 BottomActionBar / HomeScreen 各自的 iconGroup 样式已收敛至此) ──

const styles = StyleSheet.create({
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: rnRadius.lg, // 原 10,R1 吸附至 lg(8)
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButtonActive: {
    backgroundColor: tokens.brand.DEFAULT,
  },
  iconGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 12,
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
  iconGroupItemDisabled: {
    opacity: 0.5,
  },
  iconGroupLabel: {
    fontSize: 11,
    color: tokens.text.secondary,
    marginTop: 2,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
