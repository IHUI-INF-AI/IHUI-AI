// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Bell, BellOff, Download, Star, User, Wand2 } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'

const NS = 'skillMarketPage'

/** 单条评分行(时间已由薄壳按 locale 格式化) */
export interface SkillRatingRowView {
  id: string
  userName: string
  score: number
  comment?: string
  timeText: string
}

/**
 * 详情面数据(列表屏的弹层与深链直达屏共用同一份形状 —— 与 web 同口径:
 * `/skills-market/[id]` 不做第二套详情 UI,只把同一条目塞进同一个详情面)。
 */
export interface SkillDetailView {
  name: string
  description: string
  tags: string[]
  author: string
  version: string
  license: string
  rating: number
  ratingCount: number
  installCount: number
  subscribed: boolean
  subscriberCount: number
  ratings: SkillRatingRowView[]
  ratingsLoading: boolean
  ratingSubmitting: boolean
  subscribePending: boolean
}

export interface SkillMarketDetailViewProps {
  t: TFunction
  colorScheme: AppThemeMode
  detail: SkillDetailView
  /** 关闭(列表弹层 = 收起弹层;深链屏 = 回市场列表) */
  onClose: () => void
  onSubmitRating: (score: number, comment: string) => void
  onToggleSubscribe: () => void
}

/** 评分星(仅展示;满星按四舍五入,与 web RatingStars 同算法 @ web PageClient.tsx:359-374) */
export function RatingStars({
  score,
  size = 12,
  colorScheme,
}: {
  score: number
  size?: number
  colorScheme: AppThemeMode
}) {
  const tk = getTokens(colorScheme)
  return (
    <View style={starStyles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          color={i <= Math.round(score) ? tk.warning.DEFAULT : tk.text.tertiary}
          fill={i <= Math.round(score) ? tk.warning.DEFAULT : 'transparent'}
        />
      ))}
    </View>
  )
}

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 1 },
})

/**
 * Skill 详情面(平台无关共享组件)—— 承载 web `/skills-market` 的详情弹层与
 * `/skills-market/[id]` 深链详情(web 两处共用同一实现,见
 * apps/web/app/(main)/skills-market/PageClient.tsx:63-66,469-710)。
 *
 * 只渲染:条目元数据 + 订阅开关 + 评分列表 + 评分表单。
 * 取数 / 时间格式化 / 登录门 / 提交在途态全部由薄壳注入。
 * web 的 owner「上下架」按钮不在此渲染:RN 侧未承载 listing 交互(见 ledger note),
 * 不造点了没反应的按钮。
 */
