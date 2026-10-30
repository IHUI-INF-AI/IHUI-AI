// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 资源更新中心共享屏 —— 承载 web /registry(GET /api/registry/items + POST /api/registry/install)。
 *
 * web 页(apps/web/app/(main)/registry/page.tsx:38-194)的能力面:排序 Tabs(最新/最热/最优)、
 * 来源筛选(全部/MCP/Skill/Plugin)、资源卡片(安装 / 可升级 / 已安装)、管理员面板
 * (手动同步、配置漂移检测、Worker 指标、同步日志 —— 后端全 requireAdmin,
 * registry-sync.ts:316/331/605/677)。RN 本次承载主路径 = 筛选 + 列表 + 安装 + 触底续页;
 * 排序固定 'latest'(web 的「最热/最优」两档全库无对应 i18n 文案,不自造),管理员面板未承载。
 *
 * 平台无关:取数 / 分页 / 登录门 / 文案拼装全部由薄壳注入,本文件只渲染与三态。
 */
import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Package } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'registryPage'

export interface RegistryFilterOption {
  key: string
  label: string
}

export interface RegistryItemRowView {
  id: string
  /** 安装入参:后端按 sourceType + sourceId 定位条目(registry-sync.ts:496-511) */
  sourceType: string
  sourceId: string
  name: string
  description: string
  /** 来源类型文案(MCP / Skill / Plugin,薄壳按 sourceType 注入) */
  typeText: string
  /** 安装状态文案(已安装 / 未安装,薄壳注入) */
  statusText: string
  installed: boolean
  version: string
  author: string
  tags: string[]
}

export interface RegistryScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: RegistryItemRowView[]
  total: number
  filters: RegistryFilterOption[]
  activeFilter: string
  onFilterChange: (key: string) => void
  /** 正在安装的资源 id(禁用该行按钮) */
  installingId: string | null
  onInstall: (row: RegistryItemRowView) => void
  loadingMore: boolean
  hasMore: boolean
  onEndReached: () => void
  onRefresh: () => void
}

export function RegistryScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  rows,
  total,
  filters,
  activeFilter,
  onFilterChange,
  installingId,
  onInstall,
  loadingMore,
  hasMore,
  onEndReached,
  onRefresh,
}: RegistryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          <Text style={styles.count}>{t(`${NS}.total`, { total })}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
        {filters.map((item) => {
          const active = item.key === activeFilter
          return (
            <Pressable
              key={item.key}
              onPress={() => onFilterChange(item.key)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                {item.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error || t('common.loadFailed')}</Text>
      ) : rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <Package size={30} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
          onEndReached={hasMore ? onEndReached : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <Text style={styles.footerMuted}>{t(`${NS}.loading`)}</Text> : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{item.typeText}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name || '-'}
                </Text>
                <Text style={item.installed ? styles.statusOn : styles.statusOff}>
                  {item.statusText}
                </Text>
              </View>
              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                {item.version ? (
                  <Text style={styles.metaText}>{`v${item.version}`}</Text>
                ) : null}
                {item.author ? (
                  <Text style={styles.metaText} numberOfLines={1}>
                    {`· ${item.author}`}
                  </Text>
                ) : null}
              </View>
              {item.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {item.tags.slice(0, 5).map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText} numberOfLines={1}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {item.installed ? null : (
                <Pressable
                  disabled={installingId === item.id}
                  onPress={() => onInstall(item)}
                  style={styles.installBtn}
                >
                  <Text style={styles.installBtnText}>
                    {installingId === item.id ? t(`${NS}.installing`) : t(`${NS}.install`)}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        />
      )}
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
    titleBox: { flex: 1 },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    count: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.tertiary },
    filterBar: { marginTop: rnSpacing.md, maxHeight: 36 },
    chip: {
      marginRight: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    chipActive: { backgroundColor: tk.brand.DEFAULT },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipTextActive: { color: tk.brand.foreground },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    list: { flex: 1, marginTop: rnSpacing.sm },
    listContent: { paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    typeBadge: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
    },
    typeBadgeText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    cardTitle: { flex: 1, fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    statusOn: { fontSize: rnType.caption.size, color: tk.brand.DEFAULT },
    statusOff: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    cardDesc: { fontSize: rnType.label.size, color: tk.text.secondary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    metaText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    tag: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      maxWidth: '100%',
    },
    tagText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    installBtn: {
      alignItems: 'center',
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.DEFAULT,
      paddingVertical: rnSpacing.sm,
    },
    installBtnText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brand.foreground },
    footerMuted: {
      textAlign: 'center',
      paddingVertical: rnSpacing.md,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
