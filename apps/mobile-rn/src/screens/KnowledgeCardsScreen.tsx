// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Alert } from 'react-native'
import {
  createKnowledgeCard,
  deleteKnowledgeCard,
  getKnowledgeCard,
  listKnowledgeCards,
  markCardUsed,
  searchKnowledgeCards,
  updateKnowledgeCard,
  type KnowledgeCardKind,
  type KnowledgeCardSummary,
} from '@ihui/api-client'
import {
  KnowledgeCardsScreen as SharedKnowledgeCardsScreen,
  type KnowledgeCardFormMode,
  type KnowledgeCardFormView,
  type KnowledgeCardKindView,
  type KnowledgeCardRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'knowledgeCardsPage'

/** 与 web 页面同口径:逗号/中文逗号分隔的标签串 → 数组(上限 20) */
function parseTags(value: string): string[] {
  return value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
}

/** 与 web 页面同口径:置信度钳制到 0–100,NaN 回落 100 */
function clampConfidence(value: string): number {
  const n = Number(value)
  if (Number.isNaN(n)) return 100
  return Math.min(100, Math.max(0, Math.round(n)))
}

const EMPTY_FORM: KnowledgeCardFormView = {
  kind: 'experience',
  title: '',
  content: '',
  tags: '',
  confidence: '100',
}

/**
 * RN 端「知识卡片」薄壳 —— 承载 web /knowledge-cards。
 *
 * 端点证据(现读 apps/api,经 routes/index.ts:1427 以 prefix /api/knowledge-cards 注册,
 * 插件 apps/api/src/routes/knowledge-card.ts 全族 requireLoginHook):
 *  - GET    /api/knowledge-cards?repoName=&kind=&tag=&limit=   → success(裸数组)  knowledge-card.ts:108-142
 *  - POST   /api/knowledge-cards                              → 201 success(单对象) knowledge-card.ts:148-170
 *  - GET    /api/knowledge-cards/search?q=&repoName=&limit=    → success(裸数组)  knowledge-card.ts:173-206
 *  - GET    /api/knowledge-cards/:id                          → success(单对象)  knowledge-card.ts:209-224
 *  - PATCH  /api/knowledge-cards/:id({markUsed:true})         → success(单对象)  knowledge-card.ts:227-251(打点)
 *  - PATCH  /api/knowledge-cards/:id(字段编辑)                → success(单对象)  knowledge-card.ts:253-267
 *  - DELETE /api/knowledge-cards/:id                          → success({deleted}) knowledge-card.ts:270-289
 * 端点封装复用既有的 packages/api-client/src/endpoints/knowledge-card.ts(全 7 个方法齐备,
 * 且已在 packages/api-client/src/index.ts:430 导出),故本席不新建端点件。
 *
 * 本文件职责:取数、草稿态(仓库名/表单/检索词)、Intl 时间格式化、五语文案注入、登录门、
 * 删除二次确认(Alert)。渲染全部委托共享屏。
 */
export function KnowledgeCardsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [repoName, setRepoName] = useState('')
  const [rows, setRows] = useState<KnowledgeCardRowView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchQ, setSearchQ] = useState('')
  const [searchRows, setSearchRows] = useState<KnowledgeCardRowView[] | null>(null)
  const [searching, setSearching] = useState(false)

  const [formMode, setFormMode] = useState<KnowledgeCardFormMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<KnowledgeCardFormView>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailTitle, setDetailTitle] = useState<string | null>(null)
  const [detailContent, setDetailContent] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [busyId, setBusyId] = useState<string | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const kindText = useCallback(
    (kind: KnowledgeCardKindView): string => {
      switch (kind) {
        case 'experience':
          return t(`${NS}.kindExperience`)
        case 'fact':
          return t(`${NS}.kindFact`)
        case 'practices':
          return t(`${NS}.kindPractices`)
        default:
          return t(`${NS}.kindPitfall`)
      }
    },
    [t],
  )

  /** 端点是裸数组 + 可选 content(仅 /search 返回),统一映射成视图行 */
  const toRow = useCallback(
    (card: KnowledgeCardSummary & { content?: string }): KnowledgeCardRowView => {
      let createdAtText = ''
      if (card.createdAt) {
        const d = new Date(card.createdAt)
        createdAtText = Number.isNaN(d.getTime()) ? card.createdAt : dateFmt.format(d)
      }
      return {
        id: card.id,
        title: card.title,
        kindText: kindText(card.kind),
        sourceText: card.source === 'agent' ? t(`${NS}.sourceAgent`) : '',
        useCountText: `${t(`${NS}.useCount`)} ${card.useCount}`,
        tagsText: (card.tags ?? []).map((tag) => `#${tag}`).join(' '),
        createdAtText,
        contentPreview: card.content ?? '',
      }
    },
    [dateFmt, kindText, t],
  )

  const loadList = useCallback(async () => {
    const name = repoName.trim()
    if (!name || !user) return
    setLoading(true)
    setError(null)
    try {
      const list = await listKnowledgeCards({ repoName: name })
      setRows(list.map(toRow))
    } catch {
      setRows([])
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [repoName, toRow, t, user])

  const runSearch = useCallback(async () => {
    const q = searchQ.trim()
    if (!q) {
      setSearchRows(null)
      return
    }
    setSearching(true)
    setError(null)
    try {
      const list = await searchKnowledgeCards({
        q,
        repoName: repoName.trim() || undefined,
      })
      setSearchRows(list.map(toRow))
    } catch {
      setSearchRows([])
      setError(t('common.loadFailed'))
    } finally {
      setSearching(false)
    }
  }, [repoName, searchQ, toRow, t])

  const openDetail = useCallback(
    async (id: string) => {
      const cached = searchRows?.find((row) => row.id === id)
      setDetailId(id)
      setDetailTitle(rows.find((row) => row.id === id)?.title ?? cached?.title ?? '')
      if (cached && cached.contentPreview) {
        setDetailContent(cached.contentPreview)
        return
      }
      setDetailContent(null)
      setLoadingDetail(true)
      try {
        const detail = await getKnowledgeCard(id)
        setDetailTitle(detail.title)
        setDetailContent(detail.content)
      } catch {
        setDetailId(null)
        setDetailTitle(null)
        setDetailContent(null)
        setError(t('common.loadFailed'))
      } finally {
        setLoadingDetail(false)
      }
    },
    [rows, searchRows, t],
  )

  const openEdit = useCallback(
    async (id: string) => {
      setError(null)
      try {
        const detail = await getKnowledgeCard(id)
        setEditingId(detail.id)
        setForm({
          kind: detail.kind,
          title: detail.title,
          content: detail.content,
          tags: detail.tags.join(', '),
          confidence: String(detail.confidence),
        })
        setFormMode('edit')
      } catch {
        setError(t('common.loadFailed'))
      }
    },
    [t],
  )

  const submitForm = useCallback(async () => {
    const name = repoName.trim()
    if (!name) {
      setError(t(`${NS}.needRepoName`))
      return
    }
    if (!form.title.trim() || !form.content.trim()) {
      setError(t(`${NS}.needTitleContent`))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        kind: form.kind as KnowledgeCardKind,
        title: form.title.trim(),
        content: form.content.trim(),
        tags: parseTags(form.tags),
        confidence: clampConfidence(form.confidence),
      }
      if (editingId) {
        await updateKnowledgeCard(editingId, payload)
      } else {
        await createKnowledgeCard({ repoName: name, ...payload })
      }
      setFormMode(null)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await loadList()
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [editingId, form, loadList, repoName, t])

  const markUsed = useCallback(
    async (id: string) => {
      setBusyId(id)
      setError(null)
      try {
        const detail = await markCardUsed(id)
        const bump = (row: KnowledgeCardRowView): KnowledgeCardRowView =>
          row.id === id
            ? { ...row, useCountText: `${t(`${NS}.useCount`)} ${detail.useCount}` }
            : row
        setRows((prev) => prev.map(bump))
        setSearchRows((prev) => (prev ? prev.map(bump) : prev))
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        setBusyId(null)
      }
    },
    [t],
  )

  const removeCard = useCallback(
    (id: string) => {
      Alert.alert(t(`${NS}.deleteConfirm`), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setBusyId(id)
            setError(null)
            void (async () => {
              try {
                await deleteKnowledgeCard(id)
                setRows((prev) => prev.filter((row) => row.id !== id))
                setSearchRows((prev) => (prev ? prev.filter((row) => row.id !== id) : prev))
                if (detailId === id) {
                  setDetailId(null)
                  setDetailTitle(null)
                  setDetailContent(null)
                }
              } catch {
                setError(t('common.loadFailed'))
              } finally {
                setBusyId(null)
              }
            })()
          },
        },
      ])
    },
    [detailId, t],
  )

  const patchForm = useCallback((patch: Partial<KnowledgeCardFormView>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  return (
    <SharedKnowledgeCardsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      repoName={repoName}
      onRepoNameChange={setRepoName}
      onLoad={() => void loadList()}
      loading={loading}
      error={error}
      rows={rows}
      searchQ={searchQ}
      onSearchQChange={setSearchQ}
      onSearch={() => void runSearch()}
      onClearSearch={() => {
        setSearchRows(null)
        setSearchQ('')
      }}
      searching={searching}
      searchRows={searchRows}
      onOpenCreate={() => {
        setEditingId(null)
        setForm(EMPTY_FORM)
        setFormMode('create')
      }}
      formMode={formMode}
      form={form}
      onFormChange={patchForm}
      submitting={submitting}
      onSubmit={() => void submitForm()}
      onCloseForm={() => {
        setFormMode(null)
        setEditingId(null)
      }}
      detailTitle={detailTitle}
      detailContent={detailContent}
      loadingDetail={loadingDetail}
      onCloseDetail={() => {
        setDetailId(null)
        setDetailTitle(null)
        setDetailContent(null)
      }}
      busyId={busyId}
      onView={(id) => void openDetail(id)}
      onEdit={(id) => void openEdit(id)}
      onMarkUsed={(id) => void markUsed(id)}
      onDelete={removeCard}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
