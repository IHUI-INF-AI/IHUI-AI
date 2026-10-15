// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SearchOverlay 顶栏搜索弹层(mobile-rn 端,2026-10-15 立)
 *
 * 对齐 web 端 TagsViewSearchButton 的弹窗形态(apps/web/src/components/layout/TagsView.tsx):
 * - 触发:顶栏搜索按钮(纯图标)点击 → 全屏遮罩 + 面板自顶淡入
 * - 遮罩:`tokens.overlay.modal`(亮 rgba(0,0,0,0.4) = web bg-black/40,暗 0.6 随主题),点遮罩关闭
 * - 面板:顶部避让状态栏(edge-to-edge)+ 顶部留白(PANEL_TOP_GAP 对应 web top-2)+ 宽
 *   min(640, 屏宽-32) 水平居中(web `min(640px, calc(100% - 2rem))` 同值);圆角取
 *   rnRadiusFor.popover(= web rounded-md 档,唯一源 radius.js 角色表),底色/边框/文字全走 token
 * - 三段面板(对齐 web SearchBar + search-suggestions):
 *   · 无输入 → 历史段(shared `common.searchHistory` + 清空 `searchHistory.clearAll`,
 *     AsyncStorage 'searchHistory' 与 web localStorage 同 key 同 10 条上限) + 分隔线 + 热门段
 *     (共享 POPULAR_SEARCHES 词池,Flame 图标取 warning token —— web 是硬编码 orange-500,
 *     本端相近色归并 warning,零硬编码)
 *   · 有输入 → 联想段(`search.quickSuggestions` 过滤前 8,Search 图标)
 * - 提交/点词条(2026-10-15 用户定稿:弹窗内直接出结果,不跳全屏搜索页):
 *   写历史 → fetchApi('/api/search') → 面板下半区出结果卡(卡样式复刻共享 SearchScreen),
 *   loading / error / empty 三态;点结果卡进详情并关弹窗
 * - 关闭:点遮罩 / Android 返回键(onRequestClose) / 点结果卡;关闭即清空输入与结果(重开干净态)
 * - 过期响应防抖:seq 序号,关闭/重搜后旧请求返回即丢弃
 *
 * 全屏 SearchScreen 路由保留(直链仍可达),本组件只是三处入口统一的弹窗形态。
 */
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Clock, Flame, Search } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadiusFor } from '@ihui/design-tokens'
import { POPULAR_SEARCHES } from '@ihui/shared/utils/search-suggestions'
import { SearchInput, type SearchScreenItem } from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useI18n, getValueByPath, messages } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { tokens } from '../theme/active-tokens'
import { useSearchHistory } from '../hooks/use-search-history'

/** 面板水平留白(对应 web `calc(100% - 2rem)` 的 2×16px) */
const PANEL_SCREEN_MARGIN = 16
/** 面板宽度上限(对应 web `min(640px, ...)`) */
const PANEL_MAX_WIDTH = 640
/** 状态栏避让后的顶部留白(对应 web 弹层 top-2 = 8px) */
const PANEL_TOP_GAP = 8
/** 面板高度上限:占屏高比例(web 弹层内容自适应但不铺满,此值为 RN 侧等价约束) */
const PANEL_MAX_HEIGHT_RATIO = 0.65
/** 面板最小高度:避免仅输入框的过矮面板(web 面板高度由内容自然撑开) */
const PANEL_MIN_HEIGHT = 240
/** 联想段条数上限(对齐 web slice(0, 8)) */
const SUGGESTION_LIMIT = 8
/** 词行规格(对齐 web `px-2 py-1.5 text-sm`) */
const WORD_ROW_PADDING_H = 8
const WORD_ROW_PADDING_V = 6
const WORD_ROW_FONT = 14
/** 段标题规格(对齐 web `text-xs`) */
const SECTION_LABEL_FONT = 12
/** 行左图标(对齐 web `h-3 w-3` = 12px) */
const ROW_ICON_SIZE = 12

