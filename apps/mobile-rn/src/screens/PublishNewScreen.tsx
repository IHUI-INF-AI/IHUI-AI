// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 新建发布任务 —— 对齐 web `/publish/new` 的主链路。
 *
 * 端点按 apps/api/src/routes/publish-routes.ts → ai-service publish.py 现读:
 *  - GET  /api/publish/accounts/me   ⇒ { items }(只取 status=active 的账号做目标)
 *  - GET  /api/publish/platforms     ⇒ { items: [{ platformId, platformName }] }
 *  - POST /api/publish/upload        ⇒ multipart 字段名 `file`,返回 { file_path, filename, format }
 *  - POST /api/publish/tasks         ⇒ body { title, format, text?, file_path?, images,
 *                                           targets: [{ platform, account_id, config }], scheduled_at? }
 *
 * 任务入参以 ai-service `TaskCreate` 为准:不接受 tags/summary(web 传了也会被 Pydantic 忽略),
 * 本屏不制造"填了会生效"的假字段。formats: md/html 走正文,docx/pdf/image/video 走上传文件。
 */
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
import * as DocumentPicker from 'expo-document-picker'
import { Check, Paperclip, Send, Upload } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type Format = 'md' | 'html' | 'docx' | 'pdf' | 'image' | 'video'

interface Account {
  id: number
  platform: string
  displayName: string
  status: string
}

interface UploadResult {
  file_path: string
  filename: string
  format: string
  size: number
}

const TEXT_FORMATS = new Set<Format>(['md', 'html'])
const FORMATS: Format[] = ['md', 'html', 'docx', 'pdf', 'image', 'video']
const FORMAT_KEY: Record<Format, string> = {
  md: 'publishNew.formatMd',
  html: 'publishNew.formatHtml',
  docx: 'publishNew.formatDocx',
  pdf: 'publishNew.formatPdf',
  image: 'publishNew.formatImage',
  video: 'publishNew.formatVideo',
}

