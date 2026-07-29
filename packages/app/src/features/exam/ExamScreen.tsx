import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ExamItem, ExamScreenProps, ExamStatus } from '../../types'

/** 考试/Props 类型 re-export(单一来源 @ihui/types) */
export type { ExamItem, ExamScreenProps, ExamStatus }

/**
 * 考试列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + toast/error 提示 + 考试卡片列表(标题 + 状态徽章 + 描述
 * + 时长/总分/及格分/题数/尝试次数 + 起止时间 + 开始考试按钮) + 下拉刷新。
 * 状态计算依赖 Date.now(),由 wrapper 通过 getStatus 回调注入。
 * 平台特定(导航 / API 调用 / 日期格式化 / toast 提示)由 wrapper 通过 props 注入。
 */
export function ExamScreen({
  t,
  items,
  getStatus,
  loading,
  refreshing,
  error,
  toast,
  onRefresh,
  onStart,
  onBack,
  colorScheme = 'light',
}: ExamScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusStyle = (status: ExamStatus) => {
    if (status === 'inProgress') {
      return { bg: tk.success.lighter, text: tk.success.deepText }
    }
    if (status === 'ended') {
      return { bg: tk.danger.light, text: tk.danger.DEFAULT }
    }
    return { bg: tk.surface.muted, text: tk.text.tertiary }
  }

  const statusKey = (status: ExamStatus) => {
    if (status === 'ended') return 'exam.ended'
    if (status === 'notStarted') return 'exam.notStarted'
    return 'exam.inProgress'
  }

  if (loading) {
    return (
      <View style={styles.fullCenter}>
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.fullCenter}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryBtnText}>{t('exam.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('exam.title')}</Text>
        <Text style={styles.subtitle}>{t('exam.subtitle')}</Text>
      </View>

      {toast ? <Text style={styles.toastText}>{toast}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList<ExamItem>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('exam.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = getStatus(item)
          const sc = statusStyle(status)
          const canStart =
            status === 'inProgress' &&
            (item.maxAttempts === 0 || item.attemptCount < item.maxAttempts)
          return (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>
                    {t(statusKey(status))}
                  </Text>
                </View>
              </View>
              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.metaWrap}>
                <Text style={styles.metaText}>
                  {t('exam.duration')}:{item.duration}m
                </Text>
                <Text style={styles.metaText}>
                  {t('exam.totalScore')}:{item.totalScore}
                </Text>
                <Text style={styles.metaText}>
                  {t('exam.passScore')}:{item.passScore}
                </Text>
              </View>
              <View style={styles.metaWrap}>
                <Text style={styles.metaText}>
                  {t('exam.questions')}:{item.questionCount}
                </Text>
                <Text style={styles.metaText}>
                  {t('exam.attempts')}:{item.attemptCount}/{item.maxAttempts || '∞'}
                </Text>
              </View>
              {item.startTime ? (
                <Text style={styles.metaText}>
                  {t('exam.start')}:{item.startTime}
                </Text>
              ) : null}
              {item.endTime ? (
                <Text style={styles.metaText}>
                  {t('exam.end')}:{item.endTime}
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
                  onPress={() => onStart(item)}
                  disabled={!canStart}
                  activeOpacity={0.7}
                >
                  <Text style={styles.startBtnText}>{t('exam.startExam')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    toastText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: tk.brand.DEFAULT },
    errorText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: tk.danger.DEFAULT },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryBtnText: { fontSize: 14, color: tk.surface.light },
    center: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    listBody: { padding: 16, paddingBottom: 32 },
    separator: { height: 10 },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: tk.text.primary },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: 'hidden',
    },
    statusText: { fontSize: 11 },
    cardDesc: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
    metaText: { fontSize: 12, color: tk.text.secondary },
    actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
    startBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    startBtnDisabled: { backgroundColor: tk.border.light },
    startBtnText: { fontSize: 13, fontWeight: '600', color: tk.surface.light },
  })
}
