// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { LiveQuickActionsProps } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

/** 直播列表快捷动作条 — 平台无关;开播 / 直播日历 / 我的订阅 */
export type { LiveQuickActionsProps, LiveQuickActionsLabels } from '@ihui/types'

/**
 * 三个入口的等宽动作条。
 * - `onPressCalendar` 缺失时不渲染日历按钮(无直播日历对应实现的一端不传,避免用发布日历冒充)。
 * - 仅依赖 react-native 原语与主题 token,无任何平台 API,可被 RN / 小程序 / web 直接消费。
 */
export function LiveQuickActions({
  labels,
  onPressHost,
  onPressCalendar,
  onPressSubscriptions,
  colorScheme = 'light',
}: LiveQuickActionsProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const showCalendar = typeof onPressCalendar === 'function'

  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={labels.host}
        onPress={onPressHost}
        style={[styles.action, styles.actionPrimary]}
      >
        <Text style={[styles.label, styles.actionPrimaryText]} numberOfLines={1}>
          {labels.host}
        </Text>
      </TouchableOpacity>

      {showCalendar ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={labels.calendar}
          onPress={onPressCalendar}
          style={[styles.action, styles.actionSecondary]}
        >
          <Text style={styles.label} numberOfLines={1}>
            {labels.calendar}
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={labels.subscriptions}
        onPress={onPressSubscriptions}
        style={[styles.action, styles.actionSecondary]}
      >
        <Text style={styles.label} numberOfLines={1}>
          {labels.subscriptions}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing.sm,
    },
    action: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
    },
    actionPrimary: {
      backgroundColor: tk.brand.cta,
      borderColor: tk.brand.cta,
    },
    actionSecondary: {
      backgroundColor: tk.surface.card,
      borderColor: tk.border.light,
    },
    label: {
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    actionPrimaryText: {
      color: tk.brand.ctaForeground,
      fontWeight: '600',
    },
  })
}
