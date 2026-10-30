// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius } from '@ihui/design-tokens'
import { useMemo } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import {
  Bell,
  BellOff,
  Download,
  Eye,
  EyeOff,
  Power,
  PowerOff,
  Star,
  User,
} from 'lucide-react-native'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { TextField } from '../../components/TextField'

/**
 * Skill 市场「详情」共享屏(对应 web `/skills-market/[id]`)。
 *
 * web 侧那份屏是一个薄壳把 name 交给列表页组件、由列表页的详情弹层渲染
 * (apps/web/app/(main)/skills-market/[id]/PageClient.tsx:18-28 传 deepLinkName,
 * apps/web/app/(main)/skills-market/PageClient.tsx:102-122 反查 + 自动开弹层,
 * 同文件 469-709 是弹层本体)。移动端没有"地址栏直达 + 弹层"这一形态,故落成
 * **独立一屏**:同一组信息(元数据 / 评分列表 / 评分表单 / 订阅 / owner 上下架)
 * 逐块搬运,关闭动作等价于 web 的 `closeDetail()`(关弹层 + 退回列表)。
 *
 * 平台无关:不取 API、不导航、不翻译 —— 数据与回调由 wrapper(mobile-rn 薄壳)注入。
 */

/** 详情主体(由 wrapper 从市场条目映射而来) */
export interface SkillMarketDetailView {
  name: string
  description: string
  tags: string[]
  author: string
  version: string
  license: string
  installCount: number
  rating: number
  ratingCount: number
}

/** 单条用户评分(展示字段收口,不把 userId 等实现细节摊进 UI) */
export interface SkillMarketDetailRatingItem {
  id: string
  userName: string
  score: number
  comment: string
  /** 已格式化的日期串(wrapper 侧用 Intl 出,UI 不再二次解析) */
  createdAt: string
}

export type SkillMarketDetailState = 'loading' | 'error' | 'notFound' | 'ready'

export interface SkillMarketDetailScreenProps {
  t: TFunction
  colorScheme: 'light' | 'dark'
  state: SkillMarketDetailState
  entry: SkillMarketDetailView | null
  /** state==='notFound' 时文案里的条目名(URL 原文,与 web notFoundHint 同参) */
  requestedName: string
  errorMessage: string
  ratings: SkillMarketDetailRatingItem[]
  ratingsLoading: boolean
  /** null = 订阅态取不到(接口失败),按未订阅展示、不额外报错(与 web 同口径) */
  subscription: { subscribed: boolean; subscriberCount: number } | null
  /** null = owner 判定取不到 ⇒ 不展示上下架按钮(web 同口径:仅 owner 可见) */
  ownership: { isOwner: boolean; enabled: boolean } | null
  /** 用户级运行态(该 skill 在我这里是否启用),与 ownership 的 listing 态正交 */
  runtimeEnabled: boolean
  /** 正在执行的写操作(同一时刻只允许一个;其余按钮置灰,与 web actingName 同判据) */
  pending: '' | 'subscribe' | 'install' | 'runtime' | 'rate' | 'listing'
  score: number
  comment: string
  onScoreChange: (score: number) => void
  onCommentChange: (comment: string) => void
  onSubmitRating: () => void
  onToggleSubscribe: () => void
  onInstall: () => void
  onToggleRuntime: () => void
  onToggleListing: () => void
  onRetry: () => void
  onBack: () => void
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: tk.surface.bg },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16, // px-4
      paddingBottom: 8, // pb-2
      paddingTop: 12, // pt-3
    },
    headerTitle: {
      fontSize: 16, // text-base
      fontWeight: '600',
      color: tk.text.primary,
      maxWidth: '62%',
    },
    headerSpacer: { width: 44 },
    scroll: { padding: 16, gap: 12 },
    card: {
      borderRadius: rnRadius.lg, // rounded-lg
      borderWidth: 1, // border(描边取中性档,不得取墨档 —— AGENTS §4)
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: 16,
      gap: 8,
    },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    badge: {
      borderRadius: rnRadius.md,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: tk.surface.muted,
    },
    badgeText: { fontSize: 12, fontWeight: '500', color: tk.text.secondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    metaText: { fontSize: 12, color: tk.text.secondary, flexShrink: 0 },
    starRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    description: { fontSize: 14, lineHeight: 21, color: tk.text.primary },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tagChip: {
      borderRadius: rnRadius.md,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: tk.surface.muted,
    },
    tagText: { fontSize: 12, color: tk.text.secondary },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 36, // Button size=default 档(AGENTS §4 高度档位)
      paddingHorizontal: 12,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      flexGrow: 1,
    },
    primaryBtnText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.card,
      flexGrow: 1,
    },
    outlineBtnText: { fontSize: 14, fontWeight: '500', color: tk.text.primary },
    listingBtn: { flexGrow: 0, alignSelf: 'flex-start' },
    btnDisabled: { opacity: 0.5 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    ratingItem: {
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
      padding: 10,
      gap: 4,
    },
    ratingHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ratingUser: { fontSize: 12, fontWeight: '500', color: tk.text.primary, flexShrink: 1 },
    muted: { fontSize: 12, color: tk.text.secondary },
    formLabel: { fontSize: 13, fontWeight: '500', color: tk.text.primary, marginTop: 8 },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    scoreHit: { padding: 4 },
    commentInput: {
      minHeight: 72,
      textAlignVertical: 'top',
      borderRadius: rnRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.inputBg,
    },
    submitBtn: { alignSelf: 'flex-start', flexGrow: 0, marginTop: 4 },
  } satisfies Record<string, ViewStyle | TextStyle>)
}

