// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { MemoryEntry, MemoryEntryType, MemoryScope } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

/** MemoryScreen props(注入式:wrapper 保留 fetchApi/Alert/导航/登录态) */
export interface MemoryScreenProps {
  t: TFunction
  /** 登录态:false 时渲染「请先登录」提示(对齐原屏 user 空判断) */
  loggedIn: boolean
  /** 已由 wrapper 按 scope 服务端参数拉取、type/关键词前端过滤后的条目 */
  entries: MemoryEntry[]
  loading: boolean
  refreshing: boolean
  /** 加载失败文案(非空渲染错误态 + 重试) */
  error: string
  deleting: boolean
  /** 新建记忆提交中 */
  saving: boolean
  search: string
  onSearchChange: (text: string) => void
  scopeFilter: MemoryScope | null
  onScopeFilterChange: (scope: MemoryScope | null) => void
  typeFilter: MemoryEntryType | null
  onTypeFilterChange: (type: MemoryEntryType | null) => void
  /** 当前展开的条目 id(内容超 3 行时展开/收起) */
  expandedId: string | null
  onToggleExpand: (id: string) => void
  createVisible: boolean
  onOpenCreate: () => void
  onCloseCreate: () => void
  newText: string
  onNewTextChange: (text: string) => void
  newCategory: string
  onNewCategoryChange: (category: string) => void
  newType: MemoryEntryType
  onNewTypeChange: (type: MemoryEntryType) => void
  newScope: MemoryScope
  onNewScopeChange: (scope: MemoryScope) => void
  /** 提交新建记忆(必填校验与 Alert 由 wrapper 处理) */
  onCreateSubmit: () => void
  /** 删除记忆(确认 Alert 由 wrapper 处理) */
  onDelete: (entry: MemoryEntry) => void
  /** 下拉刷新 */
  onRefresh: () => void
  /** 错误态重试 */
  onRetry: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

const SCOPE_KEYS: Record<MemoryScope, string> = {
  global: 'memory.scope.global',
  user: 'memory.scope.user',
  session: 'memory.scope.session',
  project: 'memory.scope.project',
}

const TYPE_KEYS: Record<MemoryEntryType, string> = {
  preference: 'memory.type.preference',
  convention: 'memory.type.convention',
  decision: 'memory.type.decision',
  fact: 'memory.type.fact',
  feedback: 'memory.type.feedback',
  skill_ref: 'memory.type.skill_ref',
}

const SCOPES: readonly MemoryScope[] = ['global', 'user', 'session', 'project']
const TYPES: readonly MemoryEntryType[] = [
  'preference',
  'convention',
  'decision',
  'fact',
  'feedback',
  'skill_ref',
]

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatTime(iso: string): string {
  try {
    return timeFormatter.format(new Date(iso))
  } catch {
    return iso
  }
}

/**
 * MemoryScreen 我的记忆(共享层) — props 注入式跨端组件
 *
 * 2026-09-15 承接 mobile-rn MemoryScreen(M3 补齐:web /memory 移动端入口)1:1 迁移:
 * - 结构:头部(返回/标题/新建)→ 搜索框 → scope/type 筛选 chips → 记忆条目列表
 *   (分类 + 类型/作用域徽章 + 内容展开收起 + 来源/时间 + 删除)→ 新建记忆底部弹层
 * - 平台无关:API(fetchApi /api/memory*)、导航、Alert、登录态由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex)
 * - i18n:沿用 memory. 与 common. 命名空间既有 key(mobile-rn i18n)
 */
export function MemoryScreen({
  t,
  loggedIn,
  entries,
  loading,
  refreshing,
  error,
  deleting,
  saving,
  search,
  onSearchChange,
  scopeFilter,
  onScopeFilterChange,
  typeFilter,
  onTypeFilterChange,
  expandedId,
  onToggleExpand,
  createVisible,
  onOpenCreate,
  onCloseCreate,
  newText,
  onNewTextChange,
  newCategory,
  onNewCategoryChange,
  newType,
  onNewTypeChange,
  newScope,
  onNewScopeChange,
  onCreateSubmit,
  onDelete,
  onRefresh,
  onRetry,
  onBack,
  colorScheme = 'light',
}: MemoryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const renderEntry = ({ item }: { item: MemoryEntry }) => {
    const expanded = expandedId === item.id
    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => onToggleExpand(item.id)}>
          <View style={styles.entryHeadRow}>
            <Text style={styles.categoryText} numberOfLines={1}>
              {item.category}
            </Text>
            <View style={styles.miniTag}>
              <Text style={styles.miniTagText}>{t(TYPE_KEYS[item.type])}</Text>
            </View>
            <View style={styles.miniTag}>
              <Text style={styles.miniTagText}>{t(SCOPE_KEYS[item.scope])}</Text>
            </View>
          </View>
          <Text style={styles.entryText} numberOfLines={expanded ? undefined : 3}>
            {item.text}
          </Text>
          <Text style={styles.metaText}>
            {t('memory.source')}: {item.source} · {t('memory.updatedAt')}:{' '}
            {formatTime(item.updatedAt)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(item)}
          disabled={deleting}
        >
          <Text style={styles.deleteText}>{t('memory.delete')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.mutedText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (!loggedIn) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.mutedText}>{t('memory.loginRequired')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('memory.title')}</Text>
        <TouchableOpacity onPress={onOpenCreate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.createText}>{t('memory.create')}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View style={styles.filterHeader}>
              {/* 搜索 */}
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={onSearchChange}
                placeholder={t('memory.searchPlaceholder')}
                placeholderTextColor={tk.text.tertiary}
                returnKeyType="search"
              />
              {/* scope chips */}
              <View style={styles.chipsRow}>
                <FilterChip
                  label={t('memory.all')}
                  active={scopeFilter === null}
                  styles={styles}
                  onPress={() => onScopeFilterChange(null)}
                />
                {SCOPES.map((scope) => (
                  <FilterChip
                    key={scope}
                    label={t(SCOPE_KEYS[scope])}
                    active={scopeFilter === scope}
                    styles={styles}
                    onPress={() => onScopeFilterChange(scopeFilter === scope ? null : scope)}
                  />
                ))}
              </View>
              {/* type chips */}
              <View style={styles.chipsRow}>
                <FilterChip
                  label={t('memory.all')}
                  active={typeFilter === null}
                  styles={styles}
                  onPress={() => onTypeFilterChange(null)}
                />
                {TYPES.map((type) => (
                  <FilterChip
                    key={type}
                    label={t(TYPE_KEYS[type])}
                    active={typeFilter === type}
                    styles={styles}
                    onPress={() => onTypeFilterChange(typeFilter === type ? null : type)}
                  />
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('memory.empty')}</Text>
              <Text style={styles.emptyHint}>{t('memory.emptyHint')}</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          renderItem={renderEntry}
        />
      )}

      {/* 新建记忆 Modal */}
      <Modal visible={createVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>{t('memory.createTitle')}</Text>
              <TouchableOpacity
                onPress={onCloseCreate}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.textInput}
              value={newText}
              onChangeText={onNewTextChange}
              placeholder={t('memory.textPlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TextInput
              style={styles.categoryInput}
              value={newCategory}
              onChangeText={onNewCategoryChange}
              placeholder={t('memory.categoryPlaceholder')}
              placeholderTextColor={tk.text.tertiary}
            />
            <Text style={styles.fieldLabel}>{t('memory.typeLabel')}</Text>
            <View style={styles.chipsRowTight}>
              {TYPES.map((type) => (
                <FilterChip
                  key={type}
                  label={t(TYPE_KEYS[type])}
                  active={newType === type}
                  styles={styles}
                  onPress={() => onNewTypeChange(type)}
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>{t('memory.scopeLabel')}</Text>
            <View style={styles.chipsRowTight}>
              {SCOPES.map((scope) => (
                <FilterChip
                  key={scope}
                  label={t(SCOPE_KEYS[scope])}
                  active={newScope === scope}
                  styles={styles}
                  onPress={() => onNewScopeChange(scope)}
                />
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={onCreateSubmit} disabled={saving}>
              <Text style={styles.saveBtnText}>
                {saving ? t('common.loading') : t('memory.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── 私有:筛选 chip(全部/scope/type 筛选与新建表单共用) ──

function FilterChip({
  label,
  active,
  styles,
  onPress,
}: {
  label: string
  active: boolean
  styles: ReturnType<typeof createStyles>
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      onPress={onPress}
    >
      <Text style={active ? styles.chipTextActive : styles.chipTextInactive}>{label}</Text>
    </TouchableOpacity>
  )
}

/**
 * 样式:颜色全部走 AppThemeTokens 语义 token,零 hex(共享层惯例)。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mutedText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    /* 头部(返回/标题/新建) */
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16, // px-4
      paddingTop: 12, // pt-3
      paddingBottom: 8, // pb-2
    },
    backText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
    },
    createText: {
      fontSize: 14,
      fontWeight: '500',
      color: tk.brand.DEFAULT,
    },
    /* 错误态 */
    errorWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    errorText: {
      marginBottom: 12,
      textAlign: 'center',
      fontSize: 14,
      color: tk.text.secondary,
    },
    retryBtn: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    retryText: {
      fontSize: 14,
      color: tk.text.primary,
    },
    listContent: {
      padding: 16,
    },
    filterHeader: {
      marginBottom: 12,
    },
    searchInput: {
      height: 36, // h-9
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
    },
    chipsRow: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chipsRowTight: {
      marginTop: 6, // mt-1.5
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderRadius: rnRadius.md,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipActive: {
      backgroundColor: tk.brand.DEFAULT,
    },
    chipInactive: {
      backgroundColor: tk.surface.muted,
    },
    chipTextActive: {
      fontSize: 12,
      color: tk.surface.light,
    },
    chipTextInactive: {
      fontSize: 12,
      color: tk.text.secondary,
    },
    /* 记忆条目卡片 */
    card: {
      marginBottom: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: 16,
    },
    entryHeadRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    categoryText: {
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
    },
    miniTag: {
      borderRadius: rnRadius.xs,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    miniTagText: {
      fontSize: 10,
      color: tk.text.secondary,
    },
    entryText: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 19,
      color: tk.text.secondary,
    },
    metaText: {
      marginTop: 8,
      fontSize: 11,
      color: tk.text.tertiary,
    },
    deleteBtn: {
      marginTop: 8,
      alignSelf: 'flex-start',
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.danger.light,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    deleteText: {
      fontSize: 12,
      color: tk.danger.DEFAULT,
    },
    /* 空态 */
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    emptyHint: {
      marginTop: 4,
      fontSize: 12,
      color: tk.text.tertiary,
    },
    /* 新建记忆弹层 */
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: tk.overlay.modal,
    },
    sheet: {
      borderTopLeftRadius: rnRadius['2xl'],
      borderTopRightRadius: rnRadius['2xl'],
      backgroundColor: tk.surface.card,
      padding: 16,
    },
    sheetHeaderRow: {
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
    },
    cancelText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    textInput: {
      minHeight: 96,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      padding: 12,
      fontSize: 14,
      color: tk.text.primary,
      textAlignVertical: 'top',
    },
    categoryInput: {
      marginTop: 8,
      height: 36,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
    },
    fieldLabel: {
      marginTop: 12,
      fontSize: 12,
      color: tk.text.secondary,
    },
    saveBtn: {
      marginTop: 16,
      alignItems: 'center',
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.DEFAULT,
      paddingVertical: 12,
    },
    saveBtnText: {
      fontSize: 14,
      fontWeight: '500',
      color: tk.surface.light,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
