// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Calendar, Download, Star, User, Wand2 } from 'lucide-react-native'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import type { SkillMarketDetailScreenProps, SkillMarketEntryView } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

export type { SkillMarketDetailScreenProps, SkillMarketEntryView }

/** 星行几何与主题无关(只有颜色走 token),故不进 createStyles */
const starStyle = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 1 },
})

/** 五星(满星按 round(score),只读展示)—— 与 web `RatingStars` 同口径 */
function RatingStars({ score, colorScheme }: { score: number; colorScheme: 'light' | 'dark' }) {
  const tk = getTokens(colorScheme)
  const filled = Math.round(score)
  return (
    <View style={starStyle.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          color={i <= filled ? tk.warning.DEFAULT : tk.text.tertiary}
          fill={i <= filled ? tk.warning.DEFAULT : 'transparent'}
          strokeWidth={2}
        />
      ))}
    </View>
  )
}

/** ISO → `YYYY-MM-DD`(与同批 KnowledgeEntryReadingScreen 同格式) */
function formatDate(value?: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * SkillMarketDetailScreen 技能市场详情页(共享层)
 *
 * 2026-10-28 补屏立,承载 web `/skills-market/[id]`
 * (apps/web/app/(main)/skills-market/[id]/PageClient.tsx)。
 *
 * 基准端的详情**不是独立页**,是列表页里的一个弹层,`[id]` 薄壳只把 URL 里的 name
 * 交给 `deepLinkName` 反查后自动打开同一份弹层(刻意不新增详情端点)。RN 端把它落成
 * 独立屏,信息结构取弹层那份:
 * - 头:名称 + 版本徽章 + 许可协议徽章(VCC 形,不画圆点)
 * - 元信息:星级 + 平均分 + 评分条数 / 安装量 / 作者
 * - 正文:描述、全部标签、(后端给了才有的)更新时间
 * - 空态:`entry === null` 时回显「未找到该 Skill + 你查的 name」并给返回出口
 *   (下架即隐身:列表端点不返回 `enabled === false` 的条目,"从没有过"与"已下架"同果)
 *
 * **不承载**弹层里的订阅开关 / 评分表单 / 上下架按钮:它们各自要
 * `/api/skills/:name/{subscribe,rate,listing,ownership}` 四条写端点与登录态门,
 * 属另一条写链路;本屏是只读详情,取数(按 name 反查)与导航全在宿主。
 */
export function SkillMarketDetailScreen({
  t,
  name,
  entry,
  loading,
  error,
  onBack,
  onRetry,
  colorScheme = 'light',
}: SkillMarketDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const header = (
    <View style={styles.headerBar}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {t('skillsMarket.detailTitle')}
      </Text>
      {/* 右侧占位:与左侧返回键等宽,标题才是真居中而不是被按钮挤偏 */}
      <View style={styles.headerSpacer} />
    </View>
  )

  if (loading && !entry) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && !entry) {
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

  if (!entry) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          glyph="◍"
          title={t('skillsMarket.notFoundTitle')}
          desc={t('skillsMarket.notFoundHint', { name })}
          actionLabel={t('skillsMarket.backToMarket')}
          onAction={onBack}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  const updated = formatDate(entry.updatedAt)

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Wand2 size={20} color={tk.brandAccent.deep} strokeWidth={2} />
          </View>
          <View style={styles.titleMain}>
            <Text style={styles.name}>{entry.name}</Text>
            <View style={styles.badgeRow}>
              {entry.version ? (
                <View style={styles.badgePrimary}>
                  <Text style={styles.badgePrimaryText}>v{entry.version}</Text>
                </View>
              ) : null}
              {entry.license ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{entry.license}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <RatingStars score={entry.rating} colorScheme={colorScheme} />
            <Text style={styles.metaStrong}>{entry.rating.toFixed(1)}</Text>
            <Text style={styles.meta}>
              {entry.ratingCount > 0
                ? t('skillsMarket.ratingCount', { count: entry.ratingCount })
                : t('skillsMarket.noRatings')}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Download size={13} color={tk.text.tertiary} strokeWidth={2} />
            <Text style={styles.meta}>
              {t('skillsMarket.installs', { count: entry.installCount })}
            </Text>
          </View>
          {entry.author ? (
            <View style={styles.metaRow}>
              <User size={13} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaLabel}>{t('skillsMarket.author')}</Text>
              <Text style={styles.metaValue}>{entry.author}</Text>
            </View>
          ) : null}
          {updated ? (
            <View style={styles.metaRow}>
              <Calendar size={13} color={tk.text.tertiary} strokeWidth={2} />
              <Text style={styles.metaLabel}>{t('skillsMarket.updatedAt')}</Text>
              <Text style={styles.metaValue}>{updated}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>{t('skillsMarket.description')}</Text>
        <View style={styles.card}>
          <Text style={styles.desc} selectable>
            {entry.description || '-'}
          </Text>
        </View>

        {entry.tags.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{t('skillsMarket.tagsLabel')}</Text>
            <View style={styles.tagRow}>
              {entry.tags.map((tg) => (
                <View key={tg} style={styles.tagPill}>
                  <Text style={styles.tagPillText}>{tg}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: {
      flexShrink: 1,
      fontSize: rnType.title.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    headerSpacer: {
      width: 32,
    },
    scroll: {
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.sm,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: rnRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.brandAccent.light,
    },
    titleMain: {
      flex: 1,
      flexShrink: 1,
      gap: rnSpacing.xs,
    },
    name: {
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: rnSpacing.xs,
    },
    badgePrimary: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 1,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brandAccent.light,
    },
    badgePrimaryText: {
      fontSize: rnType.caption.size,
      fontWeight: '600',
      color: tk.brandAccent.deep,
    },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 1,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.surface.muted,
    },
    badgeText: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    metaCard: {
      marginTop: rnSpacing.md,
      padding: rnSpacing.md,
      gap: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: rnSpacing.xs,
    },
    metaStrong: {
      fontSize: rnType.label.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    meta: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    metaLabel: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    metaValue: {
      fontSize: rnType.label.size,
      color: tk.text.primary,
    },
    sectionLabel: {
      marginTop: rnSpacing.lg,
      marginBottom: rnSpacing.xs,
      fontSize: rnType.caption.size,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: tk.text.secondary,
    },
    card: {
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    desc: {
      fontSize: rnType.body.size,
      lineHeight: 22,
      color: tk.text.primary,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.xs,
    },
    tagPill: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.surface.muted,
    },
    tagPillText: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
