// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  AlertTriangle,
  FileText,
  FolderOpen,
  MessageSquare,
  Tag,
  User,
  FileCode,
} from 'lucide-react-native'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { createTagsStyles } from './tags-styles'
import type { TagCloudItem } from './TagsScreen'

export interface TagDetailResourceItem {
  id: string
  resourceType: string
  resourceId: string
  createdAt: string
}

export interface TagDetailScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading?: boolean
  error?: string | null
  /** null = 已加载但标签不存在(web PageClient.tsx:105-119 notFound 分支的 RN 等价)。 */
  tag?: TagCloudItem | null
  resources?: TagDetailResourceItem[] | null
  resourcesLoading?: boolean
  onRefresh?: () => void
}

/** 资源类型 → 分组标签键(与 web PageClient.tsx GROUP_KEY :55-61 同源,未知类型回退 groupOther)。 */
const GROUP_LABEL_KEYS: Record<string, string> = {
  project: 'tagsPage.groupProject',
  file: 'tagsPage.groupFile',
  doc: 'tagsPage.groupDoc',
  post: 'tagsPage.groupPost',
  comment: 'tagsPage.groupComment',
}

/** 资源类型 → 图标(与 web RESOURCE_ICON :40-47 同集)。 */
const RESOURCE_ICON: Record<string, typeof FileText> = {
  project: FolderOpen,
  file: FileText,
  doc: FileCode,
  post: FileText,
  comment: MessageSquare,
  user: User,
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function TagDetailScreen({
  t,
  onBack,
  colorScheme = 'light',
  loading = false,
  error = null,
  tag = null,
  resources,
  resourcesLoading = false,
  onRefresh,
}: TagDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createTagsStyles(tk), [tk])

  const list = resources ?? []

  // 按 resourceType 分组,保持后端 createdAt 倒序的首现顺序(与 web :85-93 Map 分组同口径)。
  const groups = useMemo(() => {
    const map = new Map<string, TagDetailResourceItem[]>()
    for (const r of list) {
      const arr = map.get(r.resourceType) ?? []
      arr.push(r)
      map.set(r.resourceType, arr)
    }
    return Array.from(map.entries())
  }, [list])

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('tagsPage.backToList')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle}>{tag ? tag.name : t('tagsPage.title')}</Text>
    </View>
  )

  if (error && !loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.card, styles.errorBox]}>
          <AlertTriangle size={28} color={tk.error.text} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
          {onRefresh ? <Text style={styles.emptyText}>{t('tagsPage.refresh')}</Text> : null}
        </View>
      </View>
    )
  }

  if (loading && !tag) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.skeletonTitle} />
          <View style={styles.card}>
            <View style={styles.skeletonRow} />
          </View>
        </ScrollView>
      </View>
    )
  }

  if (!tag) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.card, styles.emptyBox]}>
          <Tag size={40} color={tk.text.tertiary} strokeWidth={2} />
          <Text style={styles.emptyText}>{t('tagsPage.notFound')}</Text>
          <Text style={styles.metaLine}>{t('tagsPage.backToList')}</Text>
        </View>
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
          <Text style={styles.heroTitle}>{tag.name}</Text>
          <Text style={styles.heroSubtitle}>
            {t('tagsPage.resourceCount', { count: list.length })} ·{' '}
            {t('tagsPage.usageCount', { count: tag.usageCount })}
          </Text>
          {tag.description ? <Text style={styles.descText}>{tag.description}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('tagsPage.resourcesTitle')}</Text>
          {resourcesLoading ? (
            <View style={styles.skeletonRow} />
          ) : list.length === 0 ? (
            <Text style={styles.emptyText}>{t('tagsPage.emptyResources')}</Text>
          ) : (
            groups.map(([type, items]) => {
              const Icon = RESOURCE_ICON[type] ?? FileText
              return (
                <View key={type} style={{ gap: 2 }}>
                  <View style={styles.groupHead}>
                    <Icon size={14} color={tk.text.tertiary} strokeWidth={2} />
                    <Text style={styles.groupLabel}>
                      {t(GROUP_LABEL_KEYS[type] ?? 'tagsPage.groupOther')}
                    </Text>
                    <Text style={styles.groupCount}>({items.length})</Text>
                  </View>
                  <View style={[styles.resourceList, styles.card]}>
                    {items.map((r) => (
                      <View key={r.id} style={styles.resourceRow}>
                        <Icon size={16} color={tk.text.tertiary} strokeWidth={2} />
                        <Text style={styles.resourceId} numberOfLines={1}>
                          {r.resourceId.slice(0, 8)}
                        </Text>
                        <Text style={styles.resourceDate}>{formatDate(r.createdAt)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )
            })
          )}
        </View>
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