export interface SearchOverlayProps {
  visible: boolean
  onClose: () => void
  /** 结果卡点击(默认按类型映射进详情页;调用方可覆盖为端内特有语义) */
  onPressItem?: (item: SearchScreenItem) => void
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 结果项类型 → 详情路由(与全屏 SearchScreen.tsx 同一映射) */
function routeForResult(
  item: SearchScreenItem,
  navigation: NavigationProp,
  rootNav: NavigationProp | null,
): void {
  // 详情屏挂在 RootStack:从任意层级都能解析到,取不到父级就走自身
  const target = rootNav ?? navigation
  if (item.type === 'course') target.navigate('CourseDetail', { id: item.id })
  else if (item.type === 'article') target.navigate('ArticleDetail', { id: item.id })
  else if (item.type === 'post') target.navigate('PostDetail', { id: item.id })
  else if (item.type === 'note') target.navigate('NoteDetail', { id: item.id })
  else if (item.type === 'agent') target.navigate('AgentDetail', { id: item.id })
}

/** 结果卡类型徽章文案 key(与共享 SearchScreen 同表) */
const TYPE_KEY: Record<SearchScreenItem['type'], string> = {
  course: 'search.type.course',
  article: 'search.type.article',
  post: 'search.type.post',
  note: 'search.type.note',
  agent: 'search.type.agent',
}

/** 遮罩 Pressable 的按压态:透明度只在按下时微降(避免触摸预览高亮) */
const BACKDROP_PRESSED = { opacity: 0.9 } as const

interface WordRowProps {
  icon: 'clock' | 'flame' | 'search'
  label: string
  onPress: () => void
}

/** 词条行(历史/热门/联想段共用;对齐 web `flex items-center gap-2 px-2 py-1.5 hover:bg-accent`) */
function WordRow({ icon, label, onPress }: WordRowProps) {
  const iconColor =
    icon === 'flame'
      ? tokens.warning.DEFAULT
      : icon === 'clock'
        ? tokens.text.tertiary
        : tokens.text.medium
  const Icon = icon === 'clock' ? Clock : icon === 'flame' ? Flame : Search
  return (
    <Pressable
      onPress={onPress}
      style={styles.wordRow}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {({ pressed }) => (
        <View style={[styles.wordRowFace, pressed ? styles.wordRowPressed : null]}>
          <Icon size={ROW_ICON_SIZE} color={iconColor} />
          <Text style={styles.wordRowText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

export const SearchOverlay = memo(function SearchOverlay({
  visible,
  onClose,
  onPressItem,
}: SearchOverlayProps) {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<NavigationProp | null>()
  const insets = useSafeAreaInsets()
  const { width: winW, height: winH } = useWindowDimensions()

  const [value, setValue] = useState('')
  const [results, setResults] = useState<SearchScreenItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const { history, addHistory, clearHistory } = useSearchHistory()
  const seqRef = useRef(0)

  // 联想池:i18n `search.quickSuggestions` 数组词条(5 语言齐备)。
  // t() 只回字符串,数组要经 getValueByPath 直查 messages 单例(locale 是 messages 取数的依赖,
  // 缺 key 时 translate 会 fallback 到 zh-CN,故再挂 locale 触发重算);取不到时返回空段
  // (不落硬编码词池 —— 界面文案必须走语言包,硬编码中文由守门 70 棘轮拦截)。
  const suggestions = useMemo<string[]>(() => {
    const raw = getValueByPath(messages[locale], 'search.quickSuggestions')
    if (Array.isArray(raw)) {
      return raw.filter((s): s is string => typeof s === 'string').slice(0, SUGGESTION_LIMIT)
    }
    return []
  }, [locale])

  // 输入过滤(对齐 web SearchBar filteredSuggestions:includes 忽略大小写、最多 8)
  const filteredSuggestions = useMemo(() => {
    const kw = value.trim().toLowerCase()
    if (!kw) return []
    return suggestions.filter((s) => s.toLowerCase().includes(kw)).slice(0, SUGGESTION_LIMIT)
  }, [value, suggestions])

  const runSearch = useCallback(
    async (kw: string): Promise<void> => {
      const trimmed = kw.trim()
      if (!trimmed) return
      const seq = ++seqRef.current
      addHistory(trimmed)
      setLoading(true)
      setError('')
      setSearched(true)
      try {
        const res = await fetchApi<SearchScreenItem[]>(
          `/api/search?keyword=${encodeURIComponent(trimmed)}`,
        )
        if (seq !== seqRef.current) return // 关闭/重搜后的过期响应丢弃
        setLoading(false)
        setResults(res.success ? (res.data ?? []) : [])
        if (!res.success) setError(res.error || t('search.failed'))
      } catch (e) {
        if (seq !== seqRef.current) return
        setLoading(false)
        setResults([])
        setError(e instanceof Error && e.message ? e.message : t('search.failed'))
      }
    },
    [addHistory, t],
  )

  // 关闭即清空(重开是干净态;序号递增作废在途请求)
  const handleClose = useCallback(() => {
    seqRef.current += 1
    setValue('')
    setResults([])
    setError('')
    setSearched(false)
    setLoading(false)
    onClose()
  }, [onClose])

  const handleItemPress = useCallback(
    (item: SearchScreenItem) => {
      if (onPressItem) onPressItem(item)
      else routeForResult(item, navigation, rootNav)
      handleClose()
    },
    [onPressItem, navigation, rootNav, handleClose],
  )

  // 点词条 = 填词 + 直接搜索(对齐 web 历史/热门/联想三段的点击语义)
  const handlePick = useCallback(
    (kw: string) => {
      setValue(kw)
      void runSearch(kw)
    },
    [runSearch],
  )

  const panelWidth = Math.min(PANEL_MAX_WIDTH, winW - PANEL_SCREEN_MARGIN * 2)
  const panelMaxHeight = Math.max(PANEL_MIN_HEIGHT, winH * PANEL_MAX_HEIGHT_RATIO)
  const hasInput = value.trim().length > 0
  const showHistory = history.length > 0
  const showPopular = POPULAR_SEARCHES.length > 0

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* 遮罩:全屏可点关闭(对齐 web `fixed inset-0 bg-black/40`);style 数组形态,
          按压反馈走 children 渲染函数(守门 131:函数形态 style 会被 cssInterop 吃掉) */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: tokens.overlay.modal }]}
        onPress={handleClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        {({ pressed }) => <View style={[styles.backdropFace, pressed ? BACKDROP_PRESSED : null]} />}
      </Pressable>
      {/* 面板容器:状态栏避让 + 顶部留白,水平居中(web top-2 形态) */}
      <View style={[styles.panelWrap, { paddingTop: insets.top + PANEL_TOP_GAP }]}>
        <View style={[styles.panel, { width: panelWidth, maxHeight: panelMaxHeight }]}>
          <View style={styles.inputRow}>
            <SearchInput
              value={value}
              onChangeText={setValue}
              placeholder={t('common.searchPlaceholder')}
              onSubmit={() => void runSearch(value)}
              autoFocus
              voiceEnabled={false}
              colorScheme={resolvedTheme}
            />
          </View>

          <ScrollView
            style={styles.bodyScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── 静默段(无输入):历史 + 分隔线 + 热门;查询段(有输入):联想 ── */}
            {!hasInput ? (
              <>
                {showHistory ? (
                  <View>
                    <View style={styles.sectionHead}>
                      <Text style={styles.sectionLabel}>{t('common.searchHistory')}</Text>
                      <Pressable
                        onPress={clearHistory}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('searchHistory.clearAll')}
                      >
                        <Text style={styles.sectionAction}>{t('searchHistory.clearAll')}</Text>
                      </Pressable>
                    </View>
                    {history.map((item) => (
                      <WordRow
                        key={item}
                        icon="clock"
                        label={item}
                        onPress={() => handlePick(item)}
                      />
                    ))}
                  </View>
                ) : null}
                {showHistory && showPopular ? <View style={styles.divider} /> : null}
                {showPopular ? (
                  <View>
                    <View style={styles.sectionHead}>
                      <Text style={styles.sectionLabel}>{t('search.popular')}</Text>
                    </View>
                    {POPULAR_SEARCHES.map((item) => (
                      <WordRow
                        key={item}
                        icon="flame"
                        label={item}
                        onPress={() => handlePick(item)}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {filteredSuggestions.map((item) => (
                  <WordRow key={item} icon="search" label={item} onPress={() => handlePick(item)} />
                ))}
                {filteredSuggestions.length > 0 ? <View style={styles.divider} /> : null}
              </>
            )}

            {/* ── 结果区:提交后出现在面板下半区(2026-10-15 用户定稿:弹窗内直接出结果) ── */}
            {searched ? (
              <View>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionLabel} numberOfLines={1}>
                    {value.trim()}
                  </Text>
                </View>
                {loading ? (
                  <View style={styles.stateBox}>
                    <ActivityIndicator size="small" color={tokens.brand.DEFAULT} />
                    <Text style={styles.stateText}>{t('common.loading')}</Text>
                  </View>
                ) : null}
                {!loading && error ? (
                  <View style={styles.stateBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
                {!loading && !error && results.length === 0 ? (
                  <View style={styles.stateBox}>
                    <Text style={styles.stateText}>{t('search.empty')}</Text>
                  </View>
                ) : null}
                {!loading && !error
                  ? results.map((item) => (
                      <Pressable
                        key={`${item.type}_${item.id}`}
                        onPress={() => handleItemPress(item)}
                        style={styles.card}
                        accessibilityRole="button"
                      >
                        {({ pressed }) => (
                          <View style={[styles.cardFace, pressed ? styles.cardPressed : null]}>
                            <View style={styles.cardHead}>
                              <Text style={styles.typeBadge}>{t(TYPE_KEY[item.type])}</Text>
                            </View>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={styles.cardSummary} numberOfLines={2}>
                              {item.summary}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    ))
                  : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  backdrop: {
    // RN 类型面无 absoluteFillObject(仅 absoluteFill 且为注册样式不可展开) → 手写四向
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdropFace: {
    // 遮罩按压反馈的视觉面(撑满 Pressable;透明度变化走 BACKDROP_PRESSED)
    flex: 1,
  },
  panelWrap: {
    flex: 1,
    // 面板水平居中(web `mx-auto` 等价;弹层容器本身不接收触摸,让遮罩透到下层)
    alignItems: 'center',
    paddingHorizontal: PANEL_SCREEN_MARGIN,
  },
  panel: {
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadiusFor.popover,
    borderWidth: 1,
    borderColor: tokens.border.light,
    // 阴影(web ui-popover shadow-md 的 RN 档:elevation 平台 + shadow* 跨平台)
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    // 面板内左右留白(web SearchInput wrapperClassName p-1.5 ≈ 6px + 面板 p-1 的合成量级)
    paddingTop: 6,
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  inputRow: {
    // 输入行落在面板内圈(web `p-1.5` 内边距的 RN 对位)
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  bodyScroll: {
    flexGrow: 0,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: WORD_ROW_PADDING_H,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: SECTION_LABEL_FONT,
    color: tokens.text.tertiary,
    flexShrink: 1,
  },
  sectionAction: {
    fontSize: SECTION_LABEL_FONT,
    color: tokens.text.tertiary,
  },
  wordRow: {
    // 命中区 = 整行(face 的盒子在子 View,外层只承接点击与无障碍语义)
    width: '100%',
  },
  wordRowFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: WORD_ROW_PADDING_H,
    paddingVertical: WORD_ROW_PADDING_V,
    borderRadius: rnRadiusFor.tiny,
  },
  wordRowPressed: {
    backgroundColor: tokens.surface.muted,
  },
  wordRowText: {
    flexShrink: 1,
    fontSize: WORD_ROW_FONT,
    color: tokens.text.primary,
  },
  // 段间分隔线(web `h-px bg-muted/30` 的 RN 对位:1px muted 色)
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: tokens.surface.muted,
    marginVertical: 6,
    marginHorizontal: WORD_ROW_PADDING_H,
  },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 24,
  },
  stateText: {
    fontSize: 14,
    color: tokens.text.secondary,
  },
  errorText: {
    fontSize: 14,
    color: tokens.danger.DEFAULT,
  },
  card: {
    // 外层裸 Pressable 只承接点击与无障碍语义,盒子(边框/圆角/内距/按压态)整体落在 face
    width: '100%',
    marginBottom: 12,
  },
  cardFace: {
    padding: 12,
    borderRadius: rnRadiusFor.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardHead: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  typeBadge: {
    fontSize: 10,
    color: tokens.success.deepText,
    backgroundColor: tokens.success.light,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: rnRadiusFor.chip,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  cardSummary: {
    marginTop: 8,
    fontSize: 14,
    color: tokens.text.medium,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
