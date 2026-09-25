// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AnnouncementDetailItem, AnnouncementDetailScreenProps } from '../../types'

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'

/** 公告详情/Props 类型 re-export(单一来源 @ihui/types) */
export type { AnnouncementDetailItem, AnnouncementDetailScreenProps }

/**
 * 公告详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染返回按钮 + 公告标题 + 作者/发布时间 + 正文。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function AnnouncementDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: AnnouncementDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading)
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )

  if (error || !item)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('announcementDetail.empty')}</Text>
        {/* back-label-exempt: 错误态/空态卡片内的按钮文案,或翻页/弹窗关闭动作 —— 此处「返回」是按钮文字而非页头箭头,换裸箭头反而不表意 */}
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )

  return (
    <ScrollView style={styles.container}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{item.author}</Text>
        <Text style={styles.meta}>{item.publishTime}</Text>
      </View>
      <Text style={styles.content}>{item.content}</Text>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 10,
      paddingBottom: 32,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    error: { fontSize: 14, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      marginBottom: 12,
    },
    author: { fontSize: 14, color: tk.text.secondary, fontWeight: '500' },
    meta: { fontSize: 11, color: tk.text.tertiary },
    content: { fontSize: 16, lineHeight: 24, color: tk.text.medium },
    btn: {
      marginTop: 12,
      paddingHorizontal: 16,
      height: 44,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { color: tk.surface.light, fontSize: 14 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
