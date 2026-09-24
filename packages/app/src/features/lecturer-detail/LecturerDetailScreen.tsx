// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ChevronLeft, Star } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  LecturerDetailCourse,
  LecturerDetailInfo,
  LecturerDetailReview,
  LecturerDetailScreenProps,
} from '../../types'

import { rnRadius } from '@ihui/design-tokens'

/** 讲师详情共享屏 — props 注入式跨端组件 */
export type {
  LecturerDetailCourse,
  LecturerDetailInfo,
  LecturerDetailReview,
  LecturerDetailScreenProps,
}

/**
 * LecturerDetailScreen 讲师详情(共享层)
 *
 * 2026-09-14 承接 mobile-rn TeacherDetailScreen(P0 补页 7585d0493)1:1 迁移,
 * 对齐 miniapp pages/teacher/detail:
 * - 结构:头部(头像/姓名/金牌徽章/头衔/关注)→ 统计行 → 简介(>60 字展开收起)
 *   → 主讲课程卡(onOpenCourse)→ 学员评价 → 底部「联系讲师」条
 * - 平台无关:API(fetchApi /teacher/:id*)、导航、Alert/ActionSheet 由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex);尺寸 750 设计稿 rpx 值按 /2 转 dp
 * - i18n:沿用 teacher.detail.*(mobile-rn i18n 既有 key)
 */