/** 评分星展示档(满星按四舍五入取整 —— 与 web RatingStars 同判据) */
function Stars({ value, tk, size = 12 }: { value: number; tk: AppThemeTokens; size?: number }) {
  const filled = Math.round(value)
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          color={i <= filled ? tk.warning.DEFAULT : tk.border.medium}
          fill={i <= filled ? tk.warning.DEFAULT : 'transparent'}
        />
      ))}
    </View>
  )
}

export function SkillMarketDetailScreen(props: SkillMarketDetailScreenProps) {
  const {
    t,
    colorScheme,
    state,
    entry,
    requestedName,
    errorMessage,
    ratings,
    ratingsLoading,
    subscription,
    ownership,
    runtimeEnabled,
    pending,
    score,
    comment,
    onScoreChange,
    onCommentChange,
    onSubmitRating,
    onToggleSubscribe,
    onInstall,
    onToggleRuntime,
    onToggleListing,
    onRetry,
    onBack,
  } = props
  const tk = useMemo(() => getTokens(colorScheme), [colorScheme])
  const st = useMemo(() => createStyles(tk), [tk])
  const NS = 'skillsMarketDetailPage'

  const header = (titleText: string) => (
    <View style={st.headerBar}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={st.headerTitle} numberOfLines={1}>
        {titleText}
      </Text>
      <View style={st.headerSpacer} />
    </View>
  )

  if (state === 'loading') {
    return (
      <View style={st.page}>
        {header(t(`${NS}.title`))}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (state === 'error') {
    return (
      <View style={st.page}>
        {header(t(`${NS}.title`))}
        <ErrorState
          message={errorMessage || t(`${NS}.loadFailed`)}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  if (state === 'notFound' || !entry) {
    return (
      <View style={st.page}>
        {header(t(`${NS}.title`))}
        <EmptyState
          title={t(`${NS}.notFoundTitle`)}
          desc={t(`${NS}.notFoundHint`, { name: requestedName })}
          actionLabel={t(`${NS}.backToMarket`)}
          onAction={onBack}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  const subscribed = subscription?.subscribed ?? false
  const showListing = ownership?.isOwner === true

  return (
    <View style={st.page}>
      {header(entry.name)}
      <ScrollView contentContainerStyle={st.scroll}>
        <View style={st.card}>
          <View style={st.badgeRow}>
            <View style={st.badge}>
              <Text style={st.badgeText} numberOfLines={1}>
                {`v${entry.version}`}
              </Text>
            </View>
            <View style={st.badge}>
              <Text style={st.badgeText} numberOfLines={1}>
                {entry.license}
              </Text>
            </View>
            {ownership && !ownership.enabled ? (
              <View style={st.badge}>
                <Text style={st.badgeText} numberOfLines={1}>
                  {t(`${NS}.unlisted`)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={st.metaRow}>
            <Stars value={entry.rating} tk={tk} />
            <Text style={st.metaText}>
              {entry.rating.toFixed(1)} ·{' '}
              {entry.ratingCount > 0
                ? t(`${NS}.ratingCount`, { count: entry.ratingCount })
                : t(`${NS}.noRatings`)}
            </Text>
          </View>
          <View style={st.metaRow}>
            <Download size={12} color={tk.text.secondary} />
            <Text style={st.metaText}>
              {t(`${NS}.installs`, { count: entry.installCount })}
            </Text>
            {subscription ? (
              <Text style={st.metaText}>
                {t(`${NS}.subscribers`, { count: subscription.subscriberCount })}
              </Text>
            ) : null}
          </View>
          <View style={st.metaRow}>
            <User size={12} color={tk.text.secondary} />
            <Text style={st.metaText} numberOfLines={1}>
              {entry.author}
            </Text>
          </View>

          <Text style={st.description}>{entry.description}</Text>

          {entry.tags.length > 0 ? (
            <View style={st.tagRow}>
              {entry.tags.map((tag) => (
                <View key={tag} style={st.tagChip}>
                  <Text style={st.tagText} numberOfLines={1}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 操作区:与 web 弹层同一组动作(订阅 / 安装 / 运行态启停 / owner 上下架) */}
          <View style={st.actionRow}>
            <Pressable
              onPress={onToggleSubscribe}
              disabled={pending !== ''}
              style={[st.primaryBtn, pending === 'subscribe' ? st.btnDisabled : null]}
            >
              {subscribed ? (
                <BellOff size={14} color={tk.brand.ctaForeground} />
              ) : (
                <Bell size={14} color={tk.brand.ctaForeground} />
              )}
              <Text style={st.primaryBtnText}>
                {subscribed ? t(`${NS}.unsubscribe`) : t(`${NS}.subscribe`)}
              </Text>
            </Pressable>
            <Pressable
              onPress={onInstall}
              disabled={pending !== ''}
              style={[st.outlineBtn, pending === 'install' ? st.btnDisabled : null]}
            >
              <Download size={14} color={tk.text.primary} />
              <Text style={st.outlineBtnText}>{t(`${NS}.install`)}</Text>
            </Pressable>
            <Pressable
              onPress={onToggleRuntime}
              disabled={pending !== ''}
              style={[st.outlineBtn, pending === 'runtime' ? st.btnDisabled : null]}
            >
              {runtimeEnabled ? (
                <PowerOff size={14} color={tk.text.primary} />
              ) : (
                <Power size={14} color={tk.text.primary} />
              )}
              <Text style={st.outlineBtnText}>
                {runtimeEnabled ? t(`${NS}.disable`) : t(`${NS}.enable`)}
              </Text>
            </Pressable>
          </View>
          {showListing ? (
            <Pressable
              onPress={onToggleListing}
              disabled={pending !== ''}
              style={[
                st.outlineBtn,
                st.listingBtn,
                pending === 'listing' ? st.btnDisabled : null,
              ]}
            >
              {ownership?.enabled ? (
                <EyeOff size={14} color={tk.text.secondary} />
              ) : (
                <Eye size={14} color={tk.text.secondary} />
              )}
              <Text style={[st.outlineBtnText, { color: tk.text.secondary }]}>
                {ownership?.enabled ? t(`${NS}.unlist`) : t(`${NS}.relist`)}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* 评分区:列表 + 评分表单(web SkillDetailDialog 下半部同款) */}
        <View style={st.card}>
          <Text style={st.sectionTitle}>{t(`${NS}.ratingsTitle`)}</Text>
          {ratingsLoading ? (
            <Text style={st.muted}>{t(`${NS}.loading`)}</Text>
          ) : ratings.length === 0 ? (
            <Text style={st.muted}>{t(`${NS}.noRatings`)}</Text>
          ) : (
            ratings.map((r) => (
              <View key={r.id} style={st.ratingItem}>
                <View style={st.ratingHead}>
                  <Text style={st.ratingUser} numberOfLines={1}>
                    {r.userName}
                  </Text>
                  <Stars value={r.score} tk={tk} size={10} />
                  <Text style={st.muted} numberOfLines={1}>
                    {r.createdAt}
                  </Text>
                </View>
                {r.comment ? <Text style={st.muted}>{r.comment}</Text> : null}
              </View>
            ))
          )}

          <Text style={st.formLabel}>{t(`${NS}.rateTitle`)}</Text>
          <View style={st.scoreRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable
                key={i}
                onPress={() => onScoreChange(i)}
                accessibilityRole="button"
                accessibilityLabel={`${t(`${NS}.yourScore")} ${i}`}
                style={st.scoreHit}
              >
                <Star
                  size={20}
                  color={i <= score ? tk.warning.DEFAULT : tk.border.medium}
                  fill={i <= score ? tk.warning.DEFAULT : 'transparent'}
                />
              </Pressable>
            ))}
          </View>
          <TextField
            colorScheme={colorScheme}
            value={comment}
            onChangeText={onCommentChange}
            placeholder={t(`${NS}.commentPlaceholder`)}
            placeholderTextColor={tk.text.tertiary}
            multiline
            style={st.commentInput}
          />
          <Pressable
            onPress={onSubmitRating}
            disabled={pending !== ''}
            style={[st.primaryBtn, st.submitBtn, pending === 'rate' ? st.btnDisabled : null]}
          >
            <Text style={st.primaryBtnText}>{t(`${NS}.submitRating`)}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

/**
 * 布局骨架(与主题无关的那一维)留在这里,让 `Stars` 这类子组件也能拿到;
 * 颜色一律走 createStyles(tk),本表零色值。
 */
const styles = StyleSheet.create({
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
} satisfies Record<string, ViewStyle>)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
