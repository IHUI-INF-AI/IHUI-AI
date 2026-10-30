// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Bookmark, Check, Plus, Search, Trash2 } from 'lucide-react-native'
import type { TFunction } from '../../types'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { createKnowledgeCardStyles } from './knowledge-card-styles'

/** 卡片类型(与 apps/api createSchema 的 cardKindSchema 同枚举,共享层独立声明不依赖 api-client)。 */
export type KnowledgeCardKind = 'experience' | 'fact' | 'practices' | 'pitfall'

/** 列表/搜索行(对齐 GET /api/knowledge-cards 的 summary 形状;搜索态后端附带 content)。 */
export interface KnowledgeCardRow {
  id: string
  kind: KnowledgeCardKind
  source: 'agent' | 'manual'
  title: string
  tags: string[]
  useCount: number
  createdAt: string | null
  content?: string
}

/** 创建/编辑表单态(null = 表单收起)。 */
export interface KnowledgeCardFormState {
  editingId: string | null
  kind: KnowledgeCardKind
  title: string
  content: string
  tags: string
  confidence: number
}

export interface KnowledgeCardsScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  /** 仓库名(owner/repo);web 同口径:为空时加载/新建按钮禁用。 */
  repoName: string
  onRepoNameChange: (value: string) => void
  onLoad: () => void
  loading: boolean
  error: string | null
  cards: KnowledgeCardRow[]
  form: KnowledgeCardFormState | null
  /** 点「新建卡片」:薄壳负责把表单置为新建态并展开(web openCreateForm)。 */
  onOpenCreateForm: () => void
  onFormChange: (patch: Partial<KnowledgeCardFormState>) => void
  onSubmitForm: () => void
  onCancelForm: () => void
  submitting: boolean
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSearch: () => void
  onClearSearch: () => void
  searching: boolean
  /** null = 未处于搜索结果态(与 web `searchResults !== null` 同口径)。 */
  searchResults: KnowledgeCardRow[] | null
  detail: { id: string; title: string; content: string } | null
  loadingDetail: boolean
  onCloseDetail: () => void
  onView: (card: KnowledgeCardRow) => void
  onEdit: (card: KnowledgeCardRow) => void
  onMarkUsed: (card: KnowledgeCardRow) => void
  onDelete: (card: KnowledgeCardRow) => void
  busyId: string | null
}

const KIND_VALUES: KnowledgeCardKind[] = ['experience', 'fact', 'practices', 'pitfall']

/** 类型 → 文案键(与 web kindLabel switch 一一同名同档)。 */
const KIND_LABEL_KEYS: Record<KnowledgeCardKind, string> = {
  experience: 'knowledgeCardPage.kindExperience',
  fact: 'knowledgeCardPage.kindFact',
  practices: 'knowledgeCardPage.kindPractices',
  pitfall: 'knowledgeCardPage.kindPitfall',
}

/**
 * 知识卡片共享屏(knowledge-card 域;对齐 web apps/web/app/(main)/knowledge-cards/page.tsx,
 * 2026-10-26 Wave3)。承载「仓库区 → 创建/编辑表单 → 详情区 → 列表/搜索结果」四段,
 * 与 web 同构;取数(GET/POST/PATCH/DELETE /api/knowledge-cards)由平台薄壳承担。
 * 差异:web 详情区用 MarkdownStream 渲染,本屏按纯文本渲染(RN 侧无 markdown 承载)。
 */