export function LecturerDetailScreen({
  t,
  info,
  courses,
  reviews,
  loading,
  error,
  onToggleFollow,
  onContact,
  onOpenCourse,
  onBack,
  colorScheme = 'light',
}: LecturerDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 简介超过该字数显示展开/收起(对齐 miniapp 60 字阈值) */
  const INTRO_COLLAPSE_LEN = 60
  const [introExpanded, setIntroExpanded] = useState(false)

  const intro = info?.intro ?? ''
  const introOverflow = intro.length > INTRO_COLLAPSE_LEN
  const introText =
    introOverflow && !introExpanded ? `${intro.slice(0, INTRO_COLLAPSE_LEN)}…` : intro

  const statItems: Array<{ label: string; value: string }> = [
    { label: t('teacher.detail.fans'), value: formatStudents(info?.fans) },
    { label: t('teacher.detail.courses'), value: String(info?.courseCount ?? 0) },
    { label: t('teacher.detail.students'), value: formatStudents(info?.studentCount) },
    { label: t('teacher.detail.rating'), value: String(info?.rating ?? 0) },
  ]

  const following = info?.isFollowing ?? false

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Header title={t('teacher.list.title')} onBack={onBack} styles={styles} />
        <ActivityIndicator color={tk.text.secondary} />
      </View>
    )
  }

  if (error && !info) {
    return (
      <View style={styles.container}>
        <Header title={t('teacher.list.title')} onBack={onBack} styles={styles} />
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Header title={info?.nickname ?? t('teacher.list.title')} onBack={onBack} styles={styles} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 头部:头像 + 姓名/金牌徽章/头衔 + 关注按钮 */}
        <View style={styles.header}>
          {info?.avatar ? (
            <Image source={{ uri: info.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{(info?.nickname ?? '').slice(0, 1)}</Text>
            </View>
          )}
          <View style={styles.headerBody}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {info?.nickname ?? ''}
              </Text>
              {info?.isGold ? (
                <View style={styles.goldBadge}>
                  <Text style={styles.goldBadgeText}>{t('teacher.detail.goldBadge')}</Text>
                </View>
              ) : null}
            </View>
            {info?.title ? (
              <Text style={styles.title} numberOfLines={1}>
                {info.title}
              </Text>
            ) : null}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.followBtn,
              following ? styles.followBtnActive : null,
              pressed ? styles.pressed : null,
            ]}
            onPress={onToggleFollow}
            accessibilityRole="button"
            accessibilityLabel={
              following ? t('teacher.detail.following') : t('teacher.detail.follow')
            }
          >
            <Text style={following ? styles.followBtnTextActive : styles.followBtnText}>
              {following ? t('teacher.detail.following') : t('teacher.detail.follow')}
            </Text>
          </Pressable>
        </View>

        {/* 统计行:粉丝/课程/学员/评分 */}
        <View style={styles.statRow}>
          {statItems.map((s) => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* 简介:超长可展开/收起 */}
        {intro ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('teacher.detail.intro')}</Text>
            <Text style={styles.introText}>{introText}</Text>
            {introOverflow ? (
              <Pressable onPress={() => setIntroExpanded((v) => !v)} hitSlop={8}>
                <Text style={styles.expandText}>
                  {introExpanded ? t('teacher.detail.collapse') : t('teacher.detail.expand')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* 主讲课程:卡片点击回调 onOpenCourse(路由跳转由 wrapper 决定) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('teacher.detail.courseSection')}</Text>
          {courses.length === 0 ? (
            <Text style={styles.emptyText}>{t('teacher.detail.noCourses')}</Text>
          ) : (
            courses.map((c) => (
              <Pressable
                key={c.id}
                style={({ pressed }) => [styles.courseCard, pressed ? styles.pressed : null]}
                onPress={() => onOpenCourse(c.id)}
                accessibilityRole="button"
                accessibilityLabel={c.title}
              >
                {c.coverUrl ? (
                  <Image source={{ uri: c.coverUrl }} style={styles.courseCover} />
                ) : (
                  <View style={[styles.courseCover, styles.courseCoverFallback]} />
                )}
                <View style={styles.courseBody}>
                  <Text style={styles.courseTitle} numberOfLines={2}>
                    {c.title}
                  </Text>
                  <View style={styles.courseMetaRow}>
                    {typeof c.price === 'number' && c.price > 0 ? (
                      <Text style={styles.coursePrice}>¥{fenToYuan(c.price)}</Text>
                    ) : (
                      <Text style={styles.courseFree}>{t('common.free')}</Text>
                    )}
                    <Text style={styles.courseStudents}>
                      {formatStudents(c.students)} {t('teacher.detail.learnUnit')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* 学员评价:头像/昵称/星级/内容/时间 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('teacher.detail.reviewSection')}</Text>
          {reviews.length === 0 ? (
            <Text style={styles.emptyText}>{t('teacher.detail.noReviews')}</Text>
          ) : (
            reviews.map((r, idx) => {
              const stars = Math.round(r.rating ?? 0)
              return (
                <View key={r.id ?? String(idx)} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    {r.avatar ? (
                      <Image source={{ uri: r.avatar }} style={styles.reviewAvatar} />
                    ) : (
                      <View style={[styles.reviewAvatar, styles.avatarFallback]}>
                        <Text style={styles.reviewAvatarText}>
                          {(r.nickname ?? '').slice(0, 1)}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.reviewNickname} numberOfLines={1}>
                      {r.nickname ?? ''}
                    </Text>
                    <View style={styles.starRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          color={i < stars ? tk.vip.gold : tk.border.light}
                          fill={i < stars ? tk.vip.gold : undefined}
                        />
                      ))}
                    </View>
                  </View>
                  {r.content ? <Text style={styles.reviewContent}>{r.content}</Text> : null}
                  {r.time ? <Text style={styles.reviewTime}>{r.time}</Text> : null}
                </View>
              )
            })
          )}
        </View>
      </ScrollView>

      {/* 底部动作条:联系讲师(私信/电话选项由 wrapper 的 onContact 决定) */}
      <View style={styles.footerBar}>
        <Pressable
          style={({ pressed }) => [styles.footerBtn, pressed ? styles.pressed : null]}
          onPress={onContact}
          accessibilityRole="button"
          accessibilityLabel={t('teacher.detail.contact')}
        >
          <Text style={styles.footerBtnText}>{t('teacher.detail.contact')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

// ── 私有:顶部导航行(返回箭头 + 标题,替代 RN 端 NavBar) ──

function Header({
  title,
  onBack,
  styles,
}: {
  title: string
  onBack: () => void
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <View style={styles.headerBar}>
      <Pressable
        style={styles.headerBackBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="back"
      >
        <ChevronLeft size={22} color={styles.headerIcon.color} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSidePlaceholder} />
    </View>
  )
}

// ── 工具(对齐 miniapp formatPrice/formatStudents) ──

/** 分转元(对齐 miniapp formatPrice) */
function fenToYuan(cents?: number): string {
  if (typeof cents !== 'number') return ''
  return (cents / 100).toFixed(2)
}

/** 人数格式化:>=1万 → x.xw;>=1000 → x.xk(对齐 miniapp formatStudents) */
function formatStudents(n?: number): string {
  const v = n ?? 0
  if (v >= 10000) return `${(v / 10000).toFixed(1)}w`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(v)
}

/**
 * 样式:750 设计稿 rpx 值 / 2 转 dp(共享层惯例,对齐 packages/app 其他迁移屏)。
 * 全部颜色走 AppThemeTokens 语义 token,零 hex。
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
      gap: 8, // rpx(16)
    },
    scrollContent: {
      padding: 12, // rpx(24)
      paddingBottom: 24, // rpx(48)
      gap: 12, // rpx(24)
    },
    pressed: {
      opacity: 0.85,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      paddingHorizontal: 10,
    },
    headerBackBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIcon: {
      color: tk.brand.DEFAULT,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
      textAlign: 'center',
    },
    headerSidePlaceholder: {
      width: 32,
    },
    /* 头部 */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12, // rpx(24)
    },
    avatar: {
      width: 64, // rpx(128)
      height: 64, // rpx(128)
      borderRadius: 64 / 2, // radius-exempt: 讲师头像几何正圆(64dp 直径/2)
      backgroundColor: tk.surface.muted,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      fontSize: 24,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    headerBody: {
      flex: 1,
      gap: 4, // rpx(8)
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6, // rpx(12)
    },
    name: {
      fontSize: 18,
      fontWeight: '600',
      color: tk.text.primary,
      flexShrink: 1,
    },
    goldBadge: {
      paddingHorizontal: 6, // rpx(12)
      paddingVertical: 2, // rpx(4)
      borderRadius: rnRadius.sm, // rpx(8)
      backgroundColor: tk.vip.gold,
    },
    goldBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: tk.text.primary,
    },
    title: {
      fontSize: 13,
      color: tk.text.secondary,
    },
    followBtn: {
      paddingHorizontal: 14, // rpx(28)
      paddingVertical: 6, // rpx(12)
      borderRadius: rnRadius['2xl'], // rpx(32)
      backgroundColor: tk.brand.cta,
    },
    followBtnActive: {
      backgroundColor: tk.surface.muted,
    },
    followBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.surface.light,
    },
    followBtnTextActive: {
      fontSize: 13,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    /* 统计行 */
    statRow: {
      flexDirection: 'row',
      paddingVertical: 12, // rpx(24)
      borderRadius: rnRadius.lg, // rpx(16)
      backgroundColor: tk.surface.card,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4, // rpx(8)
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
    },
    statLabel: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    /* 区块通用 */
    section: {
      gap: 8, // rpx(16)
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
    },
    introText: {
      fontSize: 13,
      lineHeight: 20,
      color: tk.text.secondary,
    },
    expandText: {
      fontSize: 13,
      color: tk.brandAccent.deep,
    },
    /* 主讲课程 */
    courseCard: {
      flexDirection: 'row',
      gap: 10, // rpx(20)
      padding: 10, // rpx(20)
      borderRadius: rnRadius.lg, // rpx(16)
      backgroundColor: tk.surface.card,
    },
    courseCover: {
      width: 96, // rpx(192)
      height: 60, // rpx(120)
      borderRadius: rnRadius.md, // rpx(12)
      backgroundColor: tk.surface.muted,
    },
    courseCoverFallback: {},
    courseBody: {
      flex: 1,
      justifyContent: 'space-between',
      gap: 6, // rpx(12)
    },
    courseTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    courseMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8, // rpx(16)
    },
    coursePrice: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.vip.gold,
    },
    courseFree: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.success.deepText,
    },
    courseStudents: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    /* 学员评价 */
    reviewCard: {
      gap: 6, // rpx(12)
      padding: 10, // rpx(20)
      borderRadius: rnRadius.lg, // rpx(16)
      backgroundColor: tk.surface.card,
    },
    reviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8, // rpx(16)
    },
    reviewAvatar: {
      width: 32, // rpx(64)
      height: 32, // rpx(64)
      borderRadius: rnRadius['2xl'], // rpx(32)
      backgroundColor: tk.surface.muted,
    },
    reviewAvatarText: {
      fontSize: 12,
      color: tk.text.secondary,
    },
    reviewNickname: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: tk.text.primary,
    },
    starRow: {
      flexDirection: 'row',
      gap: 2,
    },
    reviewContent: {
      fontSize: 13,
      lineHeight: 19,
      color: tk.text.secondary,
    },
    reviewTime: {
      fontSize: 11,
      color: tk.text.tertiary,
    },
    /* 底部动作条 */
    footerBar: {
      paddingHorizontal: 12, // rpx(24)
      paddingVertical: 8, // rpx(16)
      borderTopWidth: 1,
      borderTopColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    footerBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12, // rpx(24)
      borderRadius: rnRadius['2xl'], // 原 rpx(44)=22,R1 吸附至 2xl(16)
      backgroundColor: tk.brand.cta,
    },
    footerBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.surface.light,
    },
    emptyText: {
      fontSize: 13,
      color: tk.text.tertiary,
    },
  } satisfies Record<string, ViewStyle | TextStyle | ImageStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
