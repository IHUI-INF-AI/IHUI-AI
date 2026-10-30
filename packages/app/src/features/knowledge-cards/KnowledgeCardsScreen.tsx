// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  Bookmark,
  Check,
  Eye,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState } from '../../components/ScreenStates'

const NS = 'knowledgeCardsPage'

/** 卡片类型 —— 与 @ihui/api-client KnowledgeCardKind 同值域(共享层不引端点包,避免跨包依赖) */
export type KnowledgeCardKindView = 'experience' | 'fact' | 'practices' | 'pitfall'

export const KNOWLEDGE_CARD_KIND_VALUES: KnowledgeCardKindView[] = [
  'experience',
  'fact',
  'practices',
  'pitfall',
]

/** 列表行视图:所有文案(类型名/来源/次数/标签/时间)由薄壳用 t() + Intl 预格式化后注入 */
export interface KnowledgeCardRowView {
  id: string
  title: string
  /** t(kindExperience|kindFact|kindPractices|kindPitfall) */
  kindText: string
  /** source==='agent' 时 t(sourceAgent),否则空串 */
  sourceText: string
  /** t(useCount) + 计数 */
  useCountText: string
  /** 标签串(#a #b),空串则不渲染 */
  tagsText: string
  /** 薄壳按 locale 格式化的创建时间 */
  createdAtText: string
  /** 搜索结果携带的正文摘要,普通列表为空串 */
  contentPreview: string
}

/** 创建/编辑表单受控值(全部字符串,confidence 为输入框原值) */
export interface KnowledgeCardFormView {
  kind: KnowledgeCardKindView
  title: string
  content: string
  tags: string
  confidence: string
}

export type KnowledgeCardFormMode = 'create' | 'edit' | null

export interface KnowledgeCardsScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web 同口径:未登录不发注定 401 的查询) */
  loginRequiredText: string

  /** 仓库名(列表按仓库名查询) */
  repoName: string
  onRepoNameChange: (value: string) => void
  onLoad: () => void
  loading: boolean
  error: string | null
  rows: KnowledgeCardRowView[]

  /** 关键词检索 */
  searchQ: string
  onSearchQChange: (value: string) => void
  onSearch: () => void
  onClearSearch: () => void
  searching: boolean
  searchRows: KnowledgeCardRowView[] | null

  /** 创建/编辑表单 */
  onOpenCreate: () => void
  formMode: KnowledgeCardFormMode
  form: KnowledgeCardFormView
  onFormChange: (patch: Partial<KnowledgeCardFormView>) => void
  submitting: boolean
  onSubmit: () => void
  onCloseForm: () => void

  /** 详情(正文由薄壳取详情端点注入) */
  detailTitle: string | null
  detailContent: string | null
  loadingDetail: boolean
  onCloseDetail: () => void

  /** 行内操作(复用打点/删除/编辑取详情),busyId 命中时该行按钮禁用 */
  busyId: string | null
  onView: (id: string) => void
  onEdit: (id: string) => void
  onMarkUsed: (id: string) => void
  onDelete: (id: string) => void
}

/**
 * 知识卡片共享屏 —— 承载 web /knowledge-cards(仓库级经验/事实/实践/踩坑卡)。
 *
 * 数据面(证据见薄壳头注):GET /api/knowledge-cards?repoName=、GET /search、GET /:id、
 * POST /、PATCH /:id(markUsed=true 打点)、DELETE /:id。
 *
 * 平台无关:取数、登录态判定、Intl 时间格式化、删除二次确认、提示文案全部由薄壳注入;
 * 本文件只管渲染与三态(loading / error / empty)。web 的 MarkdownStream 正文在 RN 以纯文本
 * 呈现(移动端无同款 Markdown 流式渲染器),如实登记于 manifest ledger note。
 */