export function KnowledgeCardsScreen({
  t,
  colorScheme = 'light',
  onBack,
  repoName,
  onRepoNameChange,
  onLoad,
  loading,
  error,
  cards,
  form,
  onOpenCreateForm,
  onFormChange,
  onSubmitForm,
  onCancelForm,
  submitting,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onClearSearch,
  searching,
  searchResults,
  detail,
  loadingDetail,
  onCloseDetail,
  onView,
  onEdit,
  onMarkUsed,
  onDelete,
  busyId,
}: KnowledgeCardsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createKnowledgeCardStyles(tk), [tk])
  const kindLabel = (kind: KnowledgeCardKind): string => t(KIND_LABEL_KEYS[kind])
  const repoReady = repoName.trim().length > 0

  const renderRow = (card: KnowledgeCardRow) => (
    <View key={card.id} style={styles.row}>
      <View style={styles.cardTitleRow}>
        <Text style={[styles.rowTitle, { flexShrink: 1 }]} numberOfLines={2}>
          {card.title}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{kindLabel(card.kind)}</Text>
        </View>
        {card.source === 'agent' && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('knowledgeCardPage.sourceAgent')}</Text>
          </View>
        )}
      </View>
      {card.content ? (
        <Text style={styles.rowContent} numberOfLines={2}>
          {card.content}
        </Text>
      ) : null}
      <Text style={styles.rowMeta} numberOfLines={2}>
        {`${t('knowledgeCardPage.useCount')}: ${card.useCount}`}
        {card.tags.length > 0 ? ` · ${card.tags.map((tag) => `#${tag}`).join(' ')}` : ''}
        {card.createdAt ? ` · ${card.createdAt.slice(0, 10)}` : ''}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btnGhost, { minWidth: 0, paddingVertical: 6 }, detail?.id === card.id ? styles.btnDisabled : null]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('knowledgeCardPage.view')}
          onPress={() => onView(card)}
        >
          <Text style={styles.btnGhostText}>{t('knowledgeCardPage.view')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnGhost, { minWidth: 0, paddingVertical: 6 }]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('knowledgeCardPage.edit')}
          onPress={() => onEdit(card)}
        >
          <Text style={styles.btnGhostText}>{t('knowledgeCardPage.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnGhost, { minWidth: 0, paddingVertical: 6 }, busyId === card.id ? styles.btnDisabled : null]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('knowledgeCardPage.markUsed')}
          onPress={() => onMarkUsed(card)}
        >
          <View style={styles.cardTitleRow}>
            <Check size={12} color={tk.text.primary} strokeWidth={2} />
            <Text style={styles.btnGhostText}>{t('knowledgeCardPage.markUsed')}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnDanger, busyId === card.id ? styles.btnDisabled : null]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('knowledgeCardPage.delete')}
          onPress={() => onDelete(card)}
        >
          <View style={styles.cardTitleRow}>
            <Trash2 size={12} color={tk.danger.DEFAULT} strokeWidth={2} />
            <Text style={styles.btnDangerText}>{t('knowledgeCardPage.delete')}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle}>{t('knowledgeCardPage.title')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onLoad} tintColor={tk.text.secondary} />
        }
      >
        <View>
          <Text style={styles.heroTitle}>{t('knowledgeCardPage.title')}</Text>
          <Text style={styles.heroSubtitle}>{t('knowledgeCardPage.description')}</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 仓库区 */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Bookmark size={16} color={tk.brandAccent.deep} strokeWidth={2} />
            <Text style={styles.cardTitle}>{t('knowledgeCardPage.repoSection')}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('knowledgeCardPage.repoNameLabel')}</Text>
            <TextField
              colorScheme={colorScheme}
              style={styles.input}
              value={repoName}
              onChangeText={onRepoNameChange}
              placeholder={t('knowledgeCardPage.repoNamePlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnGhost, !repoReady || loading ? styles.btnDisabled : null]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('knowledgeCardPage.load')}
              disabled={!repoReady || loading}
              onPress={onLoad}
            >
              <Text style={styles.btnGhostText}>{t('knowledgeCardPage.load')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, !repoReady ? styles.btnDisabled : null]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('knowledgeCardPage.create')}
              disabled={!repoReady}
              onPress={onOpenCreateForm}
            >
              <View style={styles.cardTitleRow}>
                <Plus size={14} color={tk.brand.ctaForeground} strokeWidth={2} />
                <Text style={styles.btnPrimaryText}>{t('knowledgeCardPage.create')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 创建 / 编辑表单 */}
        {form ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {form.editingId
                ? t('knowledgeCardPage.editSection')
                : t('knowledgeCardPage.createSection')}
            </Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t('knowledgeCardPage.kindLabel')}</Text>
              <View style={styles.kindRow}>
                {KIND_VALUES.map((kind) => {
                  const active = form.kind === kind
                  return (
                    <TouchableOpacity
                      key={kind}
                      style={[styles.kindChip, active ? styles.kindChipActive : null]}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={kindLabel(kind)}
                      onPress={() => onFormChange({ kind })}
                    >
                      <Text
                        style={[
                          styles.kindChipText,
                          active ? styles.kindChipTextActive : null,
                        ]}
                      >
                        {kindLabel(kind)}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t('knowledgeCardPage.titleLabel')}</Text>
              <TextField
                colorScheme={colorScheme}
                style={styles.input}
                value={form.title}
                onChangeText={(v) => onFormChange({ title: v })}
                placeholder={t('knowledgeCardPage.titlePlaceholder')}
                placeholderTextColor={tk.text.tertiary}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t('knowledgeCardPage.contentLabel')}</Text>
              <TextField
                colorScheme={colorScheme}
                style={[styles.input, styles.inputMultiline]}
                value={form.content}
                onChangeText={(v) => onFormChange({ content: v })}
                placeholder={t('knowledgeCardPage.contentPlaceholder')}
                placeholderTextColor={tk.text.tertiary}
                multiline
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t('knowledgeCardPage.tagsLabel')}</Text>
              <TextField
                colorScheme={colorScheme}
                style={styles.input}
                value={form.tags}
                onChangeText={(v) => onFormChange({ tags: v })}
                placeholder={t('knowledgeCardPage.tagsPlaceholder')}
                placeholderTextColor={tk.text.tertiary}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{t('knowledgeCardPage.confidenceLabel')}</Text>
              <TextField
                colorScheme={colorScheme}
                style={styles.input}
                value={String(form.confidence)}
                onChangeText={(v) => {
                  const n = Number(v)
                  const clamped = Number.isNaN(n) ? 100 : Math.max(0, Math.min(100, Math.round(n)))
                  onFormChange({ confidence: clamped })
                }}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btnPrimary, submitting ? styles.btnDisabled : null]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={
                  form.editingId
                    ? t('knowledgeCardPage.update')
                    : t('knowledgeCardPage.submit')
                }
                disabled={submitting}
                onPress={onSubmitForm}
              >
                <Text style={styles.btnPrimaryText}>
                  {form.editingId
                    ? t('knowledgeCardPage.update')
                    : t('knowledgeCardPage.submit')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnGhost, submitting ? styles.btnDisabled : null]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('knowledgeCardPage.cancelEdit')}
                disabled={submitting}
                onPress={onCancelForm}
              >
                <Text style={styles.btnGhostText}>{t('knowledgeCardPage.cancelEdit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* 详情区 */}
        {detail ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { flex: 1 }]}>{detail.title}</Text>
              <TouchableOpacity
                style={[styles.btnGhost, { minWidth: 0, paddingVertical: 6 }]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('knowledgeCardPage.backToList')}
                onPress={onCloseDetail}
              >
                <Text style={styles.btnGhostText}>{t('knowledgeCardPage.backToList')}</Text>
              </TouchableOpacity>
            </View>
            {loadingDetail ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={tk.brandAccent.deep} />
                <Text style={styles.loadingText}>{t('knowledgeCardPage.loadingDetail')}</Text>
              </View>
            ) : (
              <Text style={styles.detailText}>{detail.content}</Text>
            )}
          </View>
        ) : null}

        {/* 列表 / 搜索结果 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {searchResults !== null
              ? t('knowledgeCardPage.searchResults')
              : t('knowledgeCardPage.listTitle')}
          </Text>
          <View style={styles.btnRow}>
            <TextField
              colorScheme={colorScheme}
              style={[styles.input, { flex: 1, minWidth: 120 }]}
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              placeholder={t('knowledgeCardPage.searchPlaceholder')}
              placeholderTextColor={tk.text.tertiary}
              onSubmitEditing={onSearch}
              returnKeyType="search"
              accessibilityLabel={t('knowledgeCardPage.searchLabel')}
            />
            <TouchableOpacity
              style={[styles.btnGhost, { minWidth: 0 }, searching ? styles.btnDisabled : null]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('knowledgeCardPage.search')}
              disabled={searching}
              onPress={onSearch}
            >
              <View style={styles.cardTitleRow}>
                <Search size={13} color={tk.text.primary} strokeWidth={2} />
                <Text style={styles.btnGhostText}>{t('knowledgeCardPage.search')}</Text>
              </View>
            </TouchableOpacity>
            {searchResults !== null ? (
              <TouchableOpacity
                style={[styles.btnGhost, { minWidth: 0 }]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('knowledgeCardPage.clearSearch')}
                onPress={onClearSearch}
              >
                <Text style={styles.btnGhostText}>{t('knowledgeCardPage.clearSearch')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {searchResults !== null ? (
            searchResults.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>{t('knowledgeCardPage.searchEmpty')}</Text>
              </View>
            ) : (
              <View style={styles.list}>{searchResults.map(renderRow)}</View>
            )
          ) : loading ? (
            <View style={styles.list}>
              <View style={styles.skeleton} />
              <View style={styles.skeleton} />
              <View style={styles.skeleton} />
            </View>
          ) : cards.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('knowledgeCardPage.emptyList')}</Text>
            </View>
          ) : (
            <View style={styles.list}>{cards.map(renderRow)}</View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default KnowledgeCardsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
