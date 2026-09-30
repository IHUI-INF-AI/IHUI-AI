// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LearnDevelopEntry, LearnDevelopScreenProps } from '../../types'

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'

export type { LearnDevelopEntry, LearnDevelopScreenProps }

/**
 * LearnDevelopScreen 学习导航页(共享层,平台无关 UI)
 *
 * 由端侧 wrapper 通过 props 注入真实学习功能入口(课程星球/学习计划/知识星球等卡片)与跳转,
 * 不再是「课程星球正在开发中」占位桩。卡片列表仅渲染端侧传入的 entries。
 */
export function LearnDevelopScreen({
  t,
  onBack,
  onContact,
  entries = [],
  colorScheme = 'light',
}: LearnDevelopScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('learnDevelop.title', { fallback: '学习开发' })}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {entries.map((entry: LearnDevelopEntry) => (
            // 按压态样式**不得写在 Pressable 的 style 上**(守门 131 那一型):Pressable 注册过
            // cssInterop,函数形态声明被 `{ ...declaration }` 清成 `{}`,卡面底色/描边/内边距静默消失。
            // width 47% 是外层在 grid(row + wrap)里"两列一排"的槽位档 ⇒ 留外层;
            // 面档落内层并撑满外层 —— grid 的 alignItems 默认 stretch,同一排里较矮的卡原本会被
            // 拉到本排最高者的高度,内层不写 height:100% 就会缩回自身内容高(观感会变),故补满。
            <Pressable
              key={entry.title}
              style={styles.entryCardBox}
              onPress={entry.onPress}
              accessibilityRole="button"
              accessibilityLabel={entry.title}
            >
              {({ pressed }) => (
                <View style={[styles.entryCard, pressed ? styles.entryCardPressed : null]}>
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
        {onContact ? (
          // 同上(守门 131):alignSelf/width/height/marginTop 是外层在滚动列里占槽位的布局档
          // (width 187 × height 38 定义盒子) ⇒ 留外层;底色/胶囊圆角/投影/居中档 + 淡出落内层,
          // 内层按 100% 撑满那个固定尺寸盒 ⇒ 钮的尺寸、居中与投影范围逐像素不变。
          <Pressable
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel={t('learnDevelop.contactLabel', { fallback: '直接联系李总' })}
            style={styles.detailsButtonBox}
          >
            {({ pressed }) => (
              <View style={[styles.detailsButton, pressed ? styles.detailsButtonPressed : null]}>
                <Text style={styles.detailsButtonText}>
                  {t('learnDevelop.contactLabel', { fallback: '直接联系李总' })}
                </Text>
              </View>
            )}
          </Pressable>
        ) : null}
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
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary } as TextStyle,
    scrollContent: { paddingHorizontal: 10, paddingVertical: 12, paddingBottom: 24 } as ViewStyle,
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as ViewStyle,
    // 外层 = "两列一排"的槽位档(守门 131:按压态不得写在 Pressable 的 style 上);
    // 卡面档在下面的 entryCard,由内层 View 撑满外层(47% 宽 + 本排拉伸高)。数值逐字搬移未新增。
    entryCardBox: {
      width: '47%',
    } as ViewStyle,
    entryCard: {
      width: '100%',
      height: '100%',
      backgroundColor: tk.surface.light,
      borderRadius: rnRadius.lg,
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
    // 同上:alignSelf/width/height/marginTop 是外层占槽位的布局档;钮面档在 detailsButton,
    // 内层按 100% 撑满那个固定尺寸盒 ⇒ 胶囊尺寸、居中与投影范围不变。数值逐字搬移未新增。
    detailsButtonBox: {
      alignSelf: 'center',
      width: 187,
      height: 38,
      marginTop: 24,
    } as ViewStyle,
    detailsButton: {
      width: '100%',
      height: '100%',
      borderRadius: 30, // radius-exempt: 高 38 的胶囊按钮,半径≥高度一半,渲染为完整胶囊,吸附方档会破坏形状
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.warning.amber,
      elevation: 3,
      shadowColor: tk.warning.amberLight,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 5,
    } as ViewStyle,
    detailsButtonPressed: { opacity: 0.8 } as ViewStyle,
    detailsButtonText: { fontSize: 16, fontWeight: '700', color: tk.text.primary } as TextStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
