// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FileText, Plus } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * 我的试卷 —— 对齐 web /student/papers。
 * 契约实读自 apps/api/src/routes/edu-public.ts:559-585 与 db/edu-extended-queries.ts:337-353:
 *   GET /edu/my-papers?page&pageSize(分页,投影 eduUploadedPapers 全列)
 *   POST /edu/papers { paperTitle 1-200, paperUrl?≤512, courseId?(uuid) } → { paper }
 *   DELETE /edu/papers/:id(只能删自己的,否则 403)
 * 表列见 packages/database/src/schema/edu-extended.ts:88-100。
 */
interface PaperRow {
  id: string
  paperTitle: string
  paperUrl: string | null
  courseId: string | null
  status: string
  reason: string | null
  createdAt: string
}

type Nav = NativeStackNavigationProp<RootStackParamList>
const PAGE_SIZE = 20

/** 状态标签走静态映射表 —— `t(\`myPapers.status_${x}\`)` 的动态拼键会让键集对账看不见这一维 */
const STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'myPapers.status_pending',
  approved: 'myPapers.status_approved',
  rejected: 'myPapers.status_rejected',
}

export default function MyPapersScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<Nav>()

  const [rows, setRows] = useState<PaperRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (target: number, append: boolean) => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetchApi<{ list: PaperRow[]; total: number }>(
        `/api/edu/my-papers?page=${target}&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success || !res.data) {
        setFailed(true)
        return
      }
      setRows((prev) => (append ? [...prev, ...res.data.list] : res.data.list))
      setTotal(res.data.total ?? 0)
      setPage(target)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(1, false)
  }, [load])

  const fmt = (iso: string): string => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime())
      ? iso
      : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  }

  const onCreate = async () => {
    if (title.trim().length === 0) {
      appAlert(t('common.error'), t('myPapers.titleRequired'))
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { paperTitle: title.trim() }
      if (url.trim()) body.paperUrl = url.trim()
      const res = await fetchApi<{ paper: PaperRow }>('/api/edu/papers', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('myPapers.createFailed'))
        return
      }
      setTitle('')
      setUrl('')
      setCreating(false)
      void load(1, false)
    } catch {
      appAlert(t('common.error'), t('myPapers.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = (row: PaperRow) => {
    appAlert(t('myPapers.deleteTitle'), t('myPapers.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const res = await fetchApi(`/api/edu/papers/${row.id}`, { method: 'DELETE' })
            if (!res.success) appAlert(t('common.error'), res.error || t('myPapers.deleteFailed'))
            else void load(1, false)
          })()
        },
      },
    ])
  }

  const styles = makeStyles()
  const hasMore = rows.length < total

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar
          title={t('myPapers.title')}
          onBack={() => navigation.goBack()}
          rightActions={[
            { icon: Plus, label: t('myPapers.add'), onPress: () => setCreating((v) => !v) },
          ]}
        />
      </NavChrome>

      {creating ? (
        <View style={styles.form}>
          <Text style={styles.label}>{t('myPapers.fieldTitle')}</Text>
          <TextField
            colorScheme={resolvedTheme}
            value={title}
            onChangeText={setTitle}
            placeholder={t('myPapers.titlePlaceholder')}
            maxLength={200}
            style={styles.input}
            editable={!saving}
          />
          <Text style={styles.label}>{t('myPapers.fieldUrl')}</Text>
          <TextField
            colorScheme={resolvedTheme}
            value={url}
            onChangeText={setUrl}
            placeholder={t('myPapers.urlPlaceholder')}
            maxLength={512}
            autoCapitalize="none"
            style={styles.input}
            editable={!saving}
          />
          <TouchableOpacity
            style={[styles.submit, saving && styles.submitDisabled]}
            onPress={() => void onCreate()}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.submitText}>{t('myPapers.submit')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <Text style={styles.centerText}>{t('common.loading')}</Text>
      ) : failed && rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('myPapers.loadFailed')}</Text>
          <TouchableOpacity onPress={() => void load(1, false)} style={styles.retry}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <Text style={styles.centerText}>{t('myPapers.empty')}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          onEndReached={() => {
            if (hasMore && !loading) void load(page + 1, true)
          }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <FileText size={16} color={tokens.text.secondary} />
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.paperTitle}
                </Text>
                <Text
                  style={[
                    styles.badge,
                    item.status === 'approved'
                      ? styles.badgeOk
                      : item.status === 'rejected'
                        ? styles.badgeBad
                        : styles.badgePending,
                  ]}
                >
                  {t(STATUS_LABEL_KEY[item.status] ?? 'myPapers.status_pending')}
                </Text>
              </View>
              <Text style={styles.meta}>{fmt(item.createdAt)}</Text>
              {item.status === 'rejected' && item.reason ? (
                <Text style={styles.reason}>
                  {t('myPapers.reason')}: {item.reason}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => onDelete(item)}>
                  <Text style={styles.dangerText}>{t('myPapers.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListFooterComponent={
            loading && rows.length > 0 ? (
              <Text style={styles.centerText}>{t('common.loading')}</Text>
            ) : null
          }
        />
      )}
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    form: {
      margin: rnSpacing.md,
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: 6,
    },
    label: { fontSize: 13, color: tokens.text.secondary },
    input: {
      height: 44,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: rnType.strong.size,
      backgroundColor: tokens.surface.bg,
    },
    submit: {
      height: 44,
      marginTop: 10,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    listBody: { padding: rnSpacing.md, gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: 6,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    cardTitle: {
      flex: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 3,
      borderRadius: rnRadius.md,
      fontSize: rnType.caption.size,
      fontWeight: '600',
    },
    badgeOk: {
      backgroundColor: tokens.success.light ?? tokens.surface.muted,
      color: tokens.success.DEFAULT,
    },
    badgeBad: { backgroundColor: tokens.surface.muted, color: tokens.danger.DEFAULT },
    badgePending: { backgroundColor: tokens.surface.muted, color: tokens.text.secondary },
    meta: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    reason: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: rnSpacing.xs },
    dangerText: { fontSize: 13, fontWeight: '600', color: tokens.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: rnSpacing['5xl'], gap: rnSpacing.md },
    centerText: {
      textAlign: 'center',
      paddingVertical: rnSpacing['5xl'],
      fontSize: rnType.body.size,
      color: tokens.text.secondary,
    },
    errorText: { fontSize: rnType.body.size, color: tokens.danger.DEFAULT },
    retry: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
    },
    retryText: { fontSize: rnType.body.size, color: tokens.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
