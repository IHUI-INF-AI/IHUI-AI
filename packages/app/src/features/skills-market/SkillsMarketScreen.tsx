// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Download, Loader2, Power, PowerOff, Search, User, Wand2 } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import {
  RatingStars,
  SkillMarketDetailView,
  type SkillDetailView,
} from './SkillMarketDetailView'

const NS = 'skillMarketPage'

/** 市场条目行(字段与后端 GET /api/skills/market 的 items 对齐) */
export interface SkillMarketRowView {
  name: string
  description: string
  tags: string[]
  author: string
  version: string
  rating: number
  ratingCount: number
  installCount: number
  /** 用户级启用态(与 install 正交,见 endpoints/skills-market.ts 头注) */
  enabled: boolean
}

export interface SkillsMarketScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  /** 非空即未登录门(与 web useAuthGate 同口径,不发注定 401 的请求) */
  loginRequiredText: string
  loading: boolean
  error: string | null
  rows: SkillMarketRowView[]
  total: number
  page: number
  totalPages: number
  query: string
  onQueryChange: (value: string) => void
  tag: string
  tags: string[]
  onTagChange: (value: string) => void
  onPrevPage: () => void
  onNextPage: () => void
  onRefresh: () => void
  /** 在途条目名(启停/安装共用,防连点) */
  actingName: string | null
  onToggleEnabled: (name: string) => void
  onInstall: (name: string) => void
  detail: SkillDetailView | null
  onOpenDetail: (name: string) => void
  onCloseDetail: () => void
  onSubmitRating: (score: number, comment: string) => void
  onToggleSubscribe: () => void
}

/**
 * Skill 市场共享屏 —— 承载 web `/skills/market` 与 `/skills-market` 两张路由。
 *
 * 与 web 对应实现:apps/web/app/(main)/skills/market/page.tsx(技能市场:搜索 + 标签 +
 * 安装/评分/订阅/分页)与 apps/web/app/(main)/skills-market/PageClient.tsx(启停 + 详情弹层)。
 * 两端本是同一份后端目录(GET /api/skills/market),RN 侧合成为一屏,避免两套重复实现。
 *
 * 只渲染;取数 / 分页 / 防抖 / 时间格式化 / 登录门 / 在途态全部由薄壳注入。
 * 口径差(如实登记):web 的「发布技能」「通知已读」弹层在 RN 未承载(见 ledger note);
 * web 评分成功后用 toast,RN 无 toast 体系,改为提交后由薄壳刷新列表与本弹层评分列表。
 */
