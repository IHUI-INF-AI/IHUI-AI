// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { CategoryInlineBar } from '../../components/category/CategoryInlineBar'
import type {
  TeamMemberStatus,
  TeamRelation,
  TeamTab,
  TeamStats,
  TeamMember,
  TeamTreeNode,
  TeamScreenProps,
  TFunction,
} from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

export type {
  TeamMemberStatus,
  TeamRelation,
  TeamTab,
  TeamStats,
  TeamMember,
  TeamTreeNode,
  TeamScreenProps,
}

const TAB_KEYS: TeamTab[] = ['all', 'direct', 'indirect']

const TAB_LABELS: Record<TeamTab, string> = {
  all: 'team.tab_all',
  direct: 'team.tab_direct',
  indirect: 'team.tab_indirect',
}

const STATUS_LABELS: Record<TeamMemberStatus, string> = {
  active: 'team.status_active',
  inactive: 'team.status_inactive',
}

function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

/**
 * 团队共享屏 — props 注入式跨端组件
 *
 * 平台无关:渲染 header + 统计卡片 + tabs + 成员 FlatList(下拉刷新)。
 * 平台特定(导航 / API 调用 / 日期格式化)由 wrapper 通过 props 注入。
 */
export function TeamScreen({
  t,
  stats,
  members,
  activeTab,
  loading,
  refreshing,
  error,
  onSelectTab,
  onRefresh,
  onBack,
  onPressMember,
  keyword,
  onKeywordChange,
  tree,
  treeLoading,
  treeFailed,
  treeTotalLevels,
  onRetryTree,
  onPressTreeMember,
  colorScheme = 'light',
}: TeamScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const tabItems = useMemo(() => TAB_KEYS.map((k) => ({ id: k, label: t(TAB_LABELS[k]) })), [t])
  // 树区块仅在 wrapper 提供数据源/加载/失败信号时出现;未登录时 wrapper 全部不传 ⇒ 不渲染
  const showTree = tree !== undefined || treeLoading === true || treeFailed === true

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && !stats) {
    return (
      <View style={styles.container}>
        <ErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel={t('team.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  // 搜索过滤(对齐 Uniapp InputArea「搜索我的团友」handleSearch:昵称关键字过滤)
  const kw = keyword?.trim().toLowerCase() ?? ''
  const filtered = (
    activeTab === 'all' ? members : members.filter((m) => m.relation === activeTab)
  ).filter((m) => !kw || m.nickname.toLowerCase().includes(kw))

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron
          onPress={onBack}
          label={t('common.back')}
          colorScheme={colorScheme}
          style={styles.backBtn}
        />
        <Text style={styles.title}>{t('team.title')}</Text>
        <Text style={styles.subtitle}>{t('team.subtitle')}</Text>
      </View>

      {stats ? (
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalMembers}</Text>
              <Text style={styles.statLabel}>{t('team.totalMembers')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.activeMembers}</Text>
              <Text style={styles.statLabel}>{t('team.activeMembers')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.directCount}</Text>
              <Text style={styles.statLabel}>{t('team.directCount')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.indirectCount}</Text>
              <Text style={styles.statLabel}>{t('team.indirectCount')}</Text>
            </View>
          </View>
          <View style={styles.contributionBox}>
            <Text style={styles.contributionLabel}>{t('team.totalContribution')}</Text>
            <Text style={styles.contributionValue}>¥{stats.totalContribution}</Text>
          </View>
        </View>
      ) : null}

      <CategoryInlineBar
        items={tabItems}
        selectedId={activeTab}
        onSelect={(id) => onSelectTab(id as TeamTab)}
        colorScheme={colorScheme}
        contentPaddingHorizontal={10}
        itemGap={6}
      />

      {/* 搜索框(对齐 Uniapp distribution_personnel_list InputArea「搜索我的团友」;未注入回调则不渲染) */}
      {onKeywordChange ? (
        <View style={styles.searchRow}>
          <TextField
            colorScheme={colorScheme}
            value={keyword ?? ''}
            onChangeText={onKeywordChange}
            placeholder={t('team.searchPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList<TeamMember>
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          showTree ? (
            <TeamTreeSection
              t={t}
              styles={styles}
              tree={tree}
              treeLoading={treeLoading}
              treeFailed={treeFailed}
              treeTotalLevels={treeTotalLevels}
              onRetryTree={onRetryTree}
              onPressTreeMember={onPressTreeMember}
            />
          ) : null
        }
        ListEmptyComponent={<EmptyState title={t('team.empty')} colorScheme={colorScheme} />}
        renderItem={({ item }) => (
          <PressableCard
            style={styles.card}
            onPress={() => onPressMember?.(item.id)}
            colorScheme={colorScheme}
          >
            <View style={styles.avatarBox}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>{initials(item.nickname)}</Text>
              )}
            </View>
            <View style={styles.memberInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {item.nickname}
                </Text>
                <View
                  style={[
                    styles.relationBadge,
                    item.relation === 'direct' && styles.relationDirect,
                  ]}
                >
                  <Text style={styles.relationText}>{t(TAB_LABELS[item.relation])}</Text>
                </View>
              </View>
              <Text style={styles.memberMeta}>
                {t('team.joinDate')}: {item.joinDate}
              </Text>
              <Text style={styles.memberMeta}>
                {t('team.level')}: L{item.level}
              </Text>
            </View>
            <View style={styles.memberRight}>
              <Text style={styles.contributionText}>+¥{item.contribution}</Text>
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'active' ? styles.statusActive : styles.statusInactive,
                ]}
              >
                <Text style={styles.statusText}>{t(STATUS_LABELS[item.status])}</Text>
              </View>
            </View>
          </PressableCard>
        )}
      />
    </View>
  )
}

/** 分销层级树最多渲染 3 层(与后端 /distribution/tree 递归深度一致) */
const MAX_TREE_LEVELS = 3

type TeamScreenStyles = ReturnType<typeof createStyles>

interface TeamTreeSectionProps {
  t: TFunction
  styles: TeamScreenStyles
  tree?: TeamTreeNode[]
  treeLoading?: boolean
  treeFailed?: boolean
  treeTotalLevels?: number
  onRetryTree?: () => void
  onPressTreeMember?: (memberId: string) => void
}

/** 层级树区块:标题 + 加载/失败/空态 + 递归节点(失败态独立,不影响统计区与成员列表) */
function TeamTreeSection({
  t,
  styles,
  tree,
  treeLoading,
  treeFailed,
  treeTotalLevels,
  onRetryTree,
  onPressTreeMember,
}: TeamTreeSectionProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  const nodes = tree ?? []
  const toggle = (id: string) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <View style={styles.treeSection}>
      <View style={styles.treeHeader}>
        <Text style={styles.treeTitle}>{t('distribution.treeTitle')}</Text>
        {treeTotalLevels && treeTotalLevels > 0 ? (
          <Text style={styles.treeMeta}>
            {t('distribution.treeLevelLabel', { level: treeTotalLevels })}
          </Text>
        ) : null}
      </View>

      {treeLoading ? (
        <ActivityIndicator size="small" color={styles.treeMeta.color} />
      ) : treeFailed ? (
        <View style={styles.treeStateRow}>
          <Text style={styles.treeError}>{t('distribution.treeLoadFailed')}</Text>
          {onRetryTree ? (
            <Pressable
              onPress={onRetryTree}
              accessibilityRole="button"
              style={({ pressed }) => [styles.treeRetryBtn, pressed && styles.treeRetryBtnPressed]}
            >
              <Text style={styles.treeRetryText}>{t('distribution.treeRetry')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : nodes.length === 0 ? (
        <Text style={styles.treeEmpty}>{t('distribution.treeEmpty')}</Text>
      ) : (
        nodes.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            t={t}
            styles={styles}
            collapsedIds={collapsedIds}
            onToggle={toggle}
            onPressNode={onPressTreeMember}
          />
        ))
      )}
    </View>
  )
}

interface TreeNodeRowProps {
  node: TeamTreeNode
  depth: number
  t: TFunction
  styles: TeamScreenStyles
  collapsedIds: Set<string>
  onToggle: (id: string) => void
  onPressNode?: (memberId: string) => void
}

/** 单行树节点:按 level 缩进;无 children 或已达 3 层不显示展开箭头;未注入点击回调则不可点击 */
function TreeNodeRow({
  node,
  depth,
  t,
  styles,
  collapsedIds,
  onToggle,
  onPressNode,
}: TreeNodeRowProps) {
  const children = node.children ?? []
  const canExpand = children.length > 0 && depth + 1 < MAX_TREE_LEVELS
  const expanded = canExpand && !collapsedIds.has(node.id)
  const level = node.level > 0 ? node.level : depth + 1
  const displayName = node.nickname || node.username || '?'
  const indent = (Math.min(level, MAX_TREE_LEVELS) - 1) * rnSpacing.md

  return (
    <View>
      <View style={[styles.treeRow, { marginLeft: indent }]}>
        {canExpand ? (
          <Pressable
            onPress={() => onToggle(node.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityHint={t('distribution.treeCollapseHint')}
            style={styles.treeArrow}
          >
            <Text style={styles.treeArrowText}>{expanded ? '▾' : '▸'}</Text>
          </Pressable>
        ) : (
          <View style={styles.treeArrowSpacer} />
        )}
        <Pressable
          style={styles.treeNodeBody}
          onPress={onPressNode ? () => onPressNode(node.id) : undefined}
          disabled={!onPressNode}
          accessibilityRole={onPressNode ? 'button' : undefined}
        >
          <View style={styles.treeAvatar}>
            {node.avatar ? (
              <Image source={{ uri: node.avatar }} style={styles.treeAvatarImg} />
            ) : (
              <Text style={styles.treeAvatarInitial}>{initials(displayName)}</Text>
            )}
          </View>
          <View style={styles.treeNameBox}>
            <Text style={styles.treeName} numberOfLines={1}>
              {displayName}
            </Text>
            {node.username && node.username !== displayName ? (
              <Text style={styles.treeUsername} numberOfLines={1}>
                @{node.username}
              </Text>
            ) : null}
          </View>
          <View style={styles.treeLevelBadge}>
            <Text style={styles.treeLevelText}>{t('distribution.treeLevelLabel', { level })}</Text>
          </View>
        </Pressable>
      </View>
      {expanded
        ? children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              t={t}
              styles={styles}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              onPressNode={onPressNode}
            />
          ))
        : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    errorText: { fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    header: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing.sm },
    backBtn: { marginBottom: rnSpacing.sm },
    title: { fontSize: rnType.display.size, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    statsCard: {
      marginHorizontal: rnSpacing['sm-loose'],
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      backgroundColor: tk.success.light,
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
    statItem: { alignItems: 'center', flex: 1, minWidth: 64 },
    statValue: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.success.DEFAULT },
    statLabel: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.badge.size,
      color: tk.success.deepText,
      textAlign: 'center',
    },
    contributionBox: {
      marginTop: rnSpacing.md,
      paddingVertical: rnSpacing['sm-loose'],
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.bg,
      alignItems: 'center',
    },
    contributionLabel: { fontSize: rnType.caption.size, color: tk.text.secondary },
    contributionValue: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.success.DEFAULT,
    },
    searchRow: { paddingHorizontal: rnSpacing['sm-loose'], paddingBottom: rnSpacing.sm },
    searchInput: {
      height: 40,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      paddingHorizontal: rnSpacing.md,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    errorBar: { paddingHorizontal: rnSpacing['sm-loose'], paddingVertical: rnSpacing.sm },
    listBody: { padding: rnSpacing['md-loose'], paddingBottom: rnSpacing['3xl'] },
    separator: { height: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    avatarBox: {
      width: 44,
      height: 44,
      borderRadius: rnRadius['2xl'],
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: '100%', height: '100%', borderRadius: rnRadius['2xl'] }, // 跟随见方父容器:相对式即几何真圆(不需要标记)
    avatarInitial: { fontSize: rnType.subtitle.size, fontWeight: '600', color: tk.text.secondary },
    memberInfo: { flex: 1, marginLeft: rnSpacing['sm-loose'], marginRight: rnSpacing.sm },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['xs-loose'] },
    memberName: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary, flex: 1 },
    relationBadge: {
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.card,
    },
    relationDirect: { backgroundColor: tk.success.light },
    relationText: { fontSize: rnType.badge.size, color: tk.text.secondary },
    memberMeta: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.tertiary },
    memberRight: { alignItems: 'flex-end' },
    contributionText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.success.DEFAULT },
    statusBadge: {
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: 1,
      borderRadius: rnRadius.md,
    },
    statusActive: { backgroundColor: tk.success.light },
    statusInactive: { backgroundColor: tk.surface.card },
    statusText: { fontSize: rnType.badge.size, color: tk.text.secondary },
    treeSection: {
      marginBottom: rnSpacing.lg,
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    treeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rnSpacing.sm,
    },
    treeTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    treeMeta: { fontSize: rnType.caption.size, color: tk.text.secondary },
    treeStateRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    treeEmpty: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    treeError: { flex: 1, fontSize: rnType.caption.size, color: tk.danger.DEFAULT },
    treeRetryBtn: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.success.light,
    },
    treeRetryBtnPressed: { opacity: 0.7 },
    treeRetryText: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.success.DEFAULT },
    treeRow: { flexDirection: 'row', alignItems: 'center', marginTop: rnSpacing.xs },
    treeArrow: { width: 20, alignItems: 'center' },
    treeArrowSpacer: { width: 20 },
    treeArrowText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    treeNodeBody: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    treeAvatar: {
      width: 28,
      height: 28,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    treeAvatarImg: { width: '100%', height: '100%', borderRadius: rnRadius.md },
    treeAvatarInitial: {
      fontSize: rnType.caption.size,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    treeNameBox: { flex: 1, marginLeft: rnSpacing.sm, marginRight: rnSpacing.sm },
    treeName: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    treeUsername: { marginTop: 1, fontSize: rnType.badge.size, color: tk.text.tertiary },
    treeLevelBadge: {
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: 1,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.bg,
    },
    treeLevelText: { fontSize: rnType.badge.size, color: tk.text.secondary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
