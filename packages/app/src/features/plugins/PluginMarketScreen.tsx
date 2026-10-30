// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  ArrowRight,
  Bot,
  Gift,
  Pin,
  Power,
  Search,
  Shield,
  Sparkles,
  X,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'pluginMarketPage'

/** 插件卡片行(内置与市场共形,source 决定分组) */
export interface PluginMarketRowView {
  id: string
  name: string
  desc: string
  tags: string[]
  cat: string
  source: 'project' | 'market'
  official?: boolean
  free?: boolean
  /** true = 后端有对应 MCP 工具;'model' = LiteLLM 已接入需配 .env;缺省 = 仅 prompt 意图 */
  integration?: true | 'model'
  installed: boolean
  pinned: boolean
  /** 市场插件外链;内置插件的站内路由不在此渲染(见文件头注) */
  url: string
}

/** 分类筛选片(计数由薄壳算好) */
export interface PluginCategoryChip {
  key: string
  label: string
  count: number
}

export interface PluginMarketScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录(web 未登录隐藏启用/收藏按钮,isAuthenticated=false) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  query: string
  onQueryChange: (value: string) => void
  filter: string
  categories: PluginCategoryChip[]
  onFilterChange: (key: string) => void
  sort: 'default' | 'name' | 'installed'
  onSortChange: (value: 'default' | 'name' | 'installed') => void
  /** 已过滤后的行(内置在前、市场在后,顺序由薄壳排好) */
  rows: PluginMarketRowView[]
  /** 在途插件 id(启停/收藏共用,防连点) */
  actingId: string | null
  onToggleInstall: (id: string) => void
  onTogglePinned: (id: string) => void
  /** 打开市场插件外链(内置插件的站内路由不在 RN 承载,不渲染入口) */
  onOpenUrl: (url: string) => void
  onResetFilters: () => void
}

/**
 * 插件市场共享屏 —— 承载 web `/plugins`
 * (apps/web/app/(main)/plugins/page.tsx + PluginMarketplace.tsx)。
 *
 * 数据面:插件目录在 web 端是前端静态数据(`@ihui/shared/plugins-data`,24 内置 + 199 市场),
 * 无目录 HTTP 端点;RN 端目录镜像见 apps/mobile-rn/src/data/plugin-catalog.ts。
 * 唯一有后端的是「启用/禁用 + 收藏」状态(GET /api/plugins/installed、POST|DELETE
 * /api/plugins/:id/install、PATCH /api/plugins/:id/preferences),由薄壳注入。
 *
 * 口径差(如实登记):
 *  - web 内置卡片点击跳站内路由(href),这些 href 在 RN 无对应屏 ⇒ 不渲染「进入」入口,不造死按钮;
 *  - web 市场卡片的「调用」(打开 AI 面板注入 prompt)与「添加到对话」在 RN 未承载,
 *    市场卡片只保留「访问官网」外链(web 同一 plugin.url);
 *  - web 每插件专属图标(lucide-react)在 RN 按 category 归并到同类 lucide-react-native 图标。
 * 只渲染;搜索防抖 / 过滤 / 排序 / 计数 / 安装态全部由薄壳处理。
 */
