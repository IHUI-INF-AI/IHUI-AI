import { useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  ModelEditAudience,
  ModelEditBaseInfo,
  ModelEditFieldValues,
  ModelEditOption,
  ModelEditPayCycle,
  ModelEditScreenProps,
  ModelEditSaleType,
} from '../../types'

/** 模型编辑共享屏 — props 注入式表单型跨端组件 */
export type {
  ModelEditAudience,
  ModelEditBaseInfo,
  ModelEditFieldValues,
  ModelEditOption,
  ModelEditPayCycle,
  ModelEditScreenProps,
  ModelEditSaleType,
}

/** 售卖方式选项(label 通过 i18n 注入) */
const SALE_TYPE_OPTIONS: { id: ModelEditSaleType; labelKey: string }[] = [
  { id: 'free', labelKey: 'modelEdit.saleFree' },
  { id: 'limited', labelKey: 'modelEdit.saleLimited' },
  { id: 'paid', labelKey: 'modelEdit.salePaid' },
]

/** 收费周期选项(label 通过 i18n 注入) */
const PAY_CYCLE_OPTIONS: { id: ModelEditPayCycle; labelKey: string }[] = [
  { id: 'month', labelKey: 'modelEdit.cycleMonth' },
  { id: 'year', labelKey: 'modelEdit.cycleYear' },
  { id: 'permanent', labelKey: 'modelEdit.cyclePermanent' },
]

/** 面向群体选项(label 通过 i18n 注入) */
const AUDIENCE_OPTIONS: { id: ModelEditAudience; labelKey: string }[] = [
  { id: 'all', labelKey: 'modelEdit.audienceAll' },
  { id: 'member', labelKey: 'modelEdit.audienceMember' },
]

export function ModelEditScreen({
  t,
  baseInfo,
  fields,
  categoryOptions,
  deptOptions,
  freeDurations,
  discountOptions,
  submitting,
  onChange,
  onToggleCategory,
  onSave,
  onCancel,
  colorScheme = 'light',
}: ModelEditScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const cycleLabelKey =
    fields.cycle === 'month'
      ? 'modelEdit.cycleMonth'
      : fields.cycle === 'year'
        ? 'modelEdit.cycleYear'
        : 'modelEdit.cyclePermanent'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('modelEdit.headerTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.baseCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{baseInfo.name.charAt(0)}</Text>
          </View>
          <View style={styles.baseMain}>
            <Text style={styles.baseName} numberOfLines={1}>
              {baseInfo.name}
            </Text>
            <Text style={styles.baseSub} numberOfLines={2}>
              {baseInfo.prologue}
            </Text>
          </View>
        </View>

        <Text style={styles.label}>{t('modelEdit.labelCategory')}</Text>
        <View style={styles.chipRow}>
          {categoryOptions.map((c) => {
            const active = fields.categories.includes(c.id)
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onToggleCategory(c.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.label}>{t('modelEdit.labelDept')}</Text>
        <View style={styles.chipRow}>
          {deptOptions.map((d) => {
            const active = fields.dept === d.id
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onChange('dept', d.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={styles.label}>{t('modelEdit.labelSaleType')}</Text>
        <View style={styles.chipRow}>
          {SALE_TYPE_OPTIONS.map((opt) => {
            const active = fields.saleType === opt.id
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onChange('saleType', opt.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {fields.saleType !== 'free' ? (
          <View style={styles.paidCard}>
            <Text style={styles.label}>{t('modelEdit.labelCycle')}</Text>
            <View style={styles.chipRow}>
              {PAY_CYCLE_OPTIONS.map((c) => {
                const active = fields.cycle === c.id
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onChange('cycle', c.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t(c.labelKey)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text style={styles.label}>
              {t('modelEdit.labelPrice', { cycle: t(cycleLabelKey) })}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceUnit}>¥</Text>
              <TextInput
                style={styles.priceInput}
                value={fields.price}
                onChangeText={(v) => onChange('price', v)}
                placeholder={t('modelEdit.pricePlaceholder')}
                placeholderTextColor={tk.text.tertiary}
                keyboardType="numeric"
              />
            </View>
            {fields.saleType === 'limited' ? (
              <>
                <Text style={styles.label}>{t('modelEdit.labelFreeDur')}</Text>
                <View style={styles.chipRow}>
                  {freeDurations.map((d) => {
                    const active = fields.freeDur === d
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => onChange('freeDur', d)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </>
            ) : null}
            <Text style={styles.label}>{t('modelEdit.labelDiscount')}</Text>
            <View style={styles.chipRow}>
              {discountOptions.map((d) => {
                const active = fields.discount === d.id
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onChange('discount', active ? '' : d.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ) : null}

        <Text style={styles.label}>{t('modelEdit.labelAudience')}</Text>
        <View style={styles.chipRow}>
          {AUDIENCE_OPTIONS.map((a) => {
            const active = fields.audience === a.id
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onChange('audience', a.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(a.labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={onSave}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>
            {submitting ? t('modelEdit.submitting') : t('modelEdit.submit')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    backText: { fontSize: 16, color: tk.text.secondary },
    headerTitle: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    headerSpacer: { width: 40 },
    body: { padding: 10, paddingBottom: 32 },
    baseCard: { flexDirection: 'row', marginBottom: 8 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarText: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    baseMain: { flex: 1 },
    baseName: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    baseSub: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.medium,
      marginTop: 16,
      marginBottom: 8,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      paddingHorizontal: 14,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.muted },
    chipText: { fontSize: 14, color: tk.text.medium },
    chipTextActive: { color: tk.text.primary, fontWeight: '600' },
    paidCard: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: tk.surface.muted },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: tk.surface.bg,
    },
    priceUnit: { fontSize: 18, fontWeight: '600', color: tk.brand.DEFAULT, marginRight: 8 },
    priceInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: tk.text.primary },
    btn: {
      marginTop: 28,
      height: 50,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light },
  })
}
