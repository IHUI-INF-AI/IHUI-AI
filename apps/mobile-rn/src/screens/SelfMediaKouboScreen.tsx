// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SelfMediaKouboScreen 口播稿流水线(mobile-rn 端 wrapper)
 *
 * 承载 web /self-media/koubo。UI 全部委托共享屏 @ihui/rn-app,本 wrapper 只保留平台职责:
 * - 取数:GET /api/self-media/koubo/history(契约现读 apps/api/src/routes/self-media-routes.ts:143-147,
 *   上游 apps/ai-service/app/routers/self_media.py:715-719)
 * - 写:POST /api/self-media/koubo/generate(self-media-routes.ts:135-137;上游 self_media.py:639-672,
 *   8 篇串行 + 双门禁 5-10 分钟)→ 成功后把 outputPath 回填 filePath,再 POST /validate
 *   (self-media-routes.ts:139-141;上游 self_media.py:692-712)—— 与 web runAll 同序(page.tsx:114-164)
 * - 复制:RN Clipboard(web 为 navigator.clipboard,page.tsx:166-174)
 * - 导出全部:RN Share 分享纯文本(web 为 Blob 下载,page.tsx:176-188;RN 无 a.click)
 * - 时间格式化 / 登录门 / 错误文案:本层注入
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Clipboard from '@react-native-clipboard/clipboard'
import {
  generateKoubo,
  getKouboHistory,
  validateKoubo,
  type KouboHistoryItem,
} from '@ihui/api-client'
import {
  SelfMediaKouboScreen as SharedSelfMediaKouboScreen,
  type KouboHistoryRowView,
  type KouboResultView,
  type KouboRunningOp,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'selfMedia.kouboPage'

/** 与 web 一致:历史取最近 20 条(page.tsx:67 的 limit=20) */
const HISTORY_LIMIT = 20

export function SelfMediaKouboScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [date, setDate] = useState('')
  const [topic, setTopic] = useState('')
  const [filePath, setFilePath] = useState('')
  const [running, setRunning] = useState<KouboRunningOp>(null)
  const [result, setResult] = useState<KouboResultView | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [history, setHistory] = useState<KouboHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** 历史项日期:与 web formatDateOnly 同参(月/日,固定东八区) */
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Shanghai',
      }),
    [locale],
  )

  const fmtDate = useCallback(
    (iso?: string | null): string => {
      if (!iso) return ''
      const d = new Date(iso)
      return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d)
    },
    [dateFmt],
  )

  const loadHistory = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const res = await getKouboHistory({ limit: HISTORY_LIMIT })
      if (!res.success || !res.data) {
        setError(res.error || t('common.loadFailed'))
        return
      }
      setHistory(res.data.items ?? [])
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t, user])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const toResult = useCallback(
    (raw: {
      ok: boolean
      returncode?: number
      duration_ms?: number
      articlesCount?: number
      guide?: string
      error?: string | null
      outputPath?: string
      articles?: { index: number; content: string }[]
      displayOutput?: string
      stdout?: string
      stderr?: string
    }): KouboResultView => ({
      ok: raw.ok,
      returnCodeText: typeof raw.returncode === 'number' ? `(rc=${raw.returncode})` : '',
      durationText:
        typeof raw.duration_ms === 'number' ? `${raw.duration_ms} ${t(`${NS}.msUnit`)}` : '',
      articlesCountText:
        raw.articlesCount !== undefined ? `${raw.articlesCount} ${t(`${NS}.articleUnit`)}` : '',
      guide: raw.guide ?? '',
      error: raw.error ?? '',
      outputPath: raw.outputPath ?? '',
      articles: (raw.articles ?? []).map((a) => ({ index: a.index, content: a.content })),
      displayOutput: raw.displayOutput ?? '',
      stdout: raw.stdout ?? '',
      stderr: raw.stderr ?? '',
    }),
    [t],
  )

  const onGenerate = useCallback(async () => {
    if (!/^\d{4}$/.test(date) || running) return
    setRunning('generate')
    setResult(null)
    try {
      const res = await generateKoubo({ date, topic, dryRun: true })
      if (!res.success || !res.data) {
        setResult(
          toResult({ ok: false, error: res.error || t(`${NS}.requestFailed`) }),
        )
        return
      }
      setResult(toResult(res.data))
      if (res.data.outputPath) setFilePath(res.data.outputPath)
      void loadHistory()
    } catch (e) {
      setResult(
        toResult({
          ok: false,
          error: e instanceof Error ? e.message : t(`${NS}.networkError`),
        }),
      )
    } finally {
      setRunning(null)
    }
  }, [date, loadHistory, running, t, toResult, topic])

  const onValidate = useCallback(async () => {
    if (!filePath || running) return
    setRunning('validate')
    setResult(null)
    try {
      const res = await validateKoubo(filePath)
      if (!res.success || !res.data) {
        setResult(
          toResult({ ok: false, error: res.error || t(`${NS}.requestFailed`) }),
        )
        return
      }
      setResult(toResult(res.data))
    } catch (e) {
      setResult(
        toResult({
          ok: false,
          error: e instanceof Error ? e.message : t(`${NS}.networkError`),
        }),
      )
    } finally {
      setRunning(null)
    }
  }, [filePath, running, t, toResult])

  const onRunAll = useCallback(async () => {
    if (!/^\d{4}$/.test(date) || running) return
    setRunning('all')
    setResult(null)
    try {
      const gen = await generateKoubo({ date, topic, dryRun: true })
      if (!gen.success || !gen.data.ok) {
        setResult(
          toResult(
            gen.success ? gen.data : { ok: false, error: gen.error || t(`${NS}.requestFailed`) },
          ),
        )
        return
      }
      const finalPath = gen.data.outputPath || ''
      if (finalPath) setFilePath(finalPath)
      if (!finalPath) {
        setResult({ ...toResult(gen.data), ok: false, error: t(`${NS}.noOutputPathError`) })
        return
      }
      const check = await validateKoubo(finalPath)
      if (!check.success || !check.data) {
        setResult({
          ...toResult(gen.data),
          ok: false,
          error: `${t(`${NS}.validateFailedPrefix`)}${check.error ?? t(`${NS}.unknownError`)}`,
        })
        return
      }
      setResult({
        ...toResult(gen.data),
        ok: gen.data.ok && check.data.ok,
        stdout: check.data.stdout ?? '',
        stderr: check.data.stderr ?? '',
        returnCodeText:
          typeof check.data.returncode === 'number' ? `(rc=${check.data.returncode})` : '',
      })
      void loadHistory()
    } catch (e) {
      setResult(
        toResult({
          ok: false,
          error: e instanceof Error ? e.message : t(`${NS}.networkError`),
        }),
      )
    } finally {
      setRunning(null)
    }
  }, [date, loadHistory, running, t, toResult, topic])

  const onCopyArticle = useCallback(
    (index: number, content: string) => {
      Clipboard.setString(content)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    },
    [],
  )

  const onDownloadAll = useCallback(() => {
    if (!result || result.articles.length === 0) return
    const text = result.articles
      .map((a) => `# ${t(`${NS}.articleNumber`, { n: a.index })}\n\n${a.content}\n\n---\n`)
      .join('\n')
    void Share.share({ message: text, title: `koubo-${date}` })
  }, [date, result, t])

  const historyRows: KouboHistoryRowView[] = history.map((h) => ({
    id: h.id,
    title: h.title,
    status: h.status,
    timeText: fmtDate(h.createdAt),
  }))

  const onApplyHistory = (row: KouboHistoryRowView) => {
    const raw = history.find((h) => h.id === row.id)
    if (!raw) return
    const matched = (raw.title || '').match(/(\d{4})/)
    if (matched?.[1]) setDate(matched[1])
    setTopic(raw.payload?.topic ?? raw.topicKeyword ?? '')
    if (raw.payload?.filePath) setFilePath(raw.payload.filePath)
  }

  return (
    <SharedSelfMediaKouboScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      date={date}
      topic={topic}
      filePath={filePath}
      onDateChange={setDate}
      onTopicChange={setTopic}
      onFilePathChange={setFilePath}
      running={running}
      result={result}
      copiedIndex={copiedIndex}
      onCopyArticle={onCopyArticle}
      onDownloadAll={onDownloadAll}
      onGenerate={() => void onGenerate()}
      onValidate={() => void onValidate()}
      onRunAll={() => void onRunAll()}
      history={historyRows}
      onApplyHistory={onApplyHistory}
      onRetry={() => {
        setLoading(true)
        void loadHistory()
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
