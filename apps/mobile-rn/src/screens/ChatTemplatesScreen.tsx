// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对话模板 —— 对齐 web `/chat/templates`。
 *
 * 契约(按 apps/api/src/routes/chat-templates.ts 实读):
 *  - `GET /api/chat/templates` 返回 `{ list, total, page, pageSize, categories }`;
 *  - 对外投影只有 id/title/description/content/categoryId/createdAt 六键,
 *    web 页曾假设的"使用次数"在该端点并不存在,故本屏不渲染这个假字段;
 *  - 鉴权由服务端 `authenticate` 承担,fetchApi 自动携带凭据。
 *
 * 使用动线:RN 的 `Chat` 路由只声明了 conversationId/title/modelName/modelId/remark/
 * autoSendPrompt(没有 web 的 sessionStorage draft 通道),而 `autoSendPrompt` 会把
 * 带 `{主题}` 占位的模板原样发给模型 —— 那不是 web 的"放入草稿"语义。故这里改为
 * 「预览 + 复制 + 去对话」:复制到剪贴板,由用户在输入框粘贴并补全占位符。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LayoutTemplate, Sparkles, X } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useClipboard } from '../hooks/use-clipboard'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 服务端 pageSize 上限 50(chat-templates.ts 的 query schema) */
const PAGE_SIZE = 50

interface ChatTemplate {
  id: string
  title: string
  description: string | null
  content: string
  categoryId: string | null
  createdAt: string
}

interface ChatTemplateCategory {
  id: string
  name: string
}

interface ChatTemplatesData {
  list: ChatTemplate[]
  total: number
  page: number
  pageSize: number
  categories: ChatTemplateCategory[]
}