export function SkillMarketDetailView({
  t,
  colorScheme,
  detail,
  onClose,
  onSubmitRating,
  onToggleSubscribe,
}: SkillMarketDetailViewProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [score, setScore] = useState(5)
  const [comment, setComment] = useState('')

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <Wand2 size={20} color={tk.text.primary} />
        </View>
        <View style={styles.headMain}>
          <Text style={styles.name}>{detail.name}</Text>
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>v{detail.version}</Text>
            </View>
            {detail.license ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{detail.license}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <RatingStars score={detail.rating} colorScheme={colorScheme} />
            <Text style={styles.metaText}>
              {detail.rating.toFixed(1)} · {t(`${NS}.ratingCount`, { count: detail.ratingCount })}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Download size={12} color={tk.text.tertiary} />
            <Text style={styles.metaText}>
              {t(`${NS}.installs`, { count: detail.installCount })}
            </Text>
            <User size={12} color={tk.text.tertiary} />
            <Text style={styles.metaText}>{detail.author}</Text>
          </View>
        </View>
      </View>

      {detail.description ? <Text style={styles.description}>{detail.description}</Text> : null}

      {detail.tags.length > 0 ? (
        <View style={styles.chipRow}>
          {detail.tags.map((tag) => (
            <View key={tag} style={styles.chip}>
              <Text style={styles.chipText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.primaryButton, detail.subscribePending && styles.buttonDisabled]}
          onPress={onToggleSubscribe}
          disabled={detail.subscribePending}
          accessibilityRole="button"
        >
          {detail.subscribePending ? (
            <ActivityIndicator size="small" color={tk.brand.foreground} />
          ) : detail.subscribed ? (
            <BellOff size={14} color={tk.brand.foreground} />
          ) : (
            <Bell size={14} color={tk.brand.foreground} />
          )}
          <Text style={styles.primaryButtonText}>
            {detail.subscribed ? t(`${NS}.unsubscribe`) : t(`${NS}.subscribe`)}
          </Text>
        </Pressable>
        <Pressable style={styles.outlineButton} onPress={onClose} accessibilityRole="button">
          <Text style={styles.outlineButtonText}>{t(`${NS}.close`)}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t(`${NS}.ratingsTitle`)}</Text>
        {detail.ratingsLoading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color={tk.text.secondary} />
            <Text style={styles.muted}>{t(`${NS}.loading`)}</Text>
          </View>
        ) : detail.ratings.length === 0 ? (
          <Text style={styles.muted}>{t(`${NS}.noRatings`)}</Text>
        ) : (
          detail.ratings.map((r) => (
            <View key={r.id} style={styles.ratingRow}>
              <View style={styles.ratingHead}>
                <Text style={styles.ratingUser}>{r.userName}</Text>
                <RatingStars score={r.score} size={10} colorScheme={colorScheme} />
                <Text style={styles.ratingTime}>{r.timeText}</Text>
              </View>
              {r.comment ? <Text style={styles.ratingComment}>{r.comment}</Text> : null}
            </View>
          ))
        )}
      </View>

      <View style={[styles.section, styles.rateBox]}>
        <Text style={styles.sectionTitle}>{t(`${NS}.rateTitle`)}</Text>
        <View style={styles.scoreRow} accessibilityLabel={t(`${NS}.yourScore`)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable
              key={i}
              onPress={() => setScore(i)}
              accessibilityRole="radio"
              accessibilityState={{ checked: i === score }}
              hitSlop={4}
            >
              <Star
                size={20}
                color={i <= score ? tk.warning.DEFAULT : tk.text.tertiary}
                fill={i <= score ? tk.warning.DEFAULT : 'transparent'}
              />
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder={t(`${NS}.commentPlaceholder`)}
          placeholderTextColor={tk.text.tertiary}
          multiline
        />
        <Pressable
          style={[styles.primaryButton, detail.ratingSubmitting && styles.buttonDisabled]}
          onPress={() => {
            if (detail.ratingSubmitting) return
            onSubmitRating(score, comment.trim())
          }}
          disabled={detail.ratingSubmitting}
          accessibilityRole="button"
        >
          {detail.ratingSubmitting ? (
            <ActivityIndicator size="small" color={tk.brand.foreground} />
          ) : null}
          <Text style={styles.primaryButtonText}>{t(`${NS}.submitRating`)}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { padding: rnSpacing.md, gap: rnSpacing.sm, paddingBottom: rnSpacing['2xl'] },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: rnSpacing.md },
    headIcon: {
      width: 44,
      height: 44,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headMain: { flex: 1, gap: 2 },
    name: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: rnSpacing.xs },
    chip: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
    },
    chipText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: rnSpacing.xs },
    metaText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    description: {
      fontSize: rnType.body.size,
      lineHeight: 20,
      color: tk.text.medium,
      marginTop: rnSpacing.xs,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.DEFAULT,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    primaryButtonText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brand.foreground },
    outlineButton: {
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    outlineButtonText: { fontSize: rnType.label.size, color: tk.text.primary },
    buttonDisabled: { opacity: 0.5 },
    section: {
      marginTop: rnSpacing.md,
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
      paddingTop: rnSpacing.md,
      gap: rnSpacing.sm,
    },
    sectionTitle: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.primary },
    inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    muted: { fontSize: rnType.caption.size, color: tk.text.secondary },
    ratingRow: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      padding: rnSpacing.sm,
      gap: 2,
    },
    ratingHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.xs },
    ratingUser: { fontSize: rnType.caption.size, fontWeight: '600', color: tk.text.primary },
    ratingTime: { fontSize: rnType.caption.size, color: tk.text.tertiary, marginLeft: 'auto' },
    ratingComment: { fontSize: rnType.caption.size, color: tk.text.secondary },
    rateBox: { gap: rnSpacing.sm },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    input: {
      minHeight: 64,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      textAlignVertical: 'top',
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
