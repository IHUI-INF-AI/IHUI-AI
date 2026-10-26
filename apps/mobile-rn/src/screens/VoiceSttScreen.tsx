// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
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
import { FileAudio, Mic, Upload, X } from 'lucide-react-native'
import { voiceSttFromReactNative } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import { runWithFreshToken } from '../lib/token'
import { WEB_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 语音转文字 —— 对齐 web `/tools/voice-stt`。
 *
 * 链路按 web 页 + apps/ai-service 现读:
 *  - `POST /api/voice/stt`(ai_service/app/routers/voice_stt.py,multipart:`file` + 可选 `language`),
 *    响应 `{ text, stub, model }`;本屏复用 `@ihui/api-client` 的
 *    `voiceSttFromReactNative`(RN FormData `{ uri, type, name }`,不新增依赖)。
 *  - 基址取 `WEB_BASE_URL`:web 端 next.config 的 `/api/voice/:path*` 同源反代到 8803,
 *    与 `/settings/usage` 复用同一条真实链路(见 UsageScreen 头注)。
 *  - `voiceSttFromReactNative` 的语言缺省是 `zh`;传空串才会真正省略 `language`(服务端自动检测),
 *    故 auto 档显式传 ''。
 *  - 该 helper 只回文本、不回 `stub`;后端 stub 文案以 `[stub]` 开头,本屏据此给出告警。
 *  - 录音能力(RN `useVoiceRecorder`)存在,但 web 该页只做"选文件转写";本屏保持同语义,
 *    不额外引入录音入口。
 */
interface PickedAudio {
  uri: string
  name: string
  size?: number
}

const LANGUAGES = [
  { value: 'auto', labelKey: 'voiceStt.langAuto' },
  { value: 'zh', labelKey: 'voiceStt.langZh' },
  { value: 'en', labelKey: 'voiceStt.langEn' },
  { value: 'ja', labelKey: 'voiceStt.langJa' },
] as const

type LanguageValue = (typeof LANGUAGES)[number]['value']

function formatFileSize(bytes?: number): string {
  if (bytes === undefined || Number.isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function VoiceSttScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [file, setFile] = useState<PickedAudio | null>(null)
  const [language, setLanguage] = useState<LanguageValue>('auto')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const pickFile = async () => {
    setError('')
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (picked.canceled || picked.assets.length === 0) return
      const asset = picked.assets[0]!
      setFile({ uri: asset.uri, name: asset.name ?? 'audio', size: asset.size })
      setResult(null)
    } catch {
      setError(t('voiceStt.pickFailed'))
    }
  }

  const clearFile = () => {
    if (busy) return
    setFile(null)
    setResult(null)
    setError('')
  }

  const transcribe = async () => {
    if (busy) return
    if (!file) {
      setError(t('voiceStt.noFile'))
      return
    }
    setBusy(true)
    setError('')
    setResult(null)
    try {
      // 2026-10-26:这一腿原先直传 `getToken()` 快照(15 分钟就过期,且不经 api-client 出口
      // ⇒ 没人替它续期)。改走 lib/token 的新鲜度兜带:上传前到点先续期,被否定则续期后
      // **只重试一次**;仍失败就落下面那条可见错误(不静默、不清凭据)。
      const text = await runWithFreshToken((token) =>
        voiceSttFromReactNative(file.uri, {
          // 空串 = 省略 language,交给服务端自动检测(helper 的缺省是 'zh')
          language: language === 'auto' ? '' : language,
          aiServiceUrl: WEB_BASE_URL,
          token: token ?? undefined,
        }),
      )
      setResult(text)
    } catch (e) {
      setError(t('voiceStt.transcribeFailed'))
      console.warn(
        `[rn-voice] VoiceSttScreen transcribe failed: ` +
          `${e instanceof Error ? e.message : 'unknown error'}`,
      )
    } finally {
      setBusy(false)
    }
  }

  const isStub = result !== null && result.startsWith('[stub]')

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('voiceStt.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>{t('voiceStt.subtitle')}</Text>

        <View style={styles.card}>
          {file ? (
            <View style={styles.fileBox}>
              <View style={styles.fileHead}>
                <FileAudio size={20} color={tokens.brandAccent.deep} />
                <View style={styles.fileMain}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
                </View>
                <TouchableOpacity
                  onPress={clearFile}
                  disabled={busy}
                  hitSlop={8}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('voiceStt.clear')}
                >
                  <X size={18} color={tokens.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadBox}
              onPress={() => void pickFile()}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Upload size={30} color={tokens.text.tertiary} />
              <Text style={styles.uploadTitle}>{t('voiceStt.selectFile')}</Text>
              <Text style={styles.uploadHint}>{t('voiceStt.supported')}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>{t('voiceStt.language')}</Text>
            <View style={styles.chipRow}>
              {LANGUAGES.map((option) => {
                const selected = language === option.value
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setLanguage(option.value)}
                    disabled={busy}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipSelectedText]}>
                      {t(option.labelKey)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (!file || busy) && styles.disabled]}
            onPress={() => void transcribe()}
            disabled={!file || busy}
            activeOpacity={0.7}
          >
            {busy ? (
              <ActivityIndicator size="small" color={tokens.brand.ctaForeground} />
            ) : (
              <Mic size={16} color={tokens.brand.ctaForeground} />
            )}
            <Text style={styles.primaryBtnText}>
              {busy ? t('voiceStt.transcribing') : t('voiceStt.transcribe')}
            </Text>
          </TouchableOpacity>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {file ? (
                <TouchableOpacity onPress={() => void transcribe()} activeOpacity={0.7} hitSlop={6}>
                  <Text style={styles.retryText}>{t('voiceStt.retry')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        {busy ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('voiceStt.transcribing')}</Text>
          </View>
        ) : result !== null ? (
          <View style={styles.card}>
            {isStub ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>{t('voiceStt.stubWarning')}</Text>
              </View>
            ) : null}
            <Text style={styles.label}>{t('voiceStt.result')}</Text>
            <View style={styles.resultBox}>
              <Text selectable style={styles.resultText}>
                {result || t('voiceStt.resultEmpty')}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: 10 },
  subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
  card: {
    gap: rnSpacing.md,
    padding: 14,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  fileBox: {
    padding: rnSpacing.md,
    borderRadius: rnRadius.md,
    borderWidth: 1,
    borderColor: tokens.brandAccent.light,
    backgroundColor: tokens.brandAccent.light,
  },
  fileHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileMain: { flex: 1, gap: 2 },
  fileName: { fontSize: rnType.body.size, fontWeight: '500', color: tokens.text.primary },
  fileSize: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
  uploadBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: rnSpacing['3xl'],
    borderRadius: rnRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.border.medium,
    backgroundColor: tokens.surface.bg,
  },
  uploadTitle: { fontSize: rnType.body.size, fontWeight: '500', color: tokens.text.primary },
  uploadHint: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
  field: { gap: 5 },
  label: { fontSize: rnType.label.size, color: tokens.text.secondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: rnSpacing.md,
    paddingVertical: 6,
    borderRadius: rnRadius.md,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.bg,
  },
  chipSelected: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
  chipText: { fontSize: rnType.label.size, color: tokens.text.secondary },
  chipSelectedText: { color: tokens.brand.ctaForeground, fontWeight: '600' },
  primaryBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  primaryBtnText: {
    fontSize: rnType.strong.size,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  },
  disabled: { opacity: 0.5 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 10,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.danger.light,
  },
  errorText: { flex: 1, fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
  retryText: { fontSize: rnType.label.size, fontWeight: '600', color: tokens.danger.DEFAULT },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: rnSpacing.sm,
    paddingVertical: rnSpacing['2xl'],
  },
  muted: { fontSize: 13, color: tokens.text.secondary },
  warningBox: {
    padding: 10,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.warning.light,
  },
  warningText: { fontSize: rnType.label.size, color: tokens.warning.amberText },
  resultBox: {
    padding: rnSpacing.md,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.bg,
  },
  resultText: { fontSize: rnType.body.size, lineHeight: 21, color: tokens.text.primary },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
