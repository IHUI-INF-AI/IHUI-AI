import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuthStore } from '../stores/auth-store'
import {
  deleteKnowledgeDoc,
  getKnowledgeDoc,
  getKnowledgeDocChunks,
  listKnowledgeDocs,
  searchKnowledge,
  type KnowledgeChunkPreview,
  type KnowledgeDocDetail,
  type KnowledgeDocSummary,
  type KnowledgeSearchHit,
} from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RAG 知识库(Web /knowledge-rag 的移动端原生增强屏)
 * 平台特有:依赖 react-native(TextInput/FlatList/RefreshControl),仅移动端可复用。
 * 功能:文档列表/删除 + 语义搜索 + 文档详情与切片展开。
 * 数据源:@ihui/api-client 的 listKnowledgeDocs / searchKnowledge /
 *        getKnowledgeDoc / getKnowledgeDocChunks / deleteKnowledgeDoc。
 */

/** 当前视图:docs 文档列表 | search 搜索结果 | detail 文档详情 */
type ViewMode = 'docs' | 'search' | 'detail'

/** 语义检索命中量上限(与 web 端默认一致) */
const SEARCH_TOP_K = 10
/** 详情页切片拉取上限 */
const CHUNK_LIMIT = 50
/** 切片收起时预览行数 */
const CHUNK_PREVIEW_LINES = 3

