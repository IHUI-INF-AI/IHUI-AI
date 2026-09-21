// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { rpx } from '../utils/rpx'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RN 端「关于我们」页(2026-09-05 恢复历史合规跳转列表)。
 *
 * 对齐历史 Uniapp pagesA/settings/about.vue:
 * - 白色 section-card 圆角 16rpx 内 7 项合规条目,每项 28rpx/24rpx 内边距 + 分隔线,
 *   右侧 24rpx 箭头(lucide ChevronRight 对齐历史 arrow_right.png)
 * - 7 项均可点击跳转 RN 端已有合规页(RootStackParamList 均已注册):
 *   服务协议→Agreement / 隐私政策→Privacy / 应用权限→AppPermission / 使用规范→UsageRules
 *   / 营业执照→BusinessLicense / ICP备案→IcpRecord / 模型备案→ModelRecord
 *   (历史 appPermission 点击为空 toast,RN 端已有 AppPermissionScreen 故直接跳转)
 * - 此前被改为 app info 卡的 SharedAboutScreen 包装实现移除,恢复合规列表
 */

// 7 项合规条目(label 与历史 about.vue 1:1,target 为 RN 端已注册屏)
type ComplianceTarget =
  | 'Agreement'
  | 'Privacy'
  | 'AppPermission'
  | 'UsageRules'
  | 'BusinessLicense'
  | 'IcpRecord'
  | 'ModelRecord'
const COMPLIANCE_ITEMS: ReadonlyArray<{ label: string; target: ComplianceTarget }> = [
  { label: '服务协议', target: 'Agreement' },
  { label: '隐私政策', target: 'Privacy' },
  { label: '应用权限', target: 'AppPermission' },
  { label: '使用规范', target: 'UsageRules' },
  { label: '营业执照', target: 'BusinessLicense' },
  { label: 'ICP备案', target: 'IcpRecord' },
  { label: '模型备案', target: 'ModelRecord' },
]

export function AboutScreen() {
  const navigation = useNavigation<NavigationProp>()

  return (
    <View style={styles.container}>
      {/* 顶部导航(对齐历史 SettingsPageLayout「关于我们」+ 共享页 back 约定) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="返回"
        >
          <ChevronLeft size={rpx(40)} color={tokens.text.primary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>关于我们</Text>
      </View>

      {/* 合规条目卡(对齐历史 .section-card) */}
      <View style={styles.body}>
        <View style={styles.sectionCard}>
          {COMPLIANCE_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={item.target}
              style={index === 0 ? styles.item : [styles.item, styles.itemDivider]}
              onPress={() => navigation.navigate(item.target)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={styles.itemLabel}>{item.label}</Text>
              <ChevronRight size={rpx(24)} color={tokens.text.tertiary} strokeWidth={2} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(24),
  },
  title: {
    fontSize: rpx(40),
    fontWeight: '700',
    color: tokens.text.primary,
  },
  body: {
    padding: rpx(24),
  },
  // 白色圆角卡(历史 .section-card:bg #fff / 圆角 16rpx / overflow hidden)
  sectionCard: {
    backgroundColor: tokens.surface.card,
    borderRadius: rpx(16),
    overflow: 'hidden',
  },
  // 条目(历史 .settings-item:padding 28rpx 24rpx)
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: rpx(28),
    paddingHorizontal: rpx(24),
  },
  // 条目分隔线(历史 border-bottom 1rpx #f0f0f0;首项无线)
  itemDivider: {
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  itemLabel: {
    fontSize: rpx(30),
    color: tokens.text.primary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
