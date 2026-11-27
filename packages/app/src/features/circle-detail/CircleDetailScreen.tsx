// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { MessageSquare } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CircleDetailItem, CircleDetailScreenProps, CirclePostItem } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 圈子详情/Props 类型 re-export(单一来源 @ihui/types) */
export type { CircleDetailItem, CircleDetailScreenProps, CirclePostItem }

/**
 * 圈子详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回)+ 标题 + 统计(成员数/帖子数)
 * + 描述 + 操作按钮(未加入:加入;已加入:成员/发帖/退出)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function CircleDetailScreen({
  t,
  item,
  loading,
  error,
  onJoin,
  onLeave,
  onPressPost,
  onPressMembers,
  onBack,
  onRetry,
  posts = [],
  postsLoading = false,
  postsError = '',
  colorScheme = 'light',
}: CircleDetailScreenProps & { onRetry?: () => void }) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }
  if (error || !item) {
    return (
      <View style={styles.container}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <ErrorState
          message={error || t('circleDetail.loadFailed')}
          onRetry={onRetry}
          retryLabel={onRetry ? t('common.retry') : undefined}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{item.name}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statBadge}>
          <Text style={styles.statText}>
            {item.memberCount} {t('circleDetail.members')}
          </Text>
        </View>
        <View style={styles.statBadge}>
          <Text style={styles.statText}>
            {item.postCount} {t('circleDetail.posts')}
          </Text>
        </View>
      </View>
      <Text style={styles.description}>{item.description || '—'}</Text>
      <View style={styles.actions}>
        {item.isJoined ? (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={onPressMembers}
            >
              <Text style={styles.actionBtnSecondaryText}>{t('circleDetail.membersAction')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={onPressPost}
            >
              <Text style={styles.actionBtnPrimaryText}>{t('circleDetail.post')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={onLeave}>
              <Text style={styles.actionBtnOutlineText}>{t('circleDetail.leave')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={onJoin}>
            <Text style={styles.actionBtnPrimaryText}>{t('circleDetail.join')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.postsSection}>
        <Text style={styles.postsTitle}>{t('circleDetail.posts')}</Text>
        {postsLoading ? (
          <View style={styles.postsState}>
            <ActivityIndicator color={tk.text.secondary} />
            <Text style={styles.postsStateText}>{t('circle.index.loading')}</Text>
          </View>
        ) : postsError ? (
          <Text style={styles.postsError}>{postsError}</Text>
        ) : posts.length === 0 ? (
          <Text style={styles.postsEmpty}>{t('circle.empty')}</Text>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <Text style={styles.postTitle} numberOfLines={2}>
                {post.title}
              </Text>
              {post.content ? (
                <Text style={styles.postContent} numberOfLines={3}>
                  {post.content}
                </Text>
              ) : null}
              <View style={styles.postMeta}>
                {post.authorName ? (
                  <Text style={styles.postMetaText} numberOfLines={1}>
                    {post.authorName}
                  </Text>
                ) : null}
                <Text style={styles.postMetaText}>{post.createdAt.slice(0, 10)}</Text>
                <View style={styles.postMetaStat}>
                  <MessageSquare size={12} color={tk.text.secondary} />
                  <Text style={styles.postMetaText}>{post.replyCount}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing['3xl'],
    },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    statsRow: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.md,
    },
    statBadge: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    statText: { fontSize: rnType.body.size, color: tk.text.secondary },
    description: {
      fontSize: rnType.title.size,
      lineHeight: rnType.strong.lineHeight,
      color: tk.text.primary,
    },
    actions: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xl,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.md,
      alignItems: 'center',
    },
    actionBtnPrimary: { backgroundColor: tk.brand.cta },
    actionBtnPrimaryText: {
      color: tk.surface.light,
      fontSize: rnType.title.size,
      fontWeight: '600',
    },
    actionBtnSecondary: {
      borderWidth: 1,
      borderColor: tk.brandAccent.deep,
      backgroundColor: tk.surface.bg,
    },
    actionBtnSecondaryText: {
      color: tk.brand.DEFAULT,
      fontSize: rnType.title.size,
      fontWeight: '600',
    },
    actionBtnOutline: {
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    actionBtnOutlineText: {
      color: tk.text.secondary,
      fontSize: rnType.title.size,
      fontWeight: '600',
    },
    postsSection: {
      marginTop: rnSpacing['2xl'],
      gap: rnSpacing.sm,
    },
    postsTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    postsState: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      paddingVertical: rnSpacing.xl,
    },
    postsStateText: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    postsError: {
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
      paddingVertical: rnSpacing.md,
    },
    postsEmpty: {
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      paddingVertical: rnSpacing.xl,
    },
    postCard: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tk.border.light,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.card,
      padding: rnSpacing.md,
      gap: rnSpacing.xs,
    },
    postTitle: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    postContent: {
      fontSize: rnType.label.size,
      lineHeight: rnType.label.lineHeight,
      color: tk.text.secondary,
    },
    postMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
    },
    postMetaText: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    postMetaStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['2xs'],
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