export function PluginMarketScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  query,
  onQueryChange,
  filter,
  categories,
  onFilterChange,
  sort,
  onSortChange,
  rows,
  actingId,
  onToggleInstall,
  onTogglePinned,
  onOpenUrl,
  onResetFilters,
}: PluginMarketScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const signedIn = loginRequiredText === ''

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.headerBox}>
          <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          <Text style={styles.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color={tk.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={onQueryChange}
          placeholder={t(`${NS}.searchPlaceholder`)}
          placeholderTextColor={tk.text.tertiary}
          autoCorrect={false}
        />
        {query ? (
          <Pressable
            onPress={() => onQueryChange('')}
            accessibilityLabel={t(`${NS}.clear`)}
            accessibilityRole="button"
            hitSlop={6}
          >
            <X size={14} color={tk.text.tertiary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>{t(`${NS}.sortLabel`)}</Text>
        {(['default', 'name', 'installed'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => onSortChange(key)}
            style={[styles.sortChip, sort === key && styles.sortChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: sort === key }}
          >
            <Text style={[styles.sortChipText, sort === key && styles.sortChipTextActive]}>
              {t(`${NS}.${key === 'default' ? 'sortDefault' : key === 'name' ? 'sortName' : 'sortInstalled'}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {categories.map((cat) => (
          <Pressable
            key={cat.key}
            onPress={() => onFilterChange(cat.key)}
            style={[styles.catChip, filter === cat.key && styles.catChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === cat.key }}
          >
            <Text style={[styles.catChipText, filter === cat.key && styles.catChipTextActive]}>
              {cat.label}
            </Text>
            <Text style={styles.catCount}>{cat.count}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.resultCount}>{t(`${NS}.resultCount`, { count: rows.length })}</Text>

      {loginRequiredText ? <Text style={styles.loginHint}>{loginRequiredText}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.text.secondary} />
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <Search size={30} color={tk.text.tertiary} />
          <Text style={styles.emptyTitle}>{t(`${NS}.emptyTitle`)}</Text>
          <Text style={styles.hintMuted}>{t(`${NS}.emptyDesc`)}</Text>
          <Pressable onPress={onResetFilters} accessibilityRole="button" style={styles.resetButton}>
            <Text style={styles.resetText}>{t(`${NS}.emptyReset`)}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const showSection = index === 0 || rows[index - 1]?.source !== item.source
            return (
              <View>
                {showSection ? (
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>
                      {item.source === 'project'
                        ? t(`${NS}.sectionProject`)
                        : t(`${NS}.sectionMarket`)}
                    </Text>
                    <Text style={styles.sectionDesc}>
                      {item.source === 'project'
                        ? t(`${NS}.sectionProjectDesc`)
                        : t(`${NS}.sectionMarketDesc`)}
                    </Text>
                  </View>
                ) : null}
                <PluginCard
                  row={item}
                  t={t}
                  colorScheme={colorScheme}
                  signedIn={signedIn}
                  acting={actingId === item.id}
                  onToggleInstall={() => onToggleInstall(item.id)}
                  onTogglePinned={() => onTogglePinned(item.id)}
                  onOpenUrl={() => onOpenUrl(item.url)}
                />
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

/** 按 category 归并的图标(web 每插件专属图标在 RN 侧不可用,见文件头注) */
function categoryIcon(category: string) {
  switch (category) {
    case 'browser':
      return ArrowRight
    case 'computer':
      return Power
    case 'agent':
    case 'mcp':
      return Bot
    default:
      return Sparkles
  }
}

function PluginCard({
  row,
  t,
  colorScheme,
  signedIn,
  acting,
  onToggleInstall,
  onTogglePinned,
  onOpenUrl,
}: {
  row: PluginMarketRowView
  t: TFunction
  colorScheme: AppThemeMode
  signedIn: boolean
  acting: boolean
  onToggleInstall: () => void
  onTogglePinned: () => void
  onOpenUrl: () => void
}) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const Icon = categoryIcon(row.cat)

  const integrationLabel =
    row.integration === true
      ? t(`${NS}.realIntegrated`)
      : row.integration === 'model'
        ? t(`${NS}.modelIntegrated`)
        : t(`${NS}.promptOnly`)

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Icon size={18} color={tk.text.primary} />
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardName} numberOfLines={1}>
            {row.name}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Shield size={10} color={tk.text.secondary} />
              <Text style={styles.badgeText}>
                {row.source === 'project' ? t(`${NS}.builtin`) : t(`${NS}.official`)}
              </Text>
            </View>
            {row.free ? (
              <View style={styles.badge}>
                <Gift size={10} color={tk.text.secondary} />
                <Text style={styles.badgeText}>{t(`${NS}.free`)}</Text>
              </View>
            ) : null}
            {row.installed ? (
              <View style={[styles.badge, styles.badgeActive]}>
                <Text style={styles.badgeActiveText}>{t(`${NS}.installedBadge`)}</Text>
              </View>
            ) : null}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{integrationLabel}</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.cardDesc} numberOfLines={2}>
        {row.desc}
      </Text>

      <View style={styles.badgeRow}>
        {row.tags.slice(0, 3).map((tag) => (
          <View key={tag} style={styles.tagChip}>
            <Text style={styles.tagChipText}>{tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.cardFooter}>
        {signedIn ? (
          <View style={styles.cardActions}>
            <Pressable
              onPress={onTogglePinned}
              disabled={!row.installed || acting}
              style={[styles.iconButton, (!row.installed || acting) && styles.buttonDisabled]}
              accessibilityLabel={row.pinned ? t(`${NS}.unpin`) : t(`${NS}.pin`)}
              accessibilityRole="button"
            >
              <Pin size={14} color={row.pinned ? tk.warning.DEFAULT : tk.text.secondary} />
            </Pressable>
            <Pressable
              onPress={onToggleInstall}
              disabled={acting}
              style={[styles.installButton, acting && styles.buttonDisabled]}
              accessibilityRole="button"
            >
              {acting ? <ActivityIndicator size="small" color={tk.text.primary} /> : null}
              <Text style={styles.installText}>
                {row.installed ? t(`${NS}.uninstall`) : t(`${NS}.install`)}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View />
        )}
        {row.source === 'market' ? (
          <Pressable onPress={onOpenUrl} accessibilityRole="link" style={styles.linkButton}>
            <Text style={styles.linkText}>{t(`${NS}.visit`)}</Text>
            <ArrowRight size={12} color={tk.brandAccent.deep} />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    headerBox: { flex: 1 },
    title: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.secondary },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.md,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      paddingHorizontal: rnSpacing.md,
      height: 38,
    },
    searchInput: { flex: 1, fontSize: rnType.body.size, color: tk.text.primary, padding: 0 },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      marginTop: rnSpacing.sm,
    },
    sortLabel: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    sortChip: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 3,
    },
    sortChipActive: { backgroundColor: tk.text.primary },
    sortChipText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    sortChipTextActive: { color: tk.surface.bg },
    chipRow: { gap: rnSpacing.xs, paddingVertical: rnSpacing.sm },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 3,
    },
    catChipActive: { backgroundColor: tk.text.primary },
    catChipText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    catChipTextActive: { color: tk.surface.bg },
    catCount: { fontSize: 10, color: tk.text.tertiary },
    resultCount: { fontSize: rnType.caption.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.secondary },
    errorText: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.danger.DEFAULT },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    emptyTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.secondary },
    hintMuted: { fontSize: rnType.caption.size, color: tk.text.tertiary, textAlign: 'center' },
    resetButton: {
      marginTop: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
    },
    resetText: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
    list: { flex: 1, marginTop: rnSpacing.xs },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    sectionHead: { marginTop: rnSpacing.sm, marginBottom: rnSpacing.xs },
    sectionTitle: { fontSize: rnType.label.size, fontWeight: '700', color: tk.text.primary },
    sectionDesc: { fontSize: rnType.caption.size, color: tk.text.tertiary, marginTop: 2 },
    card: {
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.md,
    },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.sm },
    cardIcon: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardMain: { flex: 1, gap: 3 },
    cardName: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: rnSpacing.xs },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
    },
    badgeText: { fontSize: 10, color: tk.text.secondary },
    badgeActive: { backgroundColor: tk.success.lighter },
    badgeActiveText: { fontSize: 10, color: tk.success.deepText },
    cardDesc: { fontSize: rnType.caption.size, lineHeight: 18, color: tk.text.secondary },
    tagChip: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.brandAccent.light,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
    },
    tagChipText: { fontSize: 10, color: tk.brandAccent.foreground },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    iconButton: {
      width: 30,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    installButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 4,
    },
    installText: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
    buttonDisabled: { opacity: 0.45 },
    linkButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    linkText: { fontSize: rnType.caption.size, color: tk.brandAccent.deep },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
