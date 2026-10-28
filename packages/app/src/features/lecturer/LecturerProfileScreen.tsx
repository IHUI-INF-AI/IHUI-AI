// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Eye, PlayCircle } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { LecturerProfileScreenProps, LiveLecturerChannelItem } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

export type { LecturerProfileScreenProps, LiveLecturerChannelItem }

/** 详情页头像边长(web `h-20 w-20`) */
const AVATAR_SIZE = 80
/** 「直播中」角标的小圆点直径(web `h-1.5 w-1.5`) */
const LIVE_DOT_SIZE = 6

/**
 * LecturerProfileScreen 直播讲师详情(共享层)
 *
 * 2026-10-28 立,承载 web `/lecturers/[id]`
 * (apps/web/app/(main)/lecturers/[id]/PageClient.tsx):
 * - 结构:返回行 → 讲师卡(头像 80 / 姓名 / 头衔 / 简介保留换行)
 *   → 「讲师课程」区(频道卡:封面 + 直播中角标 + 标题 + 讲师名 + 观看数)
 * - 两段取数分开:讲师本体与频道是两个独立端点,故**两套状态**
 *   (`loading`/`error` 管本屏主体,`channelsLoading`/`channelsError` 只管课程区);
 *   web 也是两个 query,不把它们耦合成一个 loading 才不会「课程慢把整页拖白」
 * - 不存在 vs 失败:后端 `GET /api/live/lecturers/:id` 查不到是 **404 + error**,
 *   宿主归一后传 `lecturer === null && error === ''`,本屏渲染「讲师不存在」;
 *   有 `error` 才是真失败(可重试)。两格分开,不拿「不存在」骗用户点重试
 * - 平台无关:取数/导航由 wrapper 注入;频道点击经 `onOpenChannel` 上抛(web 跳 `/live/[id]`)
 * - 样式:getTokens(colorScheme) 语义 token(零 hex),间距走 rnSpacing/rnType/rnRadius
 * - i18n:lecturer.*(与 web 词包同键,zh-CN 取自 web 中文)+ common.retry
 */
