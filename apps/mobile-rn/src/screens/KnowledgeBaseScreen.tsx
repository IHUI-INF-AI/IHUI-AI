// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * KnowledgeBaseScreen 知识库列表(mobile-rn 端 wrapper)
 *
 * 2026-09-15 迁移:UI 与展示逻辑已下沉共享层 @ihui/rn-app KnowledgeBaseScreen,
 * 本 wrapper 仅保留平台特定职责:
 * - 数据:listKnowledgeDocs + deleteKnowledgeDoc(Alert 二次确认后删除)
 * - 导航:goBack / KnowledgeDoc 详情 / KnowledgeCreate 新建;主题与 i18n 注入
 */
import { useCallback, useEffect, useState } from 'react'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  listKnowledgeDocs,
  deleteKnowledgeDoc,
  batchDeleteKnowledgeDocs,
  type KnowledgeDocSummary,
} from '@ihui/api-client'
import { KnowledgeBaseScreen as SharedKnowledgeBaseScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function KnowledgeBaseScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<KnowledgeDocSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const list = await listKnowledgeDocs()
      setItems(list)
    } catch {
      setError(t('knowledgeBase.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onDelete = (doc: KnowledgeDocSummary) => {
    appAlert(t('knowledgeBase.deleteTitle'), t('knowledgeBase.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          try {
            await deleteKnowledgeDoc(doc.id)
            void load()
          } catch {
            appAlert(t('knowledgeBase.deleteFailed'))
          } finally {
            setDeleting(false)
          }
        },
      },
    ])
  }

  /** 批量删除:请求体严格 {docIds};部分失败按 failed[] 条数提示,成功后退出选择态并刷新。 */
  const onBatchDelete = () => {
    if (selectedIds.length === 0) return
    appAlert(
      t('knowledgeBase.batchDeleteTitle'),
      t('knowledgeBase.batchDeleteConfirm', { count: selectedIds.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            setBatchDeleting(true)
            try {
              const { success, failed } = await batchDeleteKnowledgeDocs(selectedIds)
              if (failed.length > 0) {
                appAlert(
                  t('knowledgeBase.batchDeleteTitle'),
                  t('knowledgeBase.batchDeletePartial', {
                    success: success.length,
                    failed: failed.length,
                  }),
                )
              }
              setSelectionMode(false)
              setSelectedIds([])
              void load()
            } catch {
              appAlert(t('knowledgeBase.batchDeleteFailed'))
            } finally {
              setBatchDeleting(false)
            }
          },
        },
      ],
    )
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.length === items.length ? [] : items.map((doc) => doc.id)))
  }

  return (
    <SharedKnowledgeBaseScreen
      t={t}
      docs={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      deleting={deleting}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onRetry={() => {
        setLoading(true)
        void load()
      }}
      onOpenDoc={(doc: KnowledgeDocSummary) =>
        navigation.navigate('KnowledgeDoc', { id: doc.id, title: doc.title })
      }
      onDeleteDoc={onDelete}
      onCreate={() => navigation.navigate('KnowledgeCreate')}
      onToggleSelectionMode={() => {
        setSelectionMode((prev) => !prev)
        setSelectedIds([])
      }}
      selectionMode={selectionMode}
      selectedIds={selectedIds}
      onToggleSelect={toggleSelect}
      onToggleSelectAll={toggleSelectAll}
      onBatchDelete={onBatchDelete}
      batchDeleting={batchDeleting}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
