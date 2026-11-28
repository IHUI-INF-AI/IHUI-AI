// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, FlatList, RefreshControl } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { BankCardInput, BankCardItem, BankCardScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { Check } from 'lucide-react-native'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'
import { TextField } from '../../components/TextField'

/** 银行卡列表共享屏 — props 注入式跨端组件 */
export type { BankCardInput, BankCardItem, BankCardScreenProps }

function maskNumber(num: string): string {
  if (!num) return ''
  if (num.includes('*')) return num
  if (num.length <= 4) return num
  return `**** **** **** ${num.slice(-4)}`
}

/**
 * 银行卡读写共享屏(2026-11-27 写闭环)。
 *
 * - 只读投影卡(`readOnly`)不渲染删除/设默认,避免把历史提现账户当成可编辑卡;
 * - 写能力由 `onAddCard` / `onDeleteCard` / `onSetDefaultCard` 注入,缺省时保持旧只读行为;
 * - 卡号只在新增表单出现,列表始终用后端掩码 DTO,不在前端还原完整卡号。
 */
export function BankCardScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  onAddCard,
  onDeleteCard,
  onSetDefaultCard,
  colorScheme = 'light',
}: BankCardScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [adding, setAdding] = useState(false)
  const [bankName, setBankName] = useState('')
  const [holder, setHolder] = useState('')
  const [number, setNumber] = useState('')
  const [formDefault, setFormDefault] = useState(false)
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const resetForm = () => {
    setBankName('')
    setHolder('')
    setNumber('')
    setFormDefault(false)
    setFormError('')
    setAdding(false)
  }

  const submitAdd = async () => {
    if (!onAddCard || formBusy) return
    const digits = number.replace(/[\s-]/g, '')
    if (!bankName.trim() || !holder.trim()) {
      setFormError(t('bankCard.formIncomplete'))
      return
    }
    if (!/^\d{12,19}$/.test(digits)) {
      setFormError(t('bankCard.invalidNumber'))
      return
    }
    setFormBusy(true)
    setFormError('')
    try {
      await onAddCard({
        number: digits,
        holder: holder.trim(),
        bankName: bankName.trim(),
        isDefault: formDefault,
      })
      resetForm()
    } catch {
      setFormError(t('bankCard.addFailed'))
    } finally {
      setFormBusy(false)
    }
  }

  const submitDelete = async (id: string) => {
    if (!onDeleteCard || rowBusy) return
    setRowBusy(id)
    setActionError('')
    try {
      await onDeleteCard(id)
      setConfirmId(null)
    } catch {
      setActionError(t('bankCard.deleteFailed'))
    } finally {
      setRowBusy(null)
    }
  }

  const submitDefault = async (id: string) => {
    if (!onSetDefaultCard || rowBusy) return
    setRowBusy(id)
    setActionError('')
    try {
      await onSetDefaultCard(id)
    } catch {
      setActionError(t('bankCard.setDefaultFailed'))
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('bankCard.title')}</Text>
        {onAddCard ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => (adding ? resetForm() : setAdding(true))}
            disabled={formBusy}
            accessibilityRole="button"
            testID="bank-card-add"
          >
            <Text style={styles.addBtnText}>
              {adding ? t('common.cancel') : t('bankCard.add')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      {adding && onAddCard ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{t('bankCard.add')}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t('bankCard.bankName')}</Text>
            <TextField
              colorScheme={colorScheme}
              testID="bank-card-bank-name"
              style={styles.input}
              value={bankName}
              onChangeText={setBankName}
              placeholder={t('bankCard.bankNamePlaceholder')}
              placeholderTextColor={tk.text.secondary}
              maxLength={40}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('bankCard.holder')}</Text>
            <TextField
              colorScheme={colorScheme}
              testID="bank-card-holder"
              style={styles.input}
              value={holder}
              onChangeText={setHolder}
              placeholder={t('bankCard.holderPlaceholder')}
              placeholderTextColor={tk.text.secondary}
              maxLength={40}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('bankCard.number')}</Text>
            <TextField
              colorScheme={colorScheme}
              testID="bank-card-number"
              style={styles.input}
              value={number}
              onChangeText={setNumber}
              placeholder={t('bankCard.numberPlaceholder')}
              placeholderTextColor={tk.text.secondary}
              keyboardType="number-pad"
              maxLength={23}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setFormDefault((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: formDefault }}
            testID="bank-card-form-default"
          >
            <View style={[styles.toggleBox, formDefault ? styles.toggleBoxOn : null]}>
              {formDefault ? (
                <Check size={rnType.badge.size} color={tk.brand.ctaForeground} strokeWidth={3} />
              ) : null}
            </View>
            <Text style={styles.toggleLabel}>{t('bankCard.formDefault')}</Text>
          </TouchableOpacity>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.ghostBtn, formBusy ? styles.disabled : null]}
              onPress={resetForm}
              disabled={formBusy}
              accessibilityRole="button"
            >
              <Text style={styles.ghostBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, formBusy ? styles.disabled : null]}
              onPress={() => void submitAdd()}
              disabled={formBusy}
              accessibilityRole="button"
              testID="bank-card-save"
            >
              <Text style={styles.primaryBtnText}>
                {formBusy ? t('bankCard.saving') : t('common.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <FlatList<BankCardItem>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
          ) : (
            <EmptyState title={t('bankCard.empty')} colorScheme={colorScheme} />
          )
        }
        renderItem={({ item }) => {
          const busy = rowBusy === item.id
          const editable = !item.readOnly
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.bankName}>{item.bankName}</Text>
                <View style={styles.badgeRow}>
                  {item.readOnly ? (
                    <View style={styles.readOnlyBadge}>
                      <Text style={styles.badgeText}>{t('bankCard.readOnly')}</Text>
                    </View>
                  ) : null}
                  {item.isDefault ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{t('bankCard.default')}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Text style={styles.cardNumber}>{maskNumber(item.number)}</Text>
              <Text style={styles.holder}>
                {t('bankCard.holder')}: {item.holder}
              </Text>
              {item.readOnly ? (
                <Text style={styles.readOnlyHint}>{t('bankCard.readOnlyHint')}</Text>
              ) : null}

              {editable && (onDeleteCard || onSetDefaultCard) ? (
                confirmId === item.id ? (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmText}>{t('bankCard.deleteConfirm')}</Text>
                    <View style={styles.confirmActions}>
                      <TouchableOpacity
                        style={styles.confirmCancel}
                        onPress={() => setConfirmId(null)}
                        disabled={busy}
                        accessibilityRole="button"
                      >
                        <Text style={styles.actionText}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmDelete}
                        onPress={() => void submitDelete(item.id)}
                        disabled={busy}
                        accessibilityRole="button"
                        testID={`bank-card-delete-confirm-${item.id}`}
                      >
                        <Text style={styles.confirmDeleteText}>
                          {busy ? t('bankCard.deleting') : t('common.delete')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.cardActions}>
                    {!item.isDefault && onSetDefaultCard ? (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => void submitDefault(item.id)}
                        disabled={busy}
                        accessibilityRole="button"
                        testID={`bank-card-default-${item.id}`}
                      >
                        <Text style={styles.actionText}>
                          {busy ? t('bankCard.saving') : t('bankCard.setDefault')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {onDeleteCard ? (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                          setActionError('')
                          setConfirmId(item.id)
                        }}
                        disabled={busy}
                        accessibilityRole="button"
                        testID={`bank-card-delete-${item.id}`}
                      >
                        <Text style={styles.actionDeleteText}>{t('common.delete')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )
              ) : null}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { flex: 1, fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    addBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    addBtnText: { fontSize: rnType.body.size, color: tk.text.primary },
    error: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.danger.deepText,
    },
    form: {
      marginHorizontal: rnSpacing['sm-loose'],
      marginBottom: rnSpacing.md,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    formTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    field: { gap: rnSpacing['2xs'] },
    label: { fontSize: rnType.body.size, color: tk.text.secondary },
    input: { color: tk.text.primary, backgroundColor: tk.surface.bg },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
    },
    toggleBox: {
      width: 20,
      height: 20,
      borderRadius: rnRadius.xs,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
    },
    toggleBoxOn: { borderColor: tk.brand.cta, backgroundColor: tk.brand.cta },
    toggleLabel: { fontSize: rnType.body.size, color: tk.text.primary },
    formError: { fontSize: rnType.body.size, color: tk.danger.deepText },
    formActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: rnSpacing.sm,
      marginTop: rnSpacing['2xs'],
    },
    ghostBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    ghostBtnText: { fontSize: rnType.body.size, color: tk.text.secondary },
    primaryBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    disabled: { opacity: 0.55 },
    listBody: { padding: rnSpacing['sm-loose'] },
    separator: { height: 12 },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.brand.cta,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    bankName: { fontSize: rnType.title.size, fontWeight: '600', color: tk.brand.ctaForeground },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['2xs'] },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    readOnlyBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    badgeText: { fontSize: rnType.badge.size, color: tk.surface.light },
    cardNumber: {
      marginTop: rnSpacing['sm-loose'],
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
      letterSpacing: 1,
    },
    holder: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: 'rgba(255,255,255,0.85)',
    },
    readOnlyHint: {
      marginTop: rnSpacing['2xs'],
      fontSize: rnType.badge.size,
      color: 'rgba(255,255,255,0.65)',
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    actionBtn: { paddingVertical: rnSpacing['2xs'] },
    actionText: { fontSize: rnType.body.size, color: 'rgba(255,255,255,0.9)' },
    actionDeleteText: { fontSize: rnType.body.size, color: tk.danger.light },
    confirmBox: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: 'rgba(255,255,255,0.12)',
      gap: rnSpacing.sm,
    },
    confirmText: { fontSize: rnType.body.size, color: tk.brand.ctaForeground },
    confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: rnSpacing.md },
    confirmCancel: { paddingVertical: rnSpacing['2xs'], paddingHorizontal: rnSpacing.sm },
    confirmDelete: {
      paddingVertical: rnSpacing['2xs'],
      paddingHorizontal: rnSpacing.sm,
      borderRadius: rnRadius.xs,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    confirmDeleteText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.danger.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