export function LecturerProfileScreen({
  t,
  lecturer,
  channels,
  loading,
  channelsLoading = false,
  error,
  channelsError = '',
  onBack,
  onRetry,
  onRetryChannels,
  onOpenChannel,
  colorScheme = 'light',
}: LecturerProfileScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 返回行常驻:三种状态都留一条退路(web 的 notFound 分支也带「返回讲师列表」) */
  const backRow = (
    <View style={styles.backRow}>
      <BackChevron onPress={onBack} label={t('lecturer.backToList')} colorScheme={colorScheme} />
    </View>
  )

  if (loading && !lecturer) {
    return (
      <View style={styles.container}>
        {backRow}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error && !lecturer) {
    return (
      <View style={styles.container}>
        {backRow}
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  if (!lecturer) {
    return (
      <View style={styles.container}>
        {backRow}
        <ErrorState message={t('lecturer.notFound')} colorScheme={colorScheme} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {backRow}
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileCard}>
          {lecturer.avatar ? (
            <Image source={{ uri: lecturer.avatar }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{lecturer.name.slice(0, 1)}</Text>
            </View>
          )}
          <View style={styles.profileBody}>
            <Text style={styles.profileName}>{lecturer.name}</Text>
            {lecturer.title ? <Text style={styles.profileTitle}>{lecturer.title}</Text> : null}
            {lecturer.intro ? <Text style={styles.profileIntro}>{lecturer.intro}</Text> : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('lecturer.courses')}</Text>

        {channelsLoading ? (
          <ScreenSkeleton variant="card" count={2} colorScheme={colorScheme} />
        ) : channelsError ? (
          <ErrorState
            message={channelsError}
            onRetry={onRetryChannels ?? onRetry}
            retryLabel={t('common.retry')}
            colorScheme={colorScheme}
          />
        ) : channels.length === 0 ? (
          <EmptyState glyph="◎" title={t('lecturer.noCourses')} colorScheme={colorScheme} />
        ) : (
          channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              t={t}
              channel={channel}
              tk={tk}
              styles={styles}
              onPress={onOpenChannel ? () => onOpenChannel(channel) : undefined}
              colorScheme={colorScheme}
            />
          ))
        )}
      </ScrollView>
    </View>
  )
}

/* ── 私有:频道卡(封面 + 直播中角标 + 标题 + 讲师名 + 观看数) ── */

function ChannelCard({
  t,
  channel,
  tk,
  styles,
  onPress,
  colorScheme,
}: {
  t: LecturerProfileScreenProps['t']
  channel: LiveLecturerChannelItem
  tk: AppThemeTokens
  styles: ReturnType<typeof createStyles>
  onPress?: () => void
  colorScheme: 'light' | 'dark'
}) {
  return (
    <PressableCard style={styles.channelCard} onPress={onPress} colorScheme={colorScheme}>
      <View style={styles.coverWrap}>
        {channel.coverImage ? (
          <Image source={{ uri: channel.coverImage }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <PlayCircle size={32} color={tk.text.tertiary} strokeWidth={1.5} />
          </View>
        )}
        {channel.isLive ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>{t('lecturer.liveNow')}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.channelBody}>
        <Text style={styles.channelTitle} numberOfLines={2}>
          {channel.title}
        </Text>
        <Text style={styles.channelLecturer} numberOfLines={1}>
          {channel.lecturerName ?? t('lecturer.unknownLecturer')}
        </Text>
        <View style={styles.channelMetaRow}>
          <Eye size={13} color={tk.text.tertiary} strokeWidth={2} />
          <Text style={styles.channelMeta}>
            {t('lecturer.viewCount', { count: channel.viewCount })}
          </Text>
        </View>
      </View>
    </PressableCard>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    /* 返回行 */
    backRow: {
      paddingHorizontal: rnSpacing.md,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    scroll: {
      paddingHorizontal: rnSpacing.md,
      paddingBottom: rnSpacing['3xl'],
    },
    /* 讲师卡 */
    profileCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.md,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    /* 圆形头像取「边长的一半」作半径 —— 档位表最大档只有 16,取档位会把 80px 头像压成圆角方块 */
    profileAvatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: tk.surface.muted,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      fontSize: 28,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    /* flexShrink 不可省:长姓名/长简介必须压缩这一列,而不是把头像挤出卡外 */
    profileBody: {
      flex: 1,
      flexShrink: 1,
      gap: rnSpacing.xs,
    },
    profileName: {
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    profileTitle: {
      fontSize: rnType.label.size,
      color: tk.brandAccent.deep,
    },
    profileIntro: {
      marginTop: rnSpacing.xs,
      fontSize: rnType.label.size,
      lineHeight: 21,
      color: tk.text.secondary,
    },
    sectionTitle: {
      marginTop: rnSpacing.lg,
      marginBottom: rnSpacing.sm,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    /* 频道卡 */
    channelCard: {
      marginBottom: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      overflow: 'hidden',
    },
    coverWrap: {
      height: 132,
      backgroundColor: tk.surface.muted,
    },
    cover: {
      width: '100%',
      height: '100%',
    },
    coverPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    liveBadge: {
      position: 'absolute',
      top: rnSpacing.sm,
      left: rnSpacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.danger.DEFAULT,
    },
    liveDot: {
      width: LIVE_DOT_SIZE,
      height: LIVE_DOT_SIZE,
      borderRadius: LIVE_DOT_SIZE / 2,
      backgroundColor: tk.surface.light,
    },
    liveBadgeText: {
      fontSize: rnType.caption.size,
      fontWeight: '500',
      color: tk.surface.light,
    },
    channelBody: {
      padding: rnSpacing.md,
      gap: rnSpacing.xs,
    },
    channelTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    channelLecturer: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    channelMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    channelMeta: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
  } satisfies Record<string, ViewStyle | TextStyle | ImageStyle>)
}