export function KnowledgeRagScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const user = useAuthStore((s) => s.user)
  // ownerUuid 缺省兜底 'default'(与后端默认知识库对齐)
  const ownerUuid = user?.id ?? 'default'

  // 文档列表状态
  const [items, setItems] = useState<KnowledgeDocSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [listError, setListError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // 搜索状态
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<KnowledgeSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // 视图 + 详情状态
  const [view, setView] = useState<ViewMode>('docs')
  const [detailBack, setDetailBack] = useState<ViewMode>('docs')
  const [detailDocId, setDetailDocId] = useState<number | null>(null)
  const [doc, setDoc] = useState<KnowledgeDocDetail | null>(null)
  const [chunks, setChunks] = useState<KnowledgeChunkPreview[]>([])
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState('')
  // 展开的切片 id 集合(不可变更新以触发渲染)
  const [expandedChunkIds, setExpandedChunkIds] = useState<ReadonlySet<number>>(new Set())

  const loadDocs = useCallback(async () => {
    setListError('')
    try {
      const list = await listKnowledgeDocs(ownerUuid)
      setItems(list)
    } catch {
      setListError(t('knowledgeBase.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [ownerUuid, t])

  useEffect(() => {
    void loadDocs()
  }, [loadDocs])

  const onDelete = (docItem: KnowledgeDocSummary) => {
    Alert.alert(t('knowledgeBase.deleteTitle'), t('knowledgeBase.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          try {
            await deleteKnowledgeDoc(docItem.id, ownerUuid)
            void loadDocs()
          } catch {
            Alert.alert(t('knowledgeBase.deleteFailed'))
          } finally {
            setDeleting(false)
          }
        },
      },
    ])
  }

  const onSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) {
      // 空查询回到文档列表
      setView('docs')
      setSearchError('')
      return
    }
    setView('search')
    setSearching(true)
    setSearchError('')
    try {
      const result = await searchKnowledge({ query: q, ownerUuid, topK: SEARCH_TOP_K })
      setHits(result)
    } catch {
      setHits([])
      setSearchError('检索失败，请重试' /* i18n key: knowledgeRag.searchFailed 待补 */)
    } finally {
      setSearching(false)
    }
  }, [query, ownerUuid])

  const openDetail = useCallback(
    async (docId: number, back: ViewMode) => {
      setDetailDocId(docId)
      setDetailBack(back)
      setView('detail')
      setDocLoading(true)
      setDocError('')
      setExpandedChunkIds(new Set())
      try {
        const detail = await getKnowledgeDoc(docId, ownerUuid)
        setDoc(detail)
        try {
          setChunks(await getKnowledgeDocChunks(docId, ownerUuid, CHUNK_LIMIT))
        } catch {
          setChunks([])
        }
      } catch {
        setDoc(null)
        setDocError(t('knowledgeDoc.loadFailed'))
      } finally {
        setDocLoading(false)
      }
    },
    [ownerUuid, t],
  )

  const toggleChunk = (chunkId: number) => {
    setExpandedChunkIds((prev) => {
      const next = new Set(prev)
      if (next.has(chunkId)) {
        next.delete(chunkId)
      } else {
        next.add(chunkId)
      }
      return next
    })
  }

  const dark = resolvedTheme === 'dark'
  const cardCls = dark ? 'border-neutral-700 bg-neutral-800' : 'border-gray-200 bg-white'
  const titleCls = dark ? 'text-gray-100' : 'text-gray-900'
  const metaCls = dark ? 'text-gray-500' : 'text-gray-400'
  const bodyCls = dark ? 'text-gray-200' : 'text-gray-700'

  const renderHeader = (title: string, onBack: () => void) => (
    <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text className="text-sm text-gray-500">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="max-w-[60%] truncate text-base font-medium">{title}</Text>
      <View className="w-10" />
    </View>
  )

  const renderSearchBar = () => (
    <View className="flex-row items-center px-4 pb-3">
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('common.searchPlaceholder')}
        placeholderTextColor={dark ? '#666' : '#aaa'}
        returnKeyType="search"
        onSubmitEditing={() => {
          void onSearch()
        }}
        className={`flex-1 rounded-md border px-3 py-2 text-sm ${dark ? 'border-neutral-700 bg-neutral-800 text-white' : 'border-gray-300 bg-white text-black'}`}
      />
      <TouchableOpacity
        onPress={() => {
          void onSearch()
        }}
        disabled={searching}
        className="ml-2 rounded-md bg-blue-600 px-4 py-2"
      >
        <Text className="text-sm text-white">{t('common.search')}</Text>
      </TouchableOpacity>
    </View>
  )

  const renderError = (msg: string, onRetry: () => void) => (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="mb-3 text-center text-sm text-gray-500">{msg}</Text>
      <TouchableOpacity onPress={onRetry} className="rounded-md bg-gray-200 px-4 py-2">
        <Text className="text-sm">{t('knowledgeBase.retry')}</Text>
      </TouchableOpacity>
    </View>
  )

  // ---- 文档详情视图(详情 + 切片,切片可展开/收起) ----
  if (view === 'detail') {
    return (
      <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
        {renderHeader(doc?.title ?? t('knowledgeDoc.title'), () => setView(detailBack))}
        {docLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500">{t('common.loading')}</Text>
          </View>
        ) : docError ? (
          renderError(docError, () => {
            if (detailDocId !== null) void openDetail(detailDocId, detailBack)
          })
        ) : doc ? (
          <FlatList
            data={chunks}
            keyExtractor={(c) => String(c.id)}
            ListHeaderComponent={
              <View className="mb-3">
                <Text className={`text-xs ${metaCls}`}>
                  {doc.chunkCount} {t('knowledgeDoc.chunksTotal')}
                  {doc.createdAt ? ` · ${String(doc.createdAt).slice(0, 10)}` : ''}
                </Text>
                <Text className={`mt-1 text-xs ${metaCls}`}>
                  {t('knowledgeDoc.source')}: {doc.sourceType}
                </Text>
                <Text
                  className={`mb-2 mt-5 text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {t('knowledgeDoc.preview')}
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center py-10">
                <Text className="text-sm text-gray-500">{t('knowledgeDoc.noChunks')}</Text>
              </View>
            }
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => {
              const expanded = expandedChunkIds.has(item.id)
              return (
                <TouchableOpacity
                  onPress={() => toggleChunk(item.id)}
                  className={`mb-3 rounded-lg border p-3 ${cardCls}`}
                >
                  <Text className={`text-xs ${metaCls}`}>#{item.chunkIndex + 1}</Text>
                  <Text
                    className={`mt-1 text-sm leading-6 ${bodyCls}`}
                    numberOfLines={expanded ? undefined : CHUNK_PREVIEW_LINES}
                  >
                    {item.content}
                  </Text>
                  <Text className={`mt-1 text-xs ${metaCls}`}>
                    {expanded ? '收起' : '展开'}
                    {/* i18n key: knowledgeRag.expand / knowledgeRag.collapse 待补 */}
                  </Text>
                </TouchableOpacity>
              )
            }}
          />
        ) : null}
      </View>
    )
  }

  // ---- 文档列表 / 搜索结果视图 ----
  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      {renderHeader('RAG 知识库' /* i18n key: knowledgeRag.title 待补 */, () =>
        navigation.goBack(),
      )}
      {renderSearchBar()}

      {view === 'docs' ? (
        loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500">{t('common.loading')}</Text>
          </View>
        ) : listError ? (
          renderError(listError, () => {
            setLoading(true)
            void loadDocs()
          })
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true)
                  void loadDocs()
                }}
              />
            }
            ListEmptyComponent={
              <View className="items-center py-16">
                <Text className="text-sm text-gray-500">{t('knowledgeBase.empty')}</Text>
                <Text className="mt-1 text-xs text-gray-400">{t('knowledgeBase.emptyHint')}</Text>
              </View>
            }
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View className={`mb-3 rounded-lg border p-4 ${cardCls}`}>
                <TouchableOpacity onPress={() => void openDetail(item.id, 'docs')}>
                  <Text className={`text-base font-medium ${titleCls}`} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className={`mt-1 text-xs ${metaCls}`}>
                    {item.chunkCount} {t('knowledgeBase.chunks')}
                    {item.createdAt ? ` · ${String(item.createdAt).slice(0, 10)}` : ''}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onDelete(item)}
                  disabled={deleting}
                  className="mt-2 self-start rounded-md border border-red-200 px-2 py-1"
                >
                  <Text className="text-xs text-red-500">{t('knowledgeBase.delete')}</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )
      ) : searching ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">{t('common.loading')}</Text>
        </View>
      ) : searchError ? (
        renderError(searchError, () => void onSearch())
      ) : (
        <FlatList
          data={hits}
          keyExtractor={(hit) => String(hit.id)}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-sm text-gray-500">
                未找到相关结果{/* i18n key: knowledgeRag.searchEmpty 待补 */}
              </Text>
            </View>
          }
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => void openDetail(item.docId, 'search')}
              className={`mb-3 rounded-lg border p-4 ${cardCls}`}
            >
              <Text className={`text-sm leading-6 ${bodyCls}`} numberOfLines={3}>
                {item.content}
              </Text>
              <Text className={`mt-2 text-xs ${metaCls}`}>
                #{item.chunkIndex + 1} · 相关度 {item.score.toFixed(2)}
                {/* i18n key: knowledgeRag.score 待补 */}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}
