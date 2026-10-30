// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  generateWechatArticle,
  getWechatHistory,
  publishWechatArticle,
  validateWechatArticle,
  type WechatHistoryItem,
  type WechatRunResult,
} from '@ihui/api-client'
import {
  SelfMediaWechatScreen as SharedSelfMediaWechatScreen,
  type WechatBusyOp,
  type WechatHistoryRowView,
  type WechatRunView,
} from '@ihui/rn-app'
import type { ApiResult } from '@ihui/types'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** web 同参数(apps/web/app/(main)/self-media/wechat/page.tsx:71 limit=20) */
const HISTORY_LIMIT = 20

function toRunView(raw: WechatRunResult): WechatRunView {
  return {
    ok: raw.ok === true,
    returncode: typeof raw.returncode === 'number' ? raw.returncode : null,
    error: raw.error ?? null,
    stdout: raw.stdout ? raw.stdout.trim() || null : null,
    stderr: raw.stderr ? raw.stderr.trim() || null : null,
  }
}

/**
 * RN 端「公众号文章流水线」薄壳 —— 承载 web /self-media/wechat。渲染委托共享屏,本文件只管:
 * 取数(POST generate/validate/publish + GET history,契约 apps/api/src/routes/self-media-routes.ts:115-131)、
 * 三步动作的入参与 dryRun 口径(web page.tsx:159-188)、历史复用回填(web applyHistory:75-81)、
 * 日期 Intl 格式化(web 侧 formatDateOnly 在 HEAD 无定义,RN 用 Intl yyyy/MM/dd 落同语义)、
 * 登录门(本页三条端点均挂 authenticate,未登录不发注定 401 的请求)。
 */
export function SelfMediaWechatScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [title, setTitle] = useState('')
  const [digest, setDigest] = useState('')
  const [mdPath, setMdPath] = useState('')
  const [mdContent, setMdContent] = useState('')
  const [cover, setCover] = useState('')
  const [busyOp, setBusyOp] = useState<WechatBusyOp | null>(null)
  const [result, setResult] = useState<WechatRunView | null>(null)
  const [history, setHistory] = useState<WechatHistoryRowView[]>([])
  const [historySource, setHistorySource] = useState<WechatHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }),
    [locale],
  )

  const fmtDate = useCallback(
    (value: string | null): string => {
      if (!value) return ''
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d)
    },
    [dateFmt],
  )

  const loadHistory = useCallback(async () => {
    if (!user) return
    setHistoryLoading(true)
    try {
      const res = await getWechatHistory(HISTORY_LIMIT)
      if (!res.success || !res.data) {
        setHistoryError(res.error ?? t('common.loadFailed'))
        return
      }
      setHistoryError(null)
      const items = res.data.items ?? []
      setHistorySource(items)
      setHistory(
        items.map((item) => ({
          id: item.id,
          title: item.payload?.title || item.title || '-',
          // web 直接渲染 h.status 原值(page.tsx:453),RN 同口径不新造状态词。
          statusText: item.status,
          statusTone:
            item.status === 'published' ? 'ok' : item.status === 'failed' ? 'failed' : 'neutral',
          timeText: fmtDate(item.createdAt),
        })),
      )
    } catch {
      setHistoryError(t('common.loadFailed'))
    } finally {
      setHistoryLoading(false)
    }
  }, [user, fmtDate, t])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const submit = useCallback(
    async (op: WechatBusyOp, call: () => Promise<ApiResult<WechatRunResult>>) => {
      setBusyOp(op)
      setResult(null)
      try {
        const res = await call()
        if (!res.success || !res.data) {
          setResult({
            ok: false,
            returncode: null,
            error: res.error ?? t('common.loadFailed'),
            stdout: null,
            stderr: null,
          })
          return
        }
        setResult(toRunView(res.data))
        if (op === 'generate' && res.data.mdPath) setMdPath(res.data.mdPath)
        if (op === 'publish' && res.data.ok) void loadHistory()
      } catch {
        setResult({
          ok: false,
          returncode: null,
          error: t('common.loadFailed'),
          stdout: null,
          stderr: null,
        })
      } finally {
        setBusyOp(null)
      }
    },
    [loadHistory, t],
  )

  const onGenerate = useCallback(() => {
    // web 同入参(page.tsx:310-317):topic 固定空串,dryRun 固定 true
    void submit('generate', () =>
      generateWechatArticle({ title, digest, topic: '', mdPath, mdContent, dryRun: true }),
    )
  }, [submit, title, digest, mdPath, mdContent])

  const onValidate = useCallback(() => {
    void submit('validate', () => validateWechatArticle(mdPath))
  }, [submit, mdPath])

  const onPublish = useCallback(() => {
    void submit('publish', () =>
      publishWechatArticle({ mdPath, title, digest, cover, dryRun: true }),
    )
  }, [submit, mdPath, title, digest, cover])

  const onApplyHistory = useCallback(
    (id: string) => {
      const row = historySource.find((item) => item.id === id)
      if (!row) return
      // web applyHistory(page.tsx:75-81):标题/摘要/mdPath/封面回填,带 topic 的清空在线正文
      setTitle(row.payload?.title || row.title || '')
      setDigest(row.payload?.digest || '')
      setMdPath(row.payload?.mdPath || '')
      setCover(row.payload?.cover || '')
      if (row.payload?.topic) setMdContent('')
    },
    [historySource],
  )

  return (
    <SharedSelfMediaWechatScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t('common.login')}
      title={title}
      digest={digest}
      mdPath={mdPath}
      mdContent={mdContent}
      cover={cover}
      onChangeTitle={setTitle}
      onChangeDigest={setDigest}
      onChangeMdPath={setMdPath}
      onChangeMdContent={setMdContent}
      onChangeCover={setCover}
      busyOp={busyOp}
      canGenerate={title.length > 0}
      canValidate={mdPath.length > 0}
      canPublish={mdPath.length > 0 && title.length > 0}
      onGenerate={onGenerate}
      onValidate={onValidate}
      onPublish={onPublish}
      result={result}
      history={history}
      historyLoading={historyLoading}
      historyError={historyError}
      onApplyHistory={onApplyHistory}
      onRefreshHistory={() => void loadHistory()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