function fmtDateTime(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default function PublishNewScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [platformNames, setPlatformNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [title, setTitle] = useState('')
  const [format, setFormat] = useState<Format>('md')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<UploadResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetchApi<{ items?: Account[] }>('/api/publish/accounts/me')
      if (!res.success) throw new Error(res.error)
      setAccounts((res.data?.items ?? []).filter((a) => a.status === 'active'))
    } catch {
      setAccounts([])
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    void (async () => {
      try {
        const res = await fetchApi<{ items?: Array<{ platformId: string; platformName: string }> }>(
          '/api/publish/platforms',
        )
        if (!res.success) return
        const map: Record<string, string> = {}
        for (const item of res.data?.items ?? []) map[item.platformId] = item.platformName
        setPlatformNames(map)
      } catch {
        // 平台名取不到时回落平台 id
      }
    })()
  }, [load])

  const toggleAccount = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pickFile = async () => {
    if (uploading) return
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/*',
        'video/*',
      ],
      multiple: false,
      copyToCacheDirectory: true,
    })
    if (picked.canceled) return
    const asset = picked.assets?.[0]
    if (!asset?.uri) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', {
        uri: asset.uri,
        name: asset.name || `upload-${Date.now()}`,
        type: asset.mimeType || 'application/octet-stream',
      } as never)
      const res = await fetchApi<UploadResult>('/api/publish/upload', {
        method: 'POST',
        body: formData,
        timeoutMs: 300_000,
      })
      if (!res.success || !res.data?.file_path) {
        throw new Error(res.success ? t('publishNew.uploadFailed') : res.error)
      }
      setFile(res.data)
      const detected = res.data.format as Format
      if (FORMATS.includes(detected) && !TEXT_FORMATS.has(detected)) setFormat(detected)
    } catch (e) {
      appAlert(t('publishNew.uploadFailed'), e instanceof Error ? e.message : undefined)
    } finally {
      setUploading(false)
    }
  }

  const quickSchedule = (hours: number) => {
    const d = new Date(Date.now() + hours * 3600 * 1000)
    d.setSeconds(0, 0)
    setScheduleAt(d)
  }

  const onSubmit = async () => {
    if (!title.trim()) {
      appAlert(t('publishNew.titleRequired'))
      return
    }
    if (selected.size === 0) {
      appAlert(t('publishNew.accountsRequired'))
      return
    }
    const isText = TEXT_FORMATS.has(format)
    if (isText && !body.trim()) {
      appAlert(t('publishNew.bodyRequired'))
      return
    }
    if (!isText && !file) {
      appAlert(t('publishNew.fileRequired'))
      return
    }
    const targets = accounts
      .filter((a) => selected.has(a.id))
      .map((a) => ({ platform: a.platform, account_id: a.id, config: {} }))
    const payload: Record<string, unknown> = {
      title: title.trim(),
      format,
      images: [],
      targets,
      ...(isText ? { text: body } : { file_path: file?.file_path }),
      ...(scheduleAt ? { scheduled_at: scheduleAt.toISOString() } : {}),
    }
    setSubmitting(true)
    try {
      const res = await fetchApi<{ task_id?: string; status?: string }>('/api/publish/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.success) throw new Error(res.error)
      const taskId = res.data?.task_id
      appAlert(
        t('publishNew.submitSuccess'),
        taskId ? t('publishNew.taskCreated', { taskId }) : undefined,
      )
      setTitle('')
      setBody('')
      setFile(null)
      setSelected(new Set())
      setScheduleAt(null)
    } catch (e) {
      appAlert(t('publishNew.submitFailed'), e instanceof Error ? e.message : undefined)
    } finally {
      setSubmitting(false)
    }
  }

  const styles = makeStyles()
  const isText = TEXT_FORMATS.has(format)

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('publishNew.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('publishNew.subtitle')}</Text>

        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('publishNew.accountLoadFailed')}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {accounts.length === 0 ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{t('publishNew.noAccounts')}</Text>
                <Text style={styles.hint}>{t('publishNew.noAccountsHint')}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('publishNew.contentTitle')}</Text>
              <TextField
                colorScheme={resolvedTheme}
                value={title}
                onChangeText={setTitle}
                placeholder={t('publishNew.titlePlaceholder')}
                style={styles.input}
              />
              <View style={styles.chipRow}>
                {FORMATS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.chip, format === f && styles.chipOn]}
                    onPress={() => setFormat(f)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, format === f && styles.chipOnText]}>
                      {t(FORMAT_KEY[f])}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isText ? (
                <TextField
                  colorScheme={resolvedTheme}
                  value={body}
                  onChangeText={setBody}
                  placeholder={t('publishNew.bodyPlaceholder')}
                  multiline
                  style={styles.textArea}
                />
              ) : (
                <View style={styles.fileBox}>
                  <TouchableOpacity
                    style={[styles.outlineBtn, uploading && styles.disabled]}
                    onPress={() => void pickFile()}
                    disabled={uploading}
                    activeOpacity={0.7}
                  >
                    <Upload size={14} color={tokens.text.primary} />
                    <Text style={styles.outlineBtnText}>
                      {uploading ? t('publishNew.uploading') : t('publishNew.pickFile')}
                    </Text>
                  </TouchableOpacity>
                  {file ? (
                    <View style={styles.fileRow}>
                      <Paperclip size={12} color={tokens.text.secondary} />
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.filename}
                      </Text>
                      <TouchableOpacity onPress={() => setFile(null)} activeOpacity={0.7}>
                        <Text style={styles.removeFile}>{t('publishNew.removeFile')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.hint}>{t('publishNew.uploadHint')}</Text>
                  )}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('publishNew.accountsLabel')}</Text>
              <Text style={styles.hint}>
                {t('publishNew.selectedCount', { count: selected.size })}
              </Text>
              {accounts.map((a) => {
                const on = selected.has(a.id)
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.accountRow, on && styles.accountRowOn]}
                    onPress={() => toggleAccount(a.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on ? <Check size={12} color={styles.checkOn.color} /> : null}
                    </View>
                    <View style={styles.accountMain}>
                      <Text style={styles.accountName} numberOfLines={1}>
                        {a.displayName || a.platform}
                      </Text>
                      <Text style={styles.meta}>{platformNames[a.platform] ?? a.platform}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('publishNew.scheduleLabel')}</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, scheduleAt === null && styles.chipOn]}
                  onPress={() => setScheduleAt(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, scheduleAt === null && styles.chipOnText]}>
                    {t('publishNew.scheduleNow')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, scheduleAt !== null && styles.chipOn]}
                  onPress={() => quickSchedule(1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, scheduleAt !== null && styles.chipOnText]}>
                    {t('publishNew.scheduleLater')}
                  </Text>
                </TouchableOpacity>
              </View>
              {scheduleAt ? (
                <View style={styles.quickRow}>
                  <Text style={styles.scheduleValue}>{fmtDateTime(scheduleAt, locale)}</Text>
                  <TouchableOpacity onPress={() => quickSchedule(24)} activeOpacity={0.7}>
                    <Text style={styles.quickText}>{t('publishNew.quickTomorrow')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => quickSchedule(168)} activeOpacity={0.7}>
                    <Text style={styles.quickText}>{t('publishNew.quickNextWeek')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (submitting || accounts.length === 0) && styles.disabled]}
              onPress={() => void onSubmit()}
              disabled={submitting || accounts.length === 0}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={tokens.brand.ctaForeground} />
              ) : (
                <Send size={16} color={tokens.brand.ctaForeground} />
              )}
              <Text style={styles.primaryBtnText}>
                {submitting ? t('publishNew.submitting') : t('publishNew.submit')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: 10, paddingBottom: rnSpacing['3xl'] },
    subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['5xl'],
    },
    hint: { fontSize: rnType.caption.size, color: tokens.text.tertiary, lineHeight: 16 },
    errorText: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    notice: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.warning.orangeLight,
      gap: rnSpacing.xs,
    },
    noticeText: { fontSize: rnType.label.size, fontWeight: '600', color: tokens.warning.amberText },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
    input: {
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: rnType.body.size,
      backgroundColor: tokens.surface.bg,
    },
    textArea: {
      minHeight: 140,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: rnType.body.size,
      textAlignVertical: 'top',
      backgroundColor: tokens.surface.bg,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 10,
      height: 28,
      justifyContent: 'center',
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tokens.border.light,
    },
    chipOn: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
    chipText: { fontSize: rnType.caption.size, color: tokens.text.secondary },
    chipOnText: { color: tokens.brand.ctaForeground, fontWeight: '600' },
    fileBox: { gap: rnSpacing.sm },
    outlineBtn: {
      height: 40,
      paddingHorizontal: 14,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    outlineBtnText: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    fileName: { flex: 1, fontSize: rnType.label.size, color: tokens.text.secondary },
    removeFile: { fontSize: rnType.caption.size, color: tokens.danger.DEFAULT },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: rnSpacing.sm,
      paddingHorizontal: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.light,
    },
    accountRowOn: { borderColor: tokens.brandAccent.deep },
    check: {
      width: 18,
      height: 18,
      borderRadius: rnRadius.xs,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: {
      backgroundColor: tokens.brand.cta,
      borderColor: tokens.brand.cta,
      color: tokens.brand.ctaForeground,
    },
    accountMain: { flex: 1, gap: 2 },
    accountName: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    meta: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
    quickRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.md, flexWrap: 'wrap' },
    scheduleValue: { fontSize: rnType.label.size, color: tokens.text.secondary },
    quickText: { fontSize: rnType.caption.size, fontWeight: '600', color: tokens.text.primary },
    primaryBtn: {
      height: 46,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
    },
    primaryBtnText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    disabled: { opacity: 0.5 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
