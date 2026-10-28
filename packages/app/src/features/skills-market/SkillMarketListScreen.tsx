// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Download, Wand2 } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { SkillMarketEntryView, SkillMarketListScreenProps } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

export type { SkillMarketEntryView, SkillMarketListScreenProps }

/**
 * SkillMarketListScreen 技能市场列表页(共享层)
 *
 * 2026-10-28 补屏立,承载 web `/skills-market`
 * (apps/web/app/(main)/skills-market/PageClient.tsx)。结构对齐基准端:
 * - 顶栏(返回 / 标题 + 总数徽章)→ 副标题 → 搜索框 + 标签筛选 → 卡片列表 → 分页
 * - 卡片:名称 / 评分(★ + 条数)/ 安装量 / 描述(2 行截断)/ 前 3 个标签 / 作者 / 版本
 * - web 卡片上的「启用 / 停用 / 一键安装」三个写动作**不搬**:它们要 `/api/skills/enabled`
 *   与 `POST /api/skills/:name/{enable,disable,install}` 三条额外端点,属另一条写链路;
 *   本屏是只读浏览,`onSelect` 交宿主 navigate 到详情屏
 * - 数据源为 `GET /api/skills/market`(`SkillMarketEntry`),**不是** `AiSkill*` 的
 *   `/api/ai-skills`,两者不同域
 * - 平台无关:取数、分页、导航全由宿主注入;标签候选与总页数也由宿主算好
 * - 样式:getTokens(colorScheme) 语义 token,零 hex,间距走 rnSpacing/rnType/rnRadius
 */
export function SkillMarketListScreen({
  t,
  items,
  tags,
  keyword,
  tag,
  total,
  page,
  totalPages,
  loading,
  error,
  onKeywordChange,
  onSearch,
  onTagChange,
  onPageChange,
  onSelect,
  onBack,
  onRetry,
  colorScheme = 'light',
}: SkillMarketListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const header = (
    <View style={styles.head}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <View style={styles.titleRow}>
        <Wand2 size={20} color={tk.text.primary} strokeWidth={2} />
        <Text style={styles.title} numberOfLines={1}>
          {t('skillsMarket.title')}
        </Text>
        {!loading && !error ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{t('skillsMarket.count', { count: total })}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.subtitle}>{t('skillsMarket.subtitle')}</Text>
    </View>
  )

  const filters = (
    <View>
      <View style={styles.searchRow}>
        <TextField
          colorScheme={colorScheme}
          style={styles.input}
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder={t('skillsMarket.searchPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          onSubmitEditing={onSearch}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={onSearch} accessibilityRole="button">
          <Text style={styles.searchBtnText}>{t('common.search')}</Text>
        </TouchableOpacity>
      </View>
      {tags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagRow}
        >
          <TouchableOpacity
            style={[styles.tagChip, tag === '' ? styles.tagChipActive : null]}
            onPress={() => onTagChange('')}
            accessibilityRole="button"
          >
            <Text style={[styles.tagText, tag === '' ? styles.tagTextActive : null]}>
              {t('skillsMarket.allTags')}
            </Text>
          </TouchableOpacity>
          {tags.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.tagChip, tag === item ? styles.tagChipActive : null]}
              onPress={() => onTagChange(item)}
              accessibilityRole="button"
            >
              <Text style={[styles.tagText, tag === item ? styles.tagTextActive : null]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  )

  if (loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      {filters}
      <FlatList
        data={items}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title={t('skillsMarket.empty')}
            desc={t('skillsMarket.emptyHint')}
            colorScheme={colorScheme}
          />
        }
        renderItem={({ item }) => (
          <PressableCard
            onPress={() => onSelect(item)}
            style={styles.card}
            colorScheme={colorScheme}
          >
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Wand2 size={16} color={tk.brandAccent.deep} strokeWidth={2} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.rating}>★ {item.rating.toFixed(1)}</Text>
              <Text style={styles.meta}>
                {item.ratingCount > 0
                  ? t('skillsMarket.ratingCount', { count: item.ratingCount })
                  : t('skillsMarket.noRatings')}
              </Text>
              <Download size={12} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.meta}>
                {t('skillsMarket.installs', { count: item.installCount })}
              </Text>
            </View>
            {item.tags.length > 0 || item.author || item.version ? (
              <View style={styles.footRow}>
                {item.tags.slice(0, 3).map((tg) => (
                  <View key={tg} style={styles.tagPill}>
                    <Text style={styles.tagPillText}>{tg}</Text>
                  </View>
                ))}
                {item.author ? (
                  <Text style={styles.foot} numberOfLines={1}>
                    {item.author}
                  </Text>
                ) : null}
                {item.version ? <Text style={styles.foot}>v{item.version}</Text> : null}
              </View>
            ) : null}
          </PressableCard>
        )}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pager}>
              <TouchableOpacity
                style={[styles.pagerBtn, page <= 1 ? styles.pagerBtnDisabled : null]}
                onPress={() => onPageChange(page - 1)}
                disabled={page <= 1}
                accessibilityRole="button"
              >
                <Text style={styles.pagerText}>{t('skillsMarket.prevPage')}</Text>
              </TouchableOpacity>
              <Text style={styles.pagerInfo}>
                {t('skillsMarket.pageIndicator', { page, total: totalPages })}
              </Text>
              <TouchableOpacity
                style={[styles.pagerBtn, page >= totalPages ? styles.pagerBtnDisabled : null]}
                onPress={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                accessibilityRole="button"
              >
                <Text style={styles.pagerText}>{t('skillsMarket.nextPage')}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    head: {
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing.sm,
    },
    titleRow: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    /* 标题让位给徽章:长标题先截断,计数恒完整 */
    title: {
      flexShrink: 1,
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    countBadge: {
      flexShrink: 0,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 1,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brandAccent.light,
    },
    countText: {
      fontSize: rnType.caption.size,
      color: tk.brandAccent.deep,
    },
    subtitle: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.caption.size,
      lineHeight: 17,
      color: tk.text.tertiary,
    },
    searchRow: {
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    input: {
      flex: 1,
      height: 44,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      paddingHorizontal: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    searchBtn: {
      height: 44,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    tagRow: {
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.xs,
      alignItems: 'center',
    },
    tagChip: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 3,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    tagChipActive: {
      borderColor: tk.brandAccent.deep,
      backgroundColor: tk.brandAccent.light,
    },
    tagText: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    tagTextActive: {
      /* 选中底改浅档后文字必须跟着换:brand.foreground 是墨底反色(亮模式白字),
         落在浅蓝底上等于看不见 —— 与同批 statusChipTextActive 同档(墨色文字 + 加粗) */
      color: tk.text.primary,
      fontWeight: '600',
    },
    listContent: {
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
    },
    card: {
      marginTop: rnSpacing.sm,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
    },
    cardIcon: {
      width: 28,
      height: 28,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brandAccent.light,
    },
    cardTitle: {
      flexShrink: 1,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    cardDesc: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.label.size,
      lineHeight: 18,
      color: tk.text.secondary,
    },
    metaRow: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: rnSpacing.xs,
    },
    rating: {
      fontSize: rnType.caption.size,
      color: tk.warning.DEFAULT,
    },
    meta: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    footRow: {
      marginTop: rnSpacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: rnSpacing.xs,
    },
    tagPill: {
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    tagPillText: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    foot: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    pager: {
      marginTop: rnSpacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.md,
    },
    pagerBtn: {
      minHeight: 36,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pagerBtnDisabled: {
      opacity: 0.4,
    },
    pagerText: {
      fontSize: rnType.label.size,
      color: tk.text.primary,
    },
    pagerInfo: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
