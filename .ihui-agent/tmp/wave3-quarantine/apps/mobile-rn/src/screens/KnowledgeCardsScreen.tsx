// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  createKnowledgeCard,
  deleteKnowledgeCard,
  getKnowledgeCard,
  listKnowledgeCards,
  markCardUsed,
  searchKnowledgeCards,
  updateKnowledgeCard,
} from '@ihui/api-client'
import { KnowledgeCardsScreen as SharedKnowledgeCardsScreen } from '@ihui/rn-app'
import type {
  KnowledgeCardFormState,
  KnowledgeCardKind,
  KnowledgeCardRow,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { appAlert } from '../components/BottomPops'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const EMPTY_FORM: KnowledgeCardFormState = {
  editingId: null,
  kind: 'experience',
  title: '',
  content: '',
  tags: '',
  confidence: 100,
}

/** 逗号/中文逗号分隔标签串 → 数组(与 web parseTags 同口径,上限 20 枚)。 */
function parseTags(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
}

/**
 * RN 端「知识卡片」薄壳 —— 承载 web /knowledge-cards。
 * 渲染全部委托共享屏 `packages/app/src/features/knowledge-card/KnowledgeCardsScreen.tsx`,
 * 本文件只管平台侧:取词/主题/导航 + 六个真实端点的取数与写回
 * (契约见 packages/api-client/src/endpoints/knowledge-card.ts 头注,
 *  后端 apps/api/src/routes/knowledge-card.ts:108/148/173/209/227/270)。
 * web 端 confirmDialog 的 RN 等价 = appAlert 破坏性按钮(BottomPops 唯一出口)。
 */
export function KnowledgeCardsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [repoName, setRepoName] = useState('')
  const [cards, setCards] = useState<KnowledgeCardRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<KnowledgeCardFormState | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgeCardRow[] | null>(null)
  const [searching, setSearching] = useState(false)

  const [detail, setDetail] = useState<{ id: string; title: string; content: string } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e))
  }, [])

  const onLoad = useCallback(async () => {
    const name = repoName.trim()
    if (!name) return
    setLoading(true)
    setError(null)
    try {
      const rows = await listKnowledgeCards({ repoName: name })
      setCards(rows as KnowledgeCardRow[])
    } catch (e) {
      fail(e)
    } finally {
      setLoading(false)
    }
  }, [repoName, fail])

  const onSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    setError(null)
    try {
      const rows = await searchKnowledgeCards({ q, repoName: repoName.trim() || undefined })
      setSearchResults(rows as KnowledgeCardRow[])
    } catch (e) {
      fail(e)
    } finally {
      setSearching(false)
    }
  }, [searchQuery, repoName, fail])

  const onEdit = useCallback(
    async (card: KnowledgeCardRow) => {
      setError(null)
      try {
        const detailRes = await getKnowledgeCard(card.id)
        setForm({
          editingId: detailRes.id,
          kind: detailRes.kind as KnowledgeCardKind,
          title: detailRes.title,
          content: detailRes.content,
          tags: detailRes.tags.join(', '),
          confidence: detailRes.confidence,
        })
      } catch (e) {
        fail(e)
      }
    },
    [fail],
  )

  const onView = useCallback(
    async (card: KnowledgeCardRow) => {
      if (typeof card.content === 'string' && card.content.length > 0) {
        setDetail({ id: card.id, title: card.title, content: card.content })
        return
      }
      setDetail({ id: card.id, title: card.title, content: '' })
      setLoadingDetail(true)
      try {
        const res = await getKnowledgeCard(card.id)
        setDetail({ id: res.id, title: res.title, content: res.content })
      } catch (e) {
        fail(e)
        setDetail(null)
      } finally {
        setLoadingDetail(false)
      }
    },
    [fail],
  )

  const onSubmitForm = useCallback(async () => {
    if (!form) return
    setError(null)
    if (!repoName.trim()) {
      setError(t('knowledgeCardPage.needRepoName'))
      return
    }
    if (!form.title.trim() || !form.content.trim()) {
      setError(t('knowledgeCardPage.needTitleContent'))
      return
    }
    setSubmitting(true)
    try {
      if (form.editingId) {
        await updateKnowledgeCard(form.editingId, {
          kind: form.kind,
          title: form.title.trim(),
          content: form.content.trim(),
          tags: parseTags(form.tags),
          confidence: form.confidence,
        })
      } else {
        await createKnowledgeCard({
          repoName: repoName.trim(),
          kind: form.kind,
          title: form.title.trim(),
          content: form.content.trim(),
          tags: parseTags(form.tags),
          confidence: form.confidence,
        })
      }
      setForm(null)
      const rows = await listKnowledgeCards({ repoName: repoName.trim() })
      setCards(rows as KnowledgeCardRow[])
    } catch (e) {
      fail(e)
    } finally {
      setSubmitting(false)
    }
  }, [form, repoName, t, fail])

  const onMarkUsed = useCallback(
    async (card: KnowledgeCardRow) => {
      setBusyId(card.id)
      setError(null)
      try {
        await markCardUsed(card.id)
        setCards((prev) =>
          prev.map((c) => (c.id === card.id ? { ...c, useCount: c.useCount + 1 } : c)),
        )
      } catch (e) {
        fail(e)
      } finally {
        setBusyId(null)
      }
    },
    [fail],
  )

  const onDelete = useCallback(
    (card: KnowledgeCardRow) => {
      appAlert(t('knowledgeCardPage.delete'), t('knowledgeCardPage.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('knowledgeCardPage.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(card.id)
              setError(null)
              try {
                await deleteKnowledgeCard(card.id)
                setCards((prev) => prev.filter((c) => c.id !== card.id))
                setDetail((prev) => (prev && prev.id === card.id ? null : prev))
              } catch (e) {
                fail(e)
              } finally {
                setBusyId(null)
              }
            })()
          },
        },
      ])
    },
    [t, fail],
  )

  return (
    <SharedKnowledgeCardsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      repoName={repoName}
      onRepoNameChange={setRepoName}
      onLoad={() => void onLoad()}
      loading={loading}
      error={error}
      cards={cards}
      form={form}
      onOpenCreateForm={() => setForm({ ...EMPTY_FORM })}
      onFormChange={(patch) => setForm((prev) => (prev ? { ...prev, ...patch } : prev))}
      onSubmitForm={() => void onSubmitForm()}
      onCancelForm={() => setForm(null)}
      submitting={submitting}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      onSearch={() => void onSearch()}
      onClearSearch={() => {
        setSearchResults(null)
        setSearchQuery('')
      }}
      searching={searching}
      searchResults={searchResults}
      detail={detail}
      loadingDetail={loadingDetail}
      onCloseDetail={() => setDetail(null)}
      onView={(card) => void onView(card)}
      onEdit={(card) => void onEdit(card)}
      onMarkUsed={(card) => void onMarkUsed(card)}
      onDelete={onDelete}
      busyId={busyId}
    />
  )
}

export default KnowledgeCardsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