export default function ChatTemplatesScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { copy } = useClipboard()

  const [templates, setTemplates] = useState<ChatTemplate[]>([])
  const [categories, setCategories] = useState<ChatTemplateCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState('all')
  const [preview, setPreview] = useState<ChatTemplate | null>(null)
  const [notice, setNotice] = useState('')

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [locale],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<ChatTemplatesData>('/api/chat/templates', {
        params: { page: 1, pageSize: PAGE_SIZE },
      })
      if (!res.success) {
        setError(t('chatTemplates.loadFailed'))
        return
      }
      setTemplates(res.data.list)
      setCategories(res.data.categories)
    } catch {
      setError(t('chatTemplates.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const catName = useCallback(
    (id: string | null): string => {
      if (!id) return ''
      return categories.find((c) => c.id === id)?.name ?? ''
    },
    [categories],
  )

  /** 搜索与分类都在已取回的一页数据上过滤(接口虽支持 category,重复请求只会多打一次后端) */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return templates.filter((tpl) => {
      if (activeCat !== 'all' && tpl.categoryId !== activeCat) return false
      if (!q) return true
      return (
        tpl.title.toLowerCase().includes(q) ||
        (tpl.description ?? '').toLowerCase().includes(q) ||
        tpl.content.toLowerCase().includes(q)
      )
    })
  }, [templates, query, activeCat])

  const onCopy = async (text: string): Promise<boolean> => {
    const ok = await copy(text)
    setNotice(ok ? t('chatTemplates.copied') : t('chatTemplates.copyFailed'))
    return ok
  }

  const openPreview = (tpl: ChatTemplate) => {
    setNotice('')
    setPreview(tpl)
  }

  const closePreview = () => {
    setPreview(null)
    setNotice('')
  }

  const copyAndChat = async (tpl: ChatTemplate) => {
    const ok = await copy(tpl.content)
    if (!ok) {
      setNotice(t('chatTemplates.copyFailed'))
      return
    }
    setPreview(null)
    // Chat 的参数全是可选项,但该路由声明为对象形参,必须显式给空对象
    navigation.navigate('Chat', {})
    appAlert(t('common.ok'), t('chatTemplates.copied'))
  }

  const renderChips = () => (
    <View style={styles.chips}>
      <TouchableOpacity
        onPress={() => setActiveCat('all')}
        activeOpacity={0.7}
        style={[styles.chip, activeCat === 'all' && styles.chipActive]}
      >
        <Text style={[styles.chipText, activeCat === 'all' && styles.chipActiveText]}>
          {t('chatTemplates.all')}
        </Text>
      </TouchableOpacity>
      {categories.map((c) => {
        const active = activeCat === c.id
        return (
          <TouchableOpacity
            key={c.id}
            onPress={() => setActiveCat(c.id)}
            activeOpacity={0.7}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipActiveText]}>{c.name}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  const renderCard = ({ item }: { item: ChatTemplate }) => (
    <TouchableOpacity style={styles.card} onPress={() => openPreview(item)} activeOpacity={0.7}>
      <View style={styles.cardTitleRow}>
        <Sparkles size={16} color={tokens.text.secondary} />
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <Text style={styles.cardContent} numberOfLines={2}>
        {item.content}
      </Text>
      <View style={styles.cardMeta}>
        <View style={styles.cardMetaLeft}>
          {item.categoryId ? <Text style={styles.badge}>{catName(item.categoryId)}</Text> : null}
          <Text style={styles.metaText}>{t('chatTemplates.use')}</Text>
        </View>
        <Text style={styles.metaText}>
          {Number.isNaN(new Date(item.createdAt).getTime())
            ? '—'
            : dateFmt.format(new Date(item.createdAt))}
        </Text>
      </View>
    </TouchableOpacity>
  )

  const isEmpty = !loading && !error && visible.length === 0
  const emptyText =
    templates.length === 0 ? t('chatTemplates.empty') : t('chatTemplates.emptySearch')

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('chatTemplates.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load()
            }}
            tintColor={tokens.text.tertiary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.subtitle}>{t('chatTemplates.subtitle')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={query}
              onChangeText={setQuery}
              placeholder={t('chatTemplates.searchPlaceholder')}
              style={styles.input}
              returnKeyType="search"
            />
            {renderChips()}
            {loading ? (
              <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    setLoading(true)
                    void load()
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.retryText}>{t('chatTemplates.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : isEmpty ? (
              <View style={styles.emptyBox}>
                <LayoutTemplate size={32} color={tokens.text.tertiary} />
                <Text style={styles.emptyText}>{emptyText}</Text>
              </View>
            ) : null}
          </View>
        }
      />

      <Modal
        visible={preview !== null}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <Pressable style={styles.overlay} onPress={closePreview}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {preview?.title ?? t('chatTemplates.previewTitle')}
              </Text>
              <TouchableOpacity onPress={closePreview} hitSlop={8} activeOpacity={0.7}>
                <X size={20} color={tokens.text.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetLabel}>{t('chatTemplates.contentLabel')}</Text>
            <ScrollView style={styles.sheetContentBox}>
              <Text selectable style={styles.sheetContent}>
                {preview?.content ?? ''}
              </Text>
            </ScrollView>
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                if (preview) void onCopy(preview.content)
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>{t('chatTemplates.copy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                if (preview) void copyAndChat(preview)
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>{t('chatTemplates.goChat')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: rnSpacing.md, paddingBottom: rnSpacing['3xl'], gap: 10 },
  header: { gap: 10 },
  subtitle: { fontSize: 13, color: tokens.text.secondary },
  input: {
    height: 42,
    paddingHorizontal: rnSpacing.md,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    color: tokens.text.primary,
    fontSize: rnType.strong.size,
    backgroundColor: tokens.surface.card,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
  chip: {
    paddingHorizontal: rnSpacing.md,
    paddingVertical: 6,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  chipActive: { backgroundColor: tokens.brand.cta },
  chipText: { fontSize: rnType.label.size, fontWeight: '500', color: tokens.text.secondary },
  chipActiveText: { color: tokens.brand.ctaForeground },
  loading: { paddingVertical: rnSpacing['2xl'] },
  errorBox: {
    paddingVertical: rnSpacing.lg,
    paddingHorizontal: rnSpacing.md,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.DEFAULT,
    backgroundColor: tokens.surface.card,
    gap: rnSpacing.sm,
  },
  errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  retryText: { fontSize: 13, color: tokens.text.primary },
  emptyBox: { alignItems: 'center', paddingVertical: rnSpacing['4xl'], gap: rnSpacing.sm },
  emptyText: { fontSize: 13, color: tokens.text.secondary },
  card: {
    padding: rnSpacing.lg,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    gap: rnSpacing.sm,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: {
    flex: 1,
    fontSize: rnType.strong.size,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  cardDesc: { fontSize: rnType.label.size, lineHeight: 18, color: tokens.text.secondary },
  cardContent: {
    fontSize: rnType.label.size,
    lineHeight: 18,
    fontFamily: 'monospace',
    color: tokens.text.secondary,
    paddingHorizontal: rnSpacing.sm,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.bg,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm, flexShrink: 1 },
  badge: {
    fontSize: rnType.caption.size,
    color: tokens.text.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  metaText: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: rnSpacing.xl,
    backgroundColor: tokens.overlay.modal,
  },
  sheet: {
    borderRadius: rnRadius.xl,
    backgroundColor: tokens.surface.card,
    padding: rnSpacing.lg,
    gap: 10,
    maxHeight: '80%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
  sheetTitle: {
    flex: 1,
    fontSize: rnType.title.size,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  sheetLabel: { fontSize: rnType.label.size, color: tokens.text.tertiary },
  sheetContentBox: {
    padding: 10,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.bg,
    maxHeight: 260,
  },
  sheetContent: { fontSize: 13, lineHeight: 20, color: tokens.text.primary },
  notice: { fontSize: rnType.label.size, color: tokens.text.secondary },
  button: {
    height: 44,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: rnType.strong.size,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  secondaryButtonText: {
    fontSize: rnType.strong.size,
    fontWeight: '600',
    color: tokens.text.primary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
