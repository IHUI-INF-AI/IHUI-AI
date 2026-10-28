// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native'
import { rnRadius } from '@ihui/design-tokens'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { NotificationCard, createCardStyles } from '../../components/NotificationCard'
import { BackChevron } from '../../components/BackChevron'
import type {
  NotificationListItem,
  NotificationListScreenProps,
  NotificationType,
} from '../../types'

/**
 * 通知列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:只负责渲染列表 UI + 下拉刷新 + 通知卡片渲染。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */

export type { NotificationListItem, NotificationListScreenProps, NotificationType }

export function NotificationListScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
  partition = 'active',
  onPartitionChange,
  onArchive,
  onRestore,
  rowStatus,
}: NotificationListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const cardStyles = useMemo(() => createCardStyles(tk), [tk])
  const isArchivedView = partition === 'archived'

  const typeLabel = (type: NotificationType) => {
    switch (type) {
      case 'system':
        return t('notificationList.type.system')
      case 'order':
        return t('notificationList.type.order')
      case 'course':
        return t('notificationList.type.course')
      case 'social':
        return t('notificationList.type.social')
      default:
        return t('notificationList.type.system')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('notificationList.title')}</Text>
      </View>

      {/* D195 分区开关:隐藏必须可撤销,所以「返回动态 / 已归档」常驻在同一屏面上。 */}
      {onPartitionChange ? (
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentItem, !isArchivedView && styles.segmentActive]}
            onPress={() => onPartitionChange('active')}
          >
            <Text style={[styles.segmentText, !isArchivedView && styles.segmentTextActive]}>
              {t('notificationList.viewActive')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentItem, isArchivedView && styles.segmentActive]}
            onPress={() => onPartitionChange('archived')}
          >
            <Text style={[styles.segmentText, isArchivedView && styles.segmentTextActive]}>
              {t('notificationList.archived')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>
                {t(isArchivedView ? 'notificationList.emptyArchived' : 'notificationList.empty')}
              </Text>
            </View>
          ) : (
            items.map((item: NotificationListItem) => {
              const st = rowStatus?.[item.id]
              return (
                <NotificationCard
                  key={item.id}
                  item={item}
                  typeLabel={typeLabel}
                  onPress={onPressItem}
                  styles={cardStyles}
                  actionLabel={t(
                    isArchivedView ? 'notificationList.restore' : 'notificationList.hide',
                  )}
                  actionPending={st?.pending === true}
                  onAction={() => (isArchivedView ? onRestore?.(item) : onArchive?.(item))}
                  statusText={st?.text}
                  statusTone={st?.tone}
                />
              )
            })
          )}
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 10, fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 10 },
    segment: {
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 10,
      paddingBottom: 8,
    },
    segmentItem: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.light,
    },
    segmentActive: {
      backgroundColor: tk.surface.card,
    },
    segmentText: {
      fontSize: 13,
      color: tk.text.secondary,
    },
    segmentTextActive: {
      color: tk.text.primary,
      fontWeight: '600',
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