export function KnowledgeCardsScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  repoName,
  onRepoNameChange,
  onLoad,
  loading,
  error,
  rows,
  searchQ,
  onSearchQChange,
  onSearch,
  onClearSearch,
  searching,
  searchRows,
  onOpenCreate,
  formMode,
  form,
  onFormChange,
  submitting,
  onSubmit,
  onCloseForm,
  detailTitle,
  detailContent,
  loadingDetail,
  onCloseDetail,
  busyId,
  onView,
  onEdit,
  onMarkUsed,
  onDelete,
}: KnowledgeCardsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const kindLabel = (kind: KnowledgeCardKindView): string => {
    switch (kind) {
      case 'experience':
        return t(`${NS}.kindExperience`)
      case 'fact':
        return t(`${NS}.kindFact`)
      case 'practices':
        return t(`${NS}.kindPractices`)
      default:
        return t(`${NS}.kindPitfall`)
    }
  }

  const renderRow = (row: KnowledgeCardRowView) => (
    <View key={row.id} style={styles.card}>
      <View style={styles.rowTitleLine}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {row.title}
        </Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{row.kindText}</Text>
        </View>
        {row.sourceText ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{row.sourceText}</Text>
          </View>
        ) : null}
      </View>

      {row.contentPreview ? (
        <Text style={styles.rowPreview} numberOfLines={2}>
          {row.contentPreview}
        </Text>
      ) : null}

      <Text style={styles.rowMeta}>
        {row.useCountText}
        {row.tagsText ? ` · ${row.tagsText}` : ''}
        {row.createdAtText ? ` · ${row.createdAtText}` : ''}
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={() => onView(row.id)}
          disabled={busyId === row.id}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t(`${NS}.view`)}
        >
          <Eye size={14} color={tk.text.secondary} />
          <Text style={styles.actionText}>{t(`${NS}.view`)}</Text>
        </Pressable>
        <Pressable
          onPress={() => onEdit(row.id)}
          disabled={busyId === row.id}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t(`${NS}.edit`)}
        >
          <Pencil size={14} color={tk.text.secondary} />
          <Text style={styles.actionText}>{t(`${NS}.edit`)}</Text>
        </Pressable>
        <Pressable
          onPress={() => onMarkUsed(row.id)}
          disabled={busyId === row.id}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t(`${NS}.markUsed`)}
        >
          {busyId === row.id ? (
            <ActivityIndicator size="small" color={tk.text.secondary} />
          ) : (
            <Check size={14} color={tk.text.secondary} />
          )}
          <Text style={styles.actionText}>{t(`${NS}.markUsed`)}</Text>
        </Pressable>
        <Pressable
          onPress={() => onDelete(row.id)}
          disabled={busyId === row.id}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={t(`${NS}.delete`)}
        >
          <Trash2 size={14} color={tk.danger.DEFAULT} />
          <Text style={styles.actionTextDanger}>{t(`${NS}.delete`)}</Text>
        </Pressable>
      </View>
    </View>
  )

  const listBlock = (() => {
    if (searchRows !== null) {
      if (searching) {
        return (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
            <Text style={styles.muted}>{t(`${NS}.loadingList`)}</Text>
          </View>
        )
      }
      if (searchRows.length === 0) {
        return <EmptyState title={t(`${NS}.searchEmpty`)} colorScheme={colorScheme} />
      }
      return searchRows.map(renderRow)
    }
    if (loading) {
      return (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
          <Text style={styles.muted}>{t(`${NS}.loadingList`)}</Text>
        </View>
      )
    }
    if (error) {
      return (
        <ErrorState
          message={error}
          onRetry={onLoad}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      )
    }
    if (rows.length === 0) {
      return <EmptyState title={t(`${NS}.emptyList`)} colorScheme={colorScheme} />
    }
    return rows.map(renderRow)
  })()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Bookmark size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.description`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <View style={styles.loginBlock}>
          <Text style={styles.loginHint}>{loginRequiredText}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {error && (rows.length > 0 || searchRows !== null) ? (
            <Text style={styles.errorBanner}>{error}</Text>
          ) : null}

          {/* 仓库区:仓库名 + 加载 + 新建 */}
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Bookmark size={16} color={tk.text.secondary} />
              <Text style={styles.sectionTitle}>{t(`${NS}.repoSection`)}</Text>
            </View>
            <Text style={styles.fieldLabel}>{t(`${NS}.repoNameLabel`)}</Text>
            <TextInput
              value={repoName}
              onChangeText={onRepoNameChange}
              placeholder={t(`${NS}.repoNamePlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <View style={styles.actions}>
              <Pressable
                onPress={onLoad}
                disabled={loading || !repoName.trim()}
                style={styles.primaryBtn}
                accessibilityRole="button"
                accessibilityLabel={t(`${NS}.load`)}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={tk.brand.foreground} />
                ) : (
                  <Sparkles size={14} color={tk.brand.foreground} />
                )}
                <Text style={styles.primaryBtnText}>{t(`${NS}.load`)}</Text>
              </Pressable>
              <Pressable
                onPress={onOpenCreate}
                disabled={!repoName.trim()}
                style={styles.secondaryBtn}
                accessibilityRole="button"
                accessibilityLabel={t(`${NS}.create`)}
              >
                <Plus size={14} color={tk.text.primary} />
                <Text style={styles.secondaryBtnText}>{t(`${NS}.create`)}</Text>
              </Pressable>
            </View>
          </View>

          {/* 创建 / 编辑表单 */}
          {formMode ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {formMode === 'edit' ? t(`${NS}.editSection`) : t(`${NS}.createSection`)}
              </Text>

              <Text style={styles.fieldLabel}>{t(`${NS}.kindLabel`)}</Text>
              <View style={styles.kindRow}>
                {KNOWLEDGE_CARD_KIND_VALUES.map((kind) => {
                  const active = form.kind === kind
                  return (
                    <Pressable
                      key={kind}
                      onPress={() => onFormChange({ kind })}
                      style={[styles.kindChip, active ? styles.kindChipActive : null]}
                      accessibilityRole="button"
                      accessibilityLabel={kindLabel(kind)}
                    >
                      <Text
                        style={[styles.kindChipText, active ? styles.kindChipTextActive : null]}
                      >
                        {kindLabel(kind)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={styles.fieldLabel}>{t(`${NS}.titleLabel`)}</Text>
              <TextInput
                value={form.title}
                onChangeText={(value) => onFormChange({ title: value })}
                placeholder={t(`${NS}.titlePlaceholder`)}
                placeholderTextColor={tk.text.tertiary}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>{t(`${NS}.contentLabel`)}</Text>
              <TextInput
                value={form.content}
                onChangeText={(value) => onFormChange({ content: value })}
                placeholder={t(`${NS}.contentPlaceholder`)}
                placeholderTextColor={tk.text.tertiary}
                multiline
                style={[styles.input, styles.textarea]}
              />

              <Text style={styles.fieldLabel}>{t(`${NS}.tagsLabel`)}</Text>
              <TextInput
                value={form.tags}
                onChangeText={(value) => onFormChange({ tags: value })}
                placeholder={t(`${NS}.tagsPlaceholder`)}
                placeholderTextColor={tk.text.tertiary}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>{t(`${NS}.confidenceLabel`)}</Text>
              <TextInput
                value={form.confidence}
                onChangeText={(value) => onFormChange({ confidence: value })}
                keyboardType="number-pad"
                style={[styles.input, styles.inputNarrow]}
              />

              <View style={styles.actions}>
                <Pressable
                  onPress={onSubmit}
                  disabled={submitting}
                  style={styles.primaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel={formMode === 'edit' ? t(`${NS}.update`) : t(`${NS}.submit`)}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={tk.brand.foreground} />
                  ) : null}
                  <Text style={styles.primaryBtnText}>
                    {formMode === 'edit' ? t(`${NS}.update`) : t(`${NS}.submit`)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onCloseForm}
                  disabled={submitting}
                  style={styles.secondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t(`${NS}.cancelEdit`)}
                >
                  <X size={14} color={tk.text.primary} />
                  <Text style={styles.secondaryBtnText}>{t(`${NS}.cancelEdit`)}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* 详情 */}
          {detailTitle ? (
            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, styles.flexOne]} numberOfLines={2}>
                  {detailTitle}
                </Text>
                <Pressable
                  onPress={onCloseDetail}
                  style={styles.secondaryBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t(`${NS}.backToList`)}
                >
                  <Text style={styles.secondaryBtnText}>{t(`${NS}.backToList`)}</Text>
                </Pressable>
              </View>
              {loadingDetail || detailContent === null ? (
                <View style={styles.centerBlock}>
                  <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
                  <Text style={styles.muted}>{t(`${NS}.loadingDetail`)}</Text>
                </View>
              ) : detailContent ? (
                <Text style={styles.detailBody}>{detailContent}</Text>
              ) : (
                <EmptyState title={t('common.empty')} colorScheme={colorScheme} />
              )}
            </View>
          ) : null}

          {/* 列表 / 搜索结果 */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {searchRows !== null ? t(`${NS}.searchResults`) : t(`${NS}.listTitle`)}
            </Text>

            <View style={styles.searchRow}>
              <TextInput
                value={searchQ}
                onChangeText={onSearchQChange}
                placeholder={t(`${NS}.searchPlaceholder`)}
                placeholderTextColor={tk.text.tertiary}
                style={[styles.input, styles.flexOne]}
                accessibilityLabel={t(`${NS}.searchLabel`)}
              />
              <Pressable
                onPress={onSearch}
                disabled={searching}
                style={styles.secondaryBtn}
                accessibilityRole="button"
                accessibilityLabel={t(`${NS}.search`)}
              >
                {searching ? (
                  <ActivityIndicator size="small" color={tk.text.primary} />
                ) : (
                  <Search size={14} color={tk.text.primary} />
                )}
                <Text style={styles.secondaryBtnText}>{t(`${NS}.search`)}</Text>
              </Pressable>
            </View>
            {searchRows !== null ? (
              <Pressable
                onPress={onClearSearch}
                style={styles.textBtn}
                accessibilityRole="button"
                accessibilityLabel={t(`${NS}.clearSearch`)}
              >
                <Text style={styles.textBtnLabel}>{t(`${NS}.clearSearch`)}</Text>
              </Pressable>
            ) : null}

            {listBlock}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.lg },
    flexOne: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    subtitle: {
      marginTop: 2,
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.secondary,
    },
    loginBlock: { marginTop: rnSpacing.xl },
    loginHint: { fontSize: rnType.body.size, color: tk.text.secondary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { gap: rnSpacing.md, paddingBottom: rnSpacing['3xl'] },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    sectionTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    fieldLabel: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
      marginTop: rnSpacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    inputNarrow: { width: 96 },
    textarea: { minHeight: 96, textAlignVertical: 'top' },
    kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    kindChip: {
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 4,
    },
    kindChipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.brand.DEFAULT },
    kindChipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    kindChipTextActive: { color: tk.brand.foreground },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: rnSpacing.sm },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.DEFAULT,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    primaryBtnText: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.brand.foreground,
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.card,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    secondaryBtnText: { fontSize: rnType.label.size, color: tk.text.primary },
    textBtn: { alignSelf: 'flex-start', paddingVertical: rnSpacing.xs },
    textBtnLabel: { fontSize: rnType.label.size, color: tk.text.secondary },
    rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    rowTitle: {
      flexShrink: 1,
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    chip: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 2,
    },
    chipText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    rowPreview: { fontSize: rnType.label.size, color: tk.text.secondary },
    rowMeta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 4,
    },
    actionText: { fontSize: rnType.label.size, color: tk.text.secondary },
    actionTextDanger: { fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xl,
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    errorBanner: {
      borderRadius: rnRadius.sm,
      backgroundColor: tk.error.bg,
      padding: rnSpacing.sm,
      fontSize: rnType.label.size,
      color: tk.error.text,
    },
    detailBody: {
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.primary,
    },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
