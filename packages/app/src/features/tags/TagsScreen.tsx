// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { AlertTriangle, Hash, Tag } from 'lucide-react-native'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { withAlpha } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import {
  TAG_CHIP_COLORS,
  createTagsStyles,
  tagChipColorAt,
  tagCloudColorAt,
  tagFontTierAt,
} from './tags-styles'

export interface TagCloudItem {
  id: string
  slug: string
  name: string
  usageCount: number
  description?: string | null
}

export interface TagsScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  error?: string | null
  tags?: TagCloudItem[]
  /** 点击标签云词条 / 热门 chip → 跳标签详情(web 侧为 <Link href={`/tags/${slug}`> 的 RN 等价回调)。 */
  onTagPress: (slug: string) => void
  onRefresh?: () => void
}

/** 热门标签渲染上限(与 web :104 slice(0, 5) 同档)。 */
const POPULAR_LIMIT = 5

export function TagsScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  error = null,
  tags,
  onTagPress,
  onRefresh,
}: TagsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createTagsStyles(tk), [tk])

  const list = tags ?? []
  // 与 web :46-52 同口径:max=Math.max(1,...counts),min=Math.min(max,...counts);
  // max===min 时 web 回退 16px ⇒ RN 取 title 档(索引 2),否则按归一占比映射到 rnType 档位。
  const { min, max } = useMemo(() => {
    const counts = list.map((x) => x.usageCount)
    const m = Math.max(1, ...counts)
    return { max: m, min: Math.min(m, ...counts) }
  }, [list])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{t('tagsPage.title')}</Text>
    </View>
  )

  if (error && !loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.card, styles.errorBox]}>
          <AlertTriangle size={28} color={tk.error.text} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
          {onRefresh ? (
            <TouchableOpacity
              style={styles.refreshBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('tagsPage.refresh')}
              onPress={onRefresh}
            >
              <Text style={styles.refreshText}>{t('tagsPage.refresh')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    )
  }

  if (loading && !tags) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.skeletonTitle} />
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
          </View>
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
            />
          ) : undefined
        }
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('tagsPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('tagsPage.subtitle')}</Text>
        </View>

        {list.length === 0 ? (
          <View style={[styles.card, styles.emptyBox]}>
            <Tag size={32} color={tk.text.tertiary} strokeWidth={2} />
            <Text style={styles.emptyText}>{t('tagsPage.empty')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cloudRow}>
                {list.map((tag, i) => {
                  const ratio = max === min ? null : (tag.usageCount - min) / (max - min)
                  const tier = tagFontTierAt(ratio)
                  const color = tagCloudColorAt(i)
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${tag.name} · ${t('tagsPage.usageCount', {
                        count: tag.usageCount,
                      })}`}
                      activeOpacity={0.7}
                      onPress={() => onTagPress(tag.slug)}
                    >
                      <View style={styles.tagLink}>
                        <Tag size={tier.size * 0.7} color={color} strokeWidth={2} />
                        <Text
                          style={{
                            fontSize: tier.size,
                            lineHeight: tier.lineHeight,
                            fontWeight: '500',
                            color,
                          }}
                        >
                          {tag.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text
                style={[styles.cardTitle, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
              >
                <Hash size={16} color={TAG_CHIP_COLORS[0]} strokeWidth={2} />
                {t('tagsPage.popular')}
              </Text>
              <View style={styles.popularRow}>
                {list.slice(0, POPULAR_LIMIT).map((tag, i) => {
                  const color = tagChipColorAt(i)
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${tag.name} · ${t('tagsPage.usageCount', {
                        count: tag.usageCount,
                      })}`}
                      activeOpacity={0.8}
                      onPress={() => onTagPress(tag.slug)}
                      style={[styles.popularChip, { backgroundColor: withAlpha(color, 0.12) }]}
                    >
                      <Text style={[styles.popularChipText, { color }]}>{tag.name}</Text>
                      <Text style={[styles.popularChipCount, { color }]}>{tag.usageCount}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
