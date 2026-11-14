// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { Heart, MessageSquare, Share2, Star } from 'lucide-react-native'
import type { PostActionHandlers, PostActionId } from '@ihui/shared/social/post-actions'
import { projectPostActions } from '@ihui/shared/social/post-actions'

/**
 * 契约里的图标名 → RN 图标组件。
 *
 * 为什么用映射而不是让契约直接带组件:契约是纯数据文件(三端都 import),
 * 若它 import lucide 就绑死了 RN 侧实现,小程序端无法消费。
 */
function actionIcon(id: PostActionId) {
  switch (id) {
    case 'like':
      return Heart
    case 'comment':
      return MessageSquare
    case 'favorite':
      return Star
    case 'share':
      return Share2
    default:
      return Heart
  }
}
import type { PostDetailScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { assertRequiredPort } from '../../host/ports'

/**
 * 动态详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染返回按钮 + 标题 + 作者/圈子/时间 metaRow
 * + 内容 + 点赞评论 statRow + loading / error 态。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function PostDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  onRetry,
  colorScheme = 'light',
  onNavigate,
  onToast,
  actionHandlers,
}: PostDetailScreenProps & {
  onRetry?: () => void
  /**
   * 动作栏回调(可选)。**没给 = 该项只读**。
   * 为什么不放在 PostDetailScreenProps 里:该接口是跨端契约面,加字段要三端同时理解;
   * 动作栏当前只有部分端有写能力,用局部可选参数表达"这端有没有这个能力"更诚实。
   */
  actionHandlers?: PostActionHandlers
}) {
  assertRequiredPort('onNavigate', onNavigate)
  assertRequiredPort('onToast', onToast)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const imageUrls =
    typeof item?.imgs === 'string'
      ? item.imgs
          .split(',')
          .map((url) => url.trim())
          .filter(Boolean)
      : (item?.imgs ?? [])

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error || !item) {
    return (
      <ErrorState
        message={error || t('postDetail.loadFailed')}
        onRetry={onRetry}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <ScrollView style={styles.container}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{item.author}</Text>
        {item.circleName ? <Text style={styles.circle}>#{item.circleName}</Text> : null}
        <Text style={styles.meta}>{item.createdAt}</Text>
      </View>
      <Text style={styles.content}>{item.content}</Text>
      {imageUrls.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imageRow}
        >
          {imageUrls.map((url, index) => (
            // 图片同样只读:共享屏 props 里没有"看大图"端口,原先包一层 TouchableOpacity
            // 只是让图片按下去变暗再弹回,没有任何后续。改 View 后视觉不变、不再假装可点。
            <View key={`${url}-${index}`}>
              <Image source={{ uri: url }} style={styles.detailImage} />
            </View>
          ))}
        </ScrollView>
      ) : null}
      {item.types?.length || item.categories?.length ? (
        <Text style={styles.detailText}>
          类型：{item.types?.join('、') || '-'} 分类：{item.categories?.join('、') || '-'}
        </Text>
      ) : null}
      {item.taskStatus || item.status ? (
        <Text style={styles.detailText}>
          任务状态：{item.taskStatus || '-'} 审核状态：{item.status || '-'}
        </Text>
      ) : null}
      {item.lowestPrice !== null ||
      item.lowestPrice !== undefined ||
      item.peakPrice !== null ||
      item.peakPrice !== undefined ? (
        <Text style={styles.detailText}>
          价格：￥{item.lowestPrice ?? '-'} - ￥{item.peakPrice ?? '-'}
        </Text>
      ) : null}
      {item.cycle ? (
        <Text style={styles.detailText}>
          周期：{item.cycle}
          {item.cycleUnit ?? ''}
        </Text>
      ) : null}
      {item.closingTime ? (
        <Text style={styles.detailText}>截止时间：{item.closingTime}</Text>
      ) : null}
      {item.contact ? <Text style={styles.detailText}>联系方式：{item.contact}</Text> : null}
      {/* 互动动作栏:项数/顺序/可点性全部由 post-actions.contract 判定,不再在此硬编码。
          2026-11-14 的教训:这里曾写死两颗 TouchableOpacity —— 按下去会变暗、却什么都不发生,
          是标准的假按钮。契约里"没回调 ⇒ interactive=false ⇒ 渲染只读 View"就是那条判据的固化。 */}
      <View style={styles.statRow}>
        {projectPostActions(
          {
            likes: item.likes ?? 0,
            comments: item.comments ?? 0,
            favorites: item.favorites ?? 0,
            shares: item.shares ?? 0,
          },
          { liked: item.liked, favorited: item.favorited },
          actionHandlers,
        ).map((action) => {
          const Icon = actionIcon(action.id)
          const content = (
            <>
              <Icon
                size={12}
                color={action.active ? tk.brand.DEFAULT : tk.text.medium}
              />
              <Text style={styles.statText}>{action.count}</Text>
            </>
          )
          // 可点性由契约唯一判定:interactive=false 一律渲染只读 View
          return action.interactive ? (
            <TouchableOpacity
              key={action.id}
              style={styles.statBtn}
              onPress={action.onPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t(`postDetail.action.${action.id}`)}
            >
              {content}
            </TouchableOpacity>
          ) : (
            <View key={action.id} style={styles.statBtn}>
              {content}
            </View>
          )
        })}
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
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing['xs-loose'],
      marginBottom: rnSpacing.md,
    },
    author: { fontSize: rnType.body.size, color: tk.text.secondary, fontWeight: '500' },
    circle: {
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
      backgroundColor: tk.surface.card,
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
    },
    meta: { fontSize: rnType.caption.size, color: tk.text.medium },
    content: {
      fontSize: rnType.title.size,
      lineHeight: rnType.strong.lineHeight,
      color: tk.text.medium,
    },
    detailText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      lineHeight: rnType.body.lineHeight,
      color: tk.text.secondary,
    },
    statRow: { flexDirection: 'row', gap: rnSpacing.md, marginTop: rnSpacing.lg },
    statBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
    },
    statText: { fontSize: rnType.label.size, color: tk.text.medium },
    imageRow: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.sm,
      flexWrap: 'wrap',
    } as ViewStyle,
    detailImage: { width: 100, height: 100, borderRadius: rnRadius.lg } as ImageStyle,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
