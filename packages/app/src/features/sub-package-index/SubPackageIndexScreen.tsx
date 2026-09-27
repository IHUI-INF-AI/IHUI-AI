// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, type TextStyle, type ViewStyle } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { SubPackageIndexScreenProps, SubPackageEntry } from '../../types'
import { BackChevron } from '../../components/BackChevron'

/** Props 类型 re-export(单一来源 @ihui/types) */
export type { SubPackageIndexScreenProps, SubPackageEntry }

/**
 * 子包功能入口聚合页共享屏 — 纯 UI 渲染,平台无关
 *
 * 渲染网格导航入口
 * 导航/数据由 wrapper 通过 props 注入
 */
export function SubPackageIndexScreen({
  t,
  onBack,
  entries,
  colorScheme = 'light',
}: SubPackageIndexScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>更多功能</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {entries.map((entry: SubPackageEntry) => (
            // 按压态样式不得写在 Pressable 的 style 上(守门 131 那一型):Pressable 注册过
            // cssInterop,函数形态声明被展开成空对象,整份内联样式静默消失。
            // 网格槽位档(宽度百分比)留在外层,含绘制的卡面档(底色/描边/圆角/padding/gap)
            // 下移到内层 View 的数组形态,再由面层把宽度显式还给盒子。
            <Pressable
              key={entry.title}
              style={styles.entryCardBox}
              onPress={entry.onPress}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.entryCardFace,
                    styles.entryCard,
                    pressed ? styles.entryCardPressed : null,
                  ]}
                >
                  {typeof entry.icon === 'string' ? (
                    <Text style={styles.entryIcon}>{entry.icon}</Text>
                  ) : entry.icon ? (
                    <entry.icon size={32} color={tk.text.primary} />
                  ) : null}
                  <Text style={styles.entryTitle} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.entryDesc} numberOfLines={2}>
                    {entry.desc}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    } as ViewStyle,
    headerTitle: { fontSize: 20, fontWeight: '600', color: tk.text.primary } as TextStyle,
    scrollContent: { paddingHorizontal: 10, paddingVertical: 12 } as ViewStyle,
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as ViewStyle,
    // 外框:两列网格里占槽位的宽度档(逐字取自原 entryCard 的 width,未新增数字档)
    entryCardBox: { width: '47%' } as ViewStyle,
    // 面层:把宽度显式还给盒子(按压态下移到内层后,外框按内容收拢会丢整格宽);
    // flex:1 把高度也还给盒子 —— 外层在 row + 默认 alignItems:stretch 下被拉成同行等高,
    // 内层若不撑满则底色高度改由内容决定,一行里"一行描述"与"两行描述"两张卡会出现
    // 可见的底色不齐。这是布局关系档(不是任何 px 数字档),与同批 CourseDetail/Learn/LiveDetail
    // 三屏 entryBtnHit 的处置同形。
    entryCardFace: { width: '100%', flex: 1 } as ViewStyle,
    entryCard: {
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.xl,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: 14,
      gap: 6,
      alignItems: 'center',
    } as ViewStyle,
    entryCardPressed: { backgroundColor: tk.surface.muted } as ViewStyle,
    entryIcon: { fontSize: 32 } as TextStyle,
    entryTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary } as TextStyle,
    entryDesc: {
      fontSize: 14,
      color: tk.text.tertiary,
      textAlign: 'center',
      lineHeight: 16,
    } as TextStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
