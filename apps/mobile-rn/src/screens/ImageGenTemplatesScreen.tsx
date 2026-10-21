// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 提示词模板 —— 对齐 web `/image-gen/templates`。
 *
 * 契约(按 apps/api/src/routes/other/image-gen-routes.ts 与 content_generation_templates 表实读):
 *  - `GET /api/image-gen/templates` 返回 `{ list }`(无 categories 键,也不分页);
 *  - 行字段是 id/name/description/prompt/category/status/createdAt,
 *    web 页假设的 title/categoryId/previewUrl 三个字段在响应里都不存在;
 *  - 因此分类筛选从 list 自身的 category 值派生,标题取 name,且不渲染预览图(无预览字段)。
 *
 * 使用动线:RN 的 `ImageGenCreate` 路由声明为 `undefined`(不吃 params),不能把模板 id/提示词
 * 作为导航参数硬塞进去;改为「预览 + 复制 + 去生成」,复制后进入生成页粘贴。
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
import { rnRadius } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useClipboard } from '../hooks/use-clipboard'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface ImageTemplate {
  id: string
  name: string
  description: string | null
  prompt: string | null
  category: string | null
  status: number
  createdAt: string
}

interface TemplatesData {
  list: ImageTemplate[]
}

export default function ImageGenTemplatesScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { copy } = useClipboard()

  const [templates, setTemplates] = useState<ImageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [activeCat, setActiveCat] = useState('all')
  const [preview, setPreview] = useState<ImageTemplate | null>(null)
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
      const res = await fetchApi<TemplatesData>('/api/image-gen/templates')
      if (!res.success) {
        setError(t('imageGenTemplates.loadFailed'))
        return
      }
      setTemplates(res.data.list)
    } catch {
      setError(t('imageGenTemplates.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  /** 分类字典:端点不返回 categories,从行上的 category 值派生(保序去重) */
  const categories = useMemo(() => {
    const seen: string[] = []
    for (const tpl of templates) {
      const c = tpl.category?.trim()
      if (c && !seen.includes(c)) seen.push(c)
    }
    return seen
  }, [templates])

  const visible = useMemo(
    () =>
      activeCat === 'all'
        ? templates
        : templates.filter((tpl) => (tpl.category?.trim() ?? '') === activeCat),
    [templates, activeCat],
  )

  const onCopy = async (text: string): Promise<boolean> => {
    const ok = await copy(text)
    setNotice(ok ? t('imageGenTemplates.copied') : t('imageGenTemplates.copyFailed'))
    return ok
  }

  const copyAndCreate = async (tpl: ImageTemplate) => {
    if (!tpl.prompt) return
    const ok = await copy(tpl.prompt)
    if (!ok) {
      setNotice(t('imageGenTemplates.copyFailed'))
      return
    }
    setPreview(null)
    navigation.navigate('ImageGenCreate')
    appAlert(t('common.ok'), t('imageGenTemplates.copied'))
  }

  const renderChips = () => (
    <View style={styles.chips}>
      <TouchableOpacity
        onPress={() => setActiveCat('all')}
        activeOpacity={0.7}
        style={[styles.chip, activeCat === 'all' && styles.chipActive]}
      >
        <Text style={[styles.chipText, activeCat === 'all' && styles.chipActiveText]}>
          {t('imageGenTemplates.all')}
        </Text>
      </TouchableOpacity>
      {categories.map((c) => {
        const active = activeCat === c
        return (
          <TouchableOpacity
            key={c}
            onPress={() => setActiveCat(c)}
            activeOpacity={0.7}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipActiveText]}>{c}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  const renderCard = ({ item }: { item: ImageTemplate }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        setNotice('')
        setPreview(item)
      }}
      activeOpacity={0.7}
    >
      <View style={styles.cardTitleRow}>
        <Sparkles size={16} color={tokens.text.secondary} />
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      {item.prompt ? (
        <Text style={styles.cardPrompt} numberOfLines={2}>
          {item.prompt}
        </Text>
      ) : null}
      <View style={styles.cardMeta}>
        <View style={styles.cardMetaLeft}>
          <Text style={styles.badge}>
            {item.category?.trim() || t('imageGenTemplates.uncategorized')}
          </Text>
          <Text style={styles.metaText}>{t('imageGenTemplates.use')}</Text>
        </View>
        <Text style={styles.metaText}>
          {Number.isNaN(new Date(item.createdAt).getTime())
            ? '—'
            : dateFmt.format(new Date(item.createdAt))}
        </Text>
      </View>
    </TouchableOpacity>
  )

  const empty = !loading && !error && visible.length === 0

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('imageGenTemplates.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <FlatList
        data={error ? [] : visible}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        numColumns={2}
        columnWrapperStyle={styles.column}
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
            <Text style={styles.subtitle}>{t('imageGenTemplates.subtitle')}</Text>
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
                  <Text style={styles.retryText}>{t('imageGenTemplates.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              renderChips()
            )}
            {empty ? (
              <View style={styles.emptyBox}>
                <LayoutTemplate size={32} color={tokens.text.tertiary} />
                <Text style={styles.emptyText}>{t('imageGenTemplates.empty')}</Text>
              </View>
            ) : null}
          </View>
        }
      />

      <Modal
        visible={preview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPreview(null)
          setNotice('')
        }}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => {
            setPreview(null)
            setNotice('')
          }}
        >
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {preview?.name ?? t('imageGenTemplates.previewTitle')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setPreview(null)
                  setNotice('')
                }}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <X size={20} color={tokens.text.secondary} />
              </TouchableOpacity>
            </View>
            {preview?.description ? (
              <Text style={styles.sheetDesc}>{preview.description}</Text>
            ) : null}
            <Text style={styles.sheetLabel}>{t('imageGenTemplates.contentLabel')}</Text>
            <ScrollView style={styles.sheetContentBox}>
              <Text selectable style={styles.sheetContent}>
                {preview?.prompt ?? ''}
              </Text>
            </ScrollView>
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            <TouchableOpacity
              style={[styles.button, !preview?.prompt && styles.buttonDisabled]}
              disabled={!preview?.prompt}
              onPress={() => {
                if (preview?.prompt) void onCopy(preview.prompt)
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>{t('imageGenTemplates.copy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                !preview?.prompt && styles.buttonDisabled,
              ]}
              disabled={!preview?.prompt}
              onPress={() => {
                if (preview) void copyAndCreate(preview)
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>{t('imageGenTemplates.goCreate')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: 12, paddingBottom: 32, gap: 10 },
  column: { gap: 10 },
  header: { gap: 10, paddingBottom: 2 },
  subtitle: { fontSize: 13, color: tokens.text.secondary },
  loading: { paddingVertical: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  chipActive: { backgroundColor: tokens.brand.cta },
  chipText: { fontSize: 12, fontWeight: '500', color: tokens.text.secondary },
  chipActiveText: { color: tokens.brand.ctaForeground },
  errorBox: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.DEFAULT,
    backgroundColor: tokens.surface.card,
    gap: 8,
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
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: tokens.text.secondary },
  card: {
    flex: 1,
    padding: 16,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    gap: 8,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  cardDesc: { fontSize: 12, lineHeight: 18, color: tokens.text.secondary },
  cardPrompt: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
    color: tokens.text.secondary,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.bg,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  badge: {
    fontSize: 11,
    color: tokens.text.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: rnRadius.md,
    backgroundColor: tokens.surface.muted,
  },
  metaText: { fontSize: 11, color: tokens.text.tertiary },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: tokens.overlay.modal,
  },
  sheet: {
    borderRadius: rnRadius.xl,
    backgroundColor: tokens.surface.card,
    padding: 16,
    gap: 10,
    maxHeight: '80%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sheetTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: tokens.text.primary },
  sheetDesc: { fontSize: 12, lineHeight: 18, color: tokens.text.secondary },
  sheetLabel: { fontSize: 12, color: tokens.text.tertiary },
  sheetContentBox: {
    padding: 10,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.surface.bg,
    maxHeight: 260,
  },
  sheetContent: { fontSize: 13, lineHeight: 20, color: tokens.text.primary },
  notice: { fontSize: 12, color: tokens.text.secondary },
  button: {
    height: 44,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 15, fontWeight: '600', color: tokens.brand.ctaForeground },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