export function SkillsMarketScreen({
  t,
  colorScheme,
  onBack,
  loginRequiredText,
  loading,
  error,
  rows,
  total,
  page,
  totalPages,
  query,
  onQueryChange,
  tag,
  tags,
  onTagChange,
  onPrevPage,
  onNextPage,
  onRefresh,
  actingName,
  onToggleEnabled,
  onInstall,
  detail,
  onOpenDetail,
  onCloseDetail,
  onSubmitRating,
  onToggleSubscribe,
}: SkillsMarketScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Wand2 size={20} color={tk.text.primary} />
            <Text style={styles.title}>{t(`${NS}.title`)}</Text>
            {!loading && !error ? (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{t(`${NS}.count`, { count: total })}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.subtitle`)}</Text>
        </View>
      </View>

      {loginRequiredText ? (
        <Text style={styles.loginHint}>{loginRequiredText}</Text>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Search size={16} color={tk.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={onQueryChange}
              placeholder={t(`${NS}.searchPlaceholder`)}
              placeholderTextColor={tk.text.tertiary}
              autoCorrect={false}
              accessibilityLabel={t(`${NS}.tag`)}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagRow}
          >
            <TagChip
              label={t(`${NS}.allTags`)}
              active={tag === ''}
              onPress={() => onTagChange('')}
              styles={styles}
            />
            {tags.map((item) => (
              <TagChip
                key={item}
                label={item}
                active={tag === item}
                onPress={() => onTagChange(item)}
                styles={styles}
              />
            ))}
          </ScrollView>

          {loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="small" color={tk.text.secondary} />
              <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
            </View>
          ) : error ? (
            <Pressable onPress={onRefresh} style={styles.errorBox} accessibilityRole="button">
              <Text style={styles.errorText}>{error}</Text>
            </Pressable>
          ) : rows.length === 0 ? (
            <View style={styles.centerBlock}>
              <Wand2 size={30} color={tk.text.tertiary} />
              <Text style={styles.muted}>{t(`${NS}.empty`)}</Text>
              <Text style={styles.hintMuted}>{t(`${NS}.emptyHint`)}</Text>
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.name}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <SkillCard
                  row={item}
                  t={t}
                  colorScheme={colorScheme}
                  acting={actingName === item.name}
                  onOpen={() => onOpenDetail(item.name)}
                  onToggle={() => onToggleEnabled(item.name)}
                  onInstall={() => onInstall(item.name)}
                />
              )}
            />
          )}

          {!loading && !error && rows.length > 0 && totalPages > 1 ? (
            <View style={styles.pager}>
              <Pressable
                onPress={onPrevPage}
                disabled={page <= 1}
                style={[styles.pagerButton, page <= 1 && styles.buttonDisabled]}
                accessibilityRole="button"
              >
                <Text style={styles.pagerText}>{t(`${NS}.prevPage`)}</Text>
              </Pressable>
              <Text style={styles.pagerIndicator}>
                {t(`${NS}.pageIndicator`, { page, total: totalPages })}
              </Text>
              <Pressable
                onPress={onNextPage}
                disabled={page >= totalPages}
                style={[styles.pagerButton, page >= totalPages && styles.buttonDisabled]}
                accessibilityRole="button"
              >
                <Text style={styles.pagerText}>{t(`${NS}.nextPage`)}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}

      <Modal
        visible={detail !== null}
        animationType="slide"
        transparent
        onRequestClose={onCloseDetail}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {detail ? (
              <SkillMarketDetailView
                t={t}
                colorScheme={colorScheme}
                detail={detail}
                onClose={onCloseDetail}
                onSubmitRating={onSubmitRating}
                onToggleSubscribe={onToggleSubscribe}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

function TagChip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string
  active: boolean
  onPress: () => void
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tagChip, active && styles.tagChipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tagText, active && styles.tagTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

function SkillCard({
  row,
  t,
  colorScheme,
  acting,
  onOpen,
  onToggle,
  onInstall,
}: {
  row: SkillMarketRowView
  t: TFunction
  colorScheme: AppThemeMode
  acting: boolean
  onOpen: () => void
  onToggle: () => void
  onInstall: () => void
}) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Wand2 size={18} color={tk.text.primary} />
        </View>
        <View style={styles.cardMain}>
          <Pressable onPress={onOpen} accessibilityRole="button">
            <Text style={styles.cardName} numberOfLines={1}>
              {row.name}
            </Text>
          </Pressable>
          <View style={styles.metaRow}>
            <RatingStars score={row.rating} size={11} colorScheme={colorScheme} />
            <Text style={styles.metaText}>
              {row.ratingCount > 0
                ? t(`${NS}.ratingCount`, { count: row.ratingCount })
                : t(`${NS}.noRatings`)}
            </Text>
            <Download size={11} color={tk.text.tertiary} />
            <Text style={styles.metaText}>{t(`${NS}.installs`, { count: row.installCount })}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.cardDesc} numberOfLines={2}>
        {row.description}
      </Text>

      <View style={styles.metaRow}>
        {row.tags.slice(0, 3).map((tag) => (
          <View key={tag} style={styles.miniChip}>
            <Text style={styles.miniChipText}>{tag}</Text>
          </View>
        ))}
        <User size={11} color={tk.text.tertiary} />
        <Text style={styles.metaText}>{row.author}</Text>
        <Text style={styles.metaText}>v{row.version}</Text>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          onPress={onToggle}
          disabled={acting}
          style={[styles.actionButton, acting && styles.buttonDisabled]}
          accessibilityRole="button"
        >
          {acting ? (
            <Loader2 size={13} color={tk.text.primary} />
          ) : row.enabled ? (
            <PowerOff size={13} color={tk.text.primary} />
          ) : (
            <Power size={13} color={tk.text.primary} />
          )}
          <Text style={styles.actionText}>
            {row.enabled ? t(`${NS}.disable`) : t(`${NS}.enable`)}
          </Text>
        </Pressable>
        <Pressable
          onPress={onInstall}
          disabled={acting}
          style={[styles.actionButton, acting && styles.buttonDisabled]}
          accessibilityRole="button"
        >
          <Download size={13} color={tk.text.primary} />
          <Text style={styles.actionText}>{t(`${NS}.install`)}</Text>
        </Pressable>
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
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    countBadge: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 1,
    },
    countBadgeText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    subtitle: { marginTop: 2, fontSize: rnType.caption.size, color: tk.text.secondary },
    loginHint: { marginTop: rnSpacing.xl, fontSize: rnType.body.size, color: tk.text.secondary },
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
    tagRow: { gap: rnSpacing.xs, paddingVertical: rnSpacing.sm },
    tagChip: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 4,
      maxWidth: 160,
    },
    tagChipActive: { backgroundColor: tk.text.primary },
    tagText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    tagTextActive: { color: tk.surface.bg },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['2xl'],
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    hintMuted: { fontSize: rnType.caption.size, color: tk.text.tertiary, textAlign: 'center' },
    errorBox: {
      marginTop: rnSpacing.md,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.danger.DEFAULT,
      backgroundColor: tk.danger.light,
      padding: rnSpacing.md,
    },
    errorText: { fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    list: { flex: 1, marginTop: rnSpacing.xs },
    listContent: { paddingBottom: rnSpacing.md, gap: rnSpacing.sm },
    card: {
      gap: rnSpacing.sm,
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
    cardMain: { flex: 1, gap: 2 },
    cardName: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: rnSpacing.xs },
    metaText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    cardDesc: { fontSize: rnType.caption.size, lineHeight: 18, color: tk.text.secondary },
    miniChip: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
    },
    miniChipText: { fontSize: 10, color: tk.text.secondary },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      paddingVertical: rnSpacing.sm,
    },
    actionText: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
    buttonDisabled: { opacity: 0.5 },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    pagerButton: {
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
    },
    pagerText: { fontSize: rnType.caption.size, color: tk.text.primary },
    pagerIndicator: { fontSize: rnType.caption.size, color: tk.text.secondary },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: tk.overlay.modal,
    },
    modalCard: {
      maxHeight: '88%',
      borderTopLeftRadius: rnRadius.lg,
      borderTopRightRadius: rnRadius.lg,
      backgroundColor: tk.surface.bg,
      overflow: 'hidden',
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
