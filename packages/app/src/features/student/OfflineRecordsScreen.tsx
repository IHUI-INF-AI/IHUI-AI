// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 线下学习记录共享屏 — 对齐 web apps/web/app/(main)/student/offline-records/page.tsx。
 *
 * 纯展示 + 受控表单:记录列表(类型徽章/标题/简介/时长/日期/附件数,编辑与删除入口)
 * 与内联新建/编辑表单(type/title/description/hours/occurredAt)。
 * 附件上传为 web 端对话框能力(RN 薄壳展示附件数并原样回传已有附件,不提供新增上传)。
 */
import { useMemo } from 'react'
import { CalendarClock, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react-native'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { createStudentStyles, STUDENT_PALETTE } from './student-styles'

export interface OfflineRecordAttachmentItem {
  url: string
  name: string
  type: string
  size: number
}

export interface OfflineRecordItem {
  id: string
  type: string
  title: string
  description: string | null
  hours: number | null
  occurredAt: string | null
  attachments: OfflineRecordAttachmentItem[]
}

export interface OfflineRecordFormState {
  type: string
  title: string
  description: string
  hours: string
  occurredAt: string
}

export interface OfflineRecordsScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  error?: string | null
  records?: OfflineRecordItem[]
  onRefresh?: () => void
  onCreate?: () => void
  onEdit?: (record: OfflineRecordItem) => void
  onDelete?: (record: OfflineRecordItem) => void
  formOpen?: boolean
  editingId?: string | null
  form?: OfflineRecordFormState
  onFieldChange?: (key: keyof OfflineRecordFormState, value: string) => void
  saving?: boolean
  formError?: string | null
  onSave?: () => void
  onCancelForm?: () => void
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function OfflineRecordsScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  error = null,
  records = [],
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
  formOpen = false,
  editingId = null,
  form,
  onFieldChange,
  saving = false,
  formError = null,
  onSave,
  onCancelForm,
}: OfflineRecordsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStudentStyles(tk), [tk])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('offlineRecordsPage.title')}</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.pagerBtn}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('offlineRecordsPage.create')}
          onPress={() => onCreate?.()}
        >
          <Plus size={14} color={tk.text.primary} strokeWidth={2} />
          <Text style={styles.pagerBtnText}>{t('offlineRecordsPage.create')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  if (error && !loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.card, styles.errorBox]}>
          <Text style={styles.errorText}>{error}</Text>
          {onRefresh ? (
            <TouchableOpacity
              style={styles.refreshBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('studentPage.retry')}
              onPress={onRefresh}
            >
              <Text style={styles.refreshText}>{t('studentPage.retry')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('offlineRecordsPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('offlineRecordsPage.subtitle')}</Text>
        </View>

        {formOpen && form ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {editingId ? t('offlineRecordsPage.editTitle') : t('offlineRecordsPage.createTitle')}
            </Text>
            <View>
              <Text style={styles.formLabel}>{t('offlineRecordsPage.type')}</Text>
              <TextField
                colorScheme={colorScheme}
                style={styles.input}
                value={form.type}
                placeholder={t('offlineRecordsPage.typePlaceholder')}
                placeholderTextColor={tk.text.tertiary}
                onChangeText={(v) => onFieldChange?.('type', v)}
              />
            </View>
            <View>
              <Text style={styles.formLabel}>{t('offlineRecordsPage.titleField')}</Text>
              <TextField
                colorScheme={colorScheme}
                style={styles.input}
                value={form.title}
                placeholder={t('offlineRecordsPage.titlePlaceholder')}
                placeholderTextColor={tk.text.tertiary}
                onChangeText={(v) => onFieldChange?.('title', v)}
              />
            </View>
            <View>
              <Text style={styles.formLabel}>{t('offlineRecordsPage.descLabel')}</Text>
              <TextField
                colorScheme={colorScheme}
                style={styles.inputArea}
                multiline
                value={form.description}
                onChangeText={(v) => onFieldChange?.('description', v)}
              />
            </View>
            <View style={styles.formRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.formLabel}>{t('offlineRecordsPage.hoursLabel')}</Text>
                <TextField
                  colorScheme={colorScheme}
                  style={styles.input}
                  keyboardType="numeric"
                  value={form.hours}
                  onChangeText={(v) => onFieldChange?.('hours', v)}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.formLabel}>{t('offlineRecordsPage.dateLabel')}</Text>
                <TextField
                  colorScheme={colorScheme}
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={tk.text.tertiary}
                  value={form.occurredAt}
                  onChangeText={(v) => onFieldChange?.('occurredAt', v)}
                />
              </View>
            </View>
            {formError ? <Text style={styles.formErr}>{formError}</Text> : null}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.ctaBtn, { flex: 1 }]}
                activeOpacity={0.85}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={t('studentPage.save')}
                onPress={() => onSave?.()}
              >
                <Text style={styles.ctaBtnText}>{t('studentPage.save')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostBtn}
                activeOpacity={0.85}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={t('studentPage.cancel')}
                onPress={() => onCancelForm?.()}
              >
                <Text style={styles.ghostBtnText}>{t('studentPage.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading && records.length === 0 ? (
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
            <View style={styles.skeletonRow} />
          </View>
        ) : records.length === 0 ? (
          <View style={styles.emptyBox}>
            <CalendarClock size={28} color={tk.text.tertiary} strokeWidth={2} />
            <Text style={styles.emptyText}>{t('studentPage.empty')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {records.map((record, idx) => (
              <View
                key={record.id}
                style={[styles.row, idx === records.length - 1 ? { borderBottomWidth: 0 } : null]}
              >
                <View style={styles.rowMain}>
                  <View style={styles.cardHead}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {record.title}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: STUDENT_PALETTE.completed.bg }]}>
                      <Text style={[styles.badgeText, { color: STUDENT_PALETTE.completed.fg }]}>
                        {record.type}
                      </Text>
                    </View>
                  </View>
                  {record.description ? (
                    <Text style={styles.rowBody} numberOfLines={2}>
                      {record.description}
                    </Text>
                  ) : null}
                  <View style={styles.rowMeta}>
                    <Text style={styles.rowSub}>
                      {t('offlineRecordsPage.hoursValue', { value: record.hours ?? 0 })}
                    </Text>
                    <Text style={styles.rowSub}>{formatDate(record.occurredAt)}</Text>
                    {record.attachments.length > 0 ? (
                      <View style={styles.metaItem}>
                        <Paperclip size={12} color={tk.text.tertiary} strokeWidth={2} />
                        <Text style={styles.metaText}>
                          {t('offlineRecordsPage.attachmentsCount', {
                            count: record.attachments.length,
                          })}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.iconBtn}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t('offlineRecordsPage.edit')}
                  onPress={() => onEdit?.(record)}
                >
                  <Pencil size={16} color={tk.text.secondary} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t('studentPage.delete')}
                  onPress={() => onDelete?.(record)}
                >
                  <Trash2 size={16} color={STUDENT_PALETTE.rejected.fg} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
