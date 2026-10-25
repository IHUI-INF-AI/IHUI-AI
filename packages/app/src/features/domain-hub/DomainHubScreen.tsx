// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { rnGeometry, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'
import { BackChevron } from '../../components/BackChevron'

/**
 * DomainHubScreen — 跨端共享「域入口二级屏」(G-921,2026-10-21)。
 *
 * 为什么进共享层:守门 39(门体)原先只认"有一条 `@ihui/rn-app` 的 import 就算已迁移",
 * 2026-10-21 加的「屏级共享」那一维要求 packages/app 里真有同名的那个屏 —— 本文件就是
 * 那一维的第一枚落地样本(与 `features/payment/PaymentScreen.tsx` 同型)。
 *
 * 平台无关边界(照既有共享屏的写法,不自立门户):
 *  - 导航:只收 `onBack` / `onSelect(key)` 回调,不 import 任何 router;
 *  - 文案:**已翻译的文本由平台注入**(`title` / `item.label`)。共享层不持有业务语言包,
 *    只有返回键那一条走 `t('common.back')`(与 PaymentScreen/AboutScreen 同一条口径);
 *  - 图标:`item.icon` 是平台注入的 ReactNode(条目图标来自 RN 侧 `navigation/domain-hub`
 *    的具名 Lucide 组件,共享层不绑定任何一套图标注册表);行尾箭头是本文件自带的
 *    `ChevronRight`(packages/app 自身就依赖 lucide-react-native,BackChevron 等先例在前);
 *  - `title` 为空串 = 未命中域的空态(只渲染返回键,不渲染标题与任何文案)—— 与原 RN
 *    实现"hub 取不到就只出导航壳"的行为逐字对齐,不新增语义。
 */
export interface DomainHubItem {
  /** 条目身份(作为列表 key);与注入侧用的 i18n key 同源,便于对账 */
  key: string
  /** 已翻译的条目名(平台注入) */
  label: string
  /** 条目图标(平台注入;可空 —— 空则不渲染图标位) */
  icon?: ReactNode
}

export interface DomainHubScreenProps {
  t: TFunction
  /** 已翻译的屏标题;空串 = 空态(见头注) */
  title: string
  items: DomainHubItem[]
  onSelect: (key: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export function DomainHubScreen({
  t,
  title,
  items,
  onSelect,
  onBack,
  colorScheme = 'light',
}: DomainHubScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.row}
            activeOpacity={0.85}
            onPress={() => onSelect(item.key)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            {item.icon ?? null}
            <Text numberOfLines={1} style={styles.rowLabel}>
              {item.label}
            </Text>
            <ChevronRight size={rnGeometry.glyphSm} color={tk.text.tertiary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: rnSpacing.sm },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.display.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    body: { flex: 1 },
    bodyContent: { padding: rnSpacing.md, gap: rnSpacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      minHeight: 56,
      paddingHorizontal: 14,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
    },
    rowLabel: { flex: 1, fontSize: rnType.title.size, color: tk.text.primary },
  })
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
