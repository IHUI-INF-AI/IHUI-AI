// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/

const STATUS_KEYS: Record<string, string> = {
  pending: 'invoices.statusPending',
  approved: 'invoices.statusApproved',
  invoicing: 'invoices.statusInvoicing',
  invoiced: 'invoices.statusInvoiced',
  rejected: 'invoices.statusRejected',
  canceled: 'invoices.statusCanceled',
}

/**
 * 发票管理 —— 对齐 web `/invoices`。
 *
 * 端点按 apps/api/src/routes/order.ts 现读(前缀 /api,登录态):
 *  - GET  /api/invoices/applications?page&pageSize ⇒ { list, total, page, pageSize }
 *  - POST /api/invoices/applications              ⇒ 201 { application }
 * 实列(edu_invoice_applications)是 invoiceType / amount(numeric 字符串) / status /
 * email / remark / createdAt —— web 接口声明的 invoiceNo 与 appliedAt 都不是表列,本屏不渲染。
 * 创建入参 amount 在 Zod(priceSchema)里是字符串,故表单按文本提交。
 */
interface InvoiceRow {
  id: string
  invoiceType: string
  amount: string
  status: string
  email: string | null
  remark: string | null
  createdAt: string
}

export default function InvoicesScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [invoiceType, setInvoiceType] = useState<'company' | 'personal'>('personal')
  const [amountText, setAmountText] = useState('')
  const [email, setEmail] = useState('')
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currencyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const typeLabel = (type: string) =>
    type === 'company'
      ? t('invoices.typeCompany')
      : type === 'personal'
        ? t('invoices.typePersonal')
        : type

  const load = useCallback(async (targetPage: number) => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetchApi<{ list: InvoiceRow[]; total: number }>(
        `/api/invoices/applications?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success) throw new Error(res.error)
      setRows(res.data?.list ?? [])
      setTotal(res.data?.total ?? 0)
    } catch {
      setRows([])
      setTotal(0)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(1)
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const goPage = (next: number) => {
    const target = Math.max(1, Math.min(totalPages, next))
    setPage(target)
    void load(target)
  }

  const onSubmit = async () => {
    const amount = amountText.trim()
    if (!AMOUNT_RE.test(amount) || Number(amount) <= 0) {
      appAlert(t('common.error'), t('invoices.amountInvalid'))
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, string> = { invoiceType, amount }
      if (email.trim()) body.email = email.trim()
      if (remark.trim()) body.remark = remark.trim()
      const res = await fetchApi('/api/invoices/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('invoices.submitFailed'))
        return
      }
      setFormOpen(false)
      setAmountText('')
      setEmail('')
      setRemark('')
      setPage(1)
      await load(1)
      appAlert(t('common.hint'), t('invoices.submitSuccess'))
    } catch {
      appAlert(t('common.error'), t('invoices.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('invoices.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>{t('invoices.subtitle')}</Text>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => setFormOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <Plus size={14} color={tokens.brand.ctaForeground} />
            <Text style={styles.applyBtnText}>
              {formOpen ? t('common.cancel') : t('invoices.apply')}
            </Text>
          </TouchableOpacity>
        </View>

        {formOpen ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('invoices.applyTitle')}</Text>
            <Text style={styles.label}>{t('invoices.invoiceType')}</Text>
            <View style={styles.typeRow}>
              {(['personal', 'company'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, invoiceType === type && styles.typeChipActive]}
                  onPress={() => setInvoiceType(type)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.typeChipText, invoiceType === type && styles.typeChipTextActive]}
                  >
                    {typeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>{t('invoices.amount')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={amountText}
              onChangeText={setAmountText}
              placeholder={t('invoices.amountPlaceholder')}
              keyboardType="decimal-pad"
              style={styles.input}
              editable={!submitting}
            />
            <Text style={styles.label}>{t('invoices.email')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={email}
              onChangeText={setEmail}
              placeholder={t('invoices.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              editable={!submitting}
            />
            <Text style={styles.label}>{t('invoices.remark')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={remark}
              onChangeText={setRemark}
              placeholder={t('invoices.remarkPlaceholder')}
              style={styles.input}
              editable={!submitting}
            />
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={() => void onSubmit()}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? t('invoices.submitting') : t('invoices.submit')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('invoices.loadFailed')}</Text>
            <TouchableOpacity onPress={() => void load(page)} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.stateBox}>
            <FileText size={28} color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('invoices.empty')}</Text>
          </View>
        ) : (
          <>
            {rows.map((inv) => (
              <View key={inv.id} style={styles.card}>
                <View style={styles.rowTop}>
                  <Text style={styles.amount}>{currencyFmt.format(Number(inv.amount ?? 0))}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {t(STATUS_KEYS[inv.status] ?? 'invoices.statusUnknown')}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.metaText}>
                    {t('invoices.invoiceType')}: {typeLabel(inv.invoiceType)}
                  </Text>
                  <Text style={styles.metaText}>{dateFmt.format(new Date(inv.createdAt))}</Text>
                </View>
                {inv.remark ? (
                  <Text style={styles.muted} numberOfLines={2}>
                    {inv.remark}
                  </Text>
                ) : null}
              </View>
            ))}
            {totalPages > 1 ? (
              <View style={styles.pager}>
                <TouchableOpacity
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                  onPress={() => goPage(page - 1)}
                  disabled={page <= 1}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={14} color={tokens.text.primary} />
                  <Text style={styles.pageBtnText}>{t('invoices.prev')}</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>{t('invoices.pageInfo', { page, totalPages })}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                  onPress={() => goPage(page + 1)}
                  disabled={page >= totalPages}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pageBtnText}>{t('invoices.next')}</Text>
                  <ChevronRight size={14} color={tokens.text.primary} />
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: 12, gap: 8, paddingBottom: 32 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    subtitle: { flex: 1, fontSize: 12, color: tokens.text.secondary, lineHeight: 18 },
    applyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
    },
    applyBtnText: { fontSize: 12, fontWeight: '600', color: tokens.brand.ctaForeground },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: 6,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
    label: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: {
      height: 32,
      paddingHorizontal: 14,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeChipActive: {
      borderColor: tokens.brandAccent.deep,
      backgroundColor: tokens.brandAccent.light,
    },
    typeChipText: { fontSize: 12, color: tokens.text.secondary },
    typeChipTextActive: { color: tokens.brandAccent.deep, fontWeight: '600' },
    input: {
      height: 42,
      paddingHorizontal: 12,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: 14,
      backgroundColor: tokens.surface.bg,
    },
    submitBtn: {
      height: 42,
      marginTop: 6,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.5 },
    submitBtnText: { fontSize: 14, fontWeight: '600', color: tokens.brand.ctaForeground },
    stateBox: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },
    errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    muted: { fontSize: 12, color: tokens.text.secondary },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    amount: { flexShrink: 0, fontSize: 17, fontWeight: '700', color: tokens.text.primary },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tokens.surface.muted,
    },
    statusText: { fontSize: 11, fontWeight: '600', color: tokens.text.secondary },
    rowMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    metaText: { fontSize: 11, color: tokens.text.tertiary },
    pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    pageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      height: 34,
      paddingHorizontal: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      backgroundColor: tokens.surface.card,
    },
    pageBtnDisabled: { opacity: 0.4 },
    pageBtnText: { fontSize: 12, color: tokens.text.primary },
    pageInfo: { fontSize: 12, color: tokens.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
