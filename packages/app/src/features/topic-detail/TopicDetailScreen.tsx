// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 话题详情共享屏 — 跨端唯一真相源(props 注入式,mobile-rn 与 miniapp-taro 共同对齐这一份)
 *
 * 平台无关:话题头部(#名称/简介/关注数)、关注按钮(brand.cta 成对)、发布入口、
 * 帖子流卡片(头像/作者/时间/标题/内容/图组/点赞评论)与加载态,全部在此渲染。
 * 平台特定(导航落点、取数、提示弹窗、页面级导航栏)由调用方经 props 注入;
 * 时间相对化两端共用 @ihui/shared/utils/date-utils(≤24h 相对,>24h 日期),禁止端内另写一份。
 */
import { useMemo } from 'react'
import { FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native'
import { Heart, MessageCircle, PenLine } from 'lucide-react-native'
import { formatDateByTemplate, formatRelativeTime } from '@ihui/shared/utils/date-utils'
import { getTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'
import { createTopicDetailStyles } from './topic-detail-styles'

export interface TopicDetailPostView {
  id: string | number
  title?: string
  content: string
  images?: string[]
  author?: string
  avatar?: string
  createTime: string
  likes?: number
  comments?: number
}

export interface TopicDetailView {
  id?: string
  name?: string
  description?: string
  followerCount?: number
  isFollowed?: boolean
}

export interface TopicDetailScreenProps {
  t: (key: string, vars?: Record<string, string | number>) => string
  colorScheme?: 'light' | 'dark'
  /** 相对时间取语种(date-utils/Intl 口径),缺省 zh-CN */
  locale?: string
  topic: TopicDetailView
  /** 当前已展示页的帖子切片(分页游标由端侧管理) */
  posts: readonly TopicDetailPostView[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  hasMore: boolean
  followBusy?: boolean
  onBack: () => void
  onFollow: () => void
  onPublish: () => void
  onPostPress: (id: string) => void
  onLoadMore: () => void
  onRefresh: () => void
}

const DAY_MS = 86_400_000

/** 帖子流时间:≤24h 相对化,>24h 落 YYYY-MM-DD(date-utils 单源实现) */
export function topicFeedTime(value: string, locale = 'zh-CN'): string {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return value
  if (Date.now() - then < DAY_MS) return formatRelativeTime(value, locale)
  return formatDateByTemplate(value, 'YYYY-MM-DD')
}

export function TopicDetailScreen({
  t,
  colorScheme = 'light',
  locale = 'zh-CN',
  topic,
  posts,
  loading,
  refreshing,
  loadingMore,
  hasMore,
  followBusy = false,
  onBack,
  onFollow,
  onPublish,
  onPostPress,
  onLoadMore,
  onRefresh,
}: TopicDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createTopicDetailStyles(tk), [tk])

  const renderPost = ({ item }: { item: TopicDetailPostView }) => (
    // 卡片无边距(内容自定高)⇒ 外层不设 style,命中盒等于卡片可视盒;pressed 淡出落内层数组形态。
    <Pressable onPress={() => onPostPress(String(item.id))} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.post, pressed ? styles.cardPressed : null]}>
          <View style={styles.postUser}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar} />
            )}
            <View style={styles.userInfo}>
              <Text style={styles.author}>{item.author || t('topic.detail.anonymous')}</Text>
              <Text style={styles.time}>{topicFeedTime(item.createTime, locale)}</Text>
            </View>
          </View>
          {item.title ? (
            <Text style={styles.postTitle} numberOfLines={2}>
              {item.title}
            </Text>
          ) : null}
          <Text style={styles.postContent} numberOfLines={3}>
            {item.content}
          </Text>
          {item.images && item.images.length > 0 ? (
            <View style={styles.imgRow}>
              {item.images.slice(0, 3).map((img, i) => (
                <Image key={i} source={{ uri: img }} style={styles.postImg} />
              ))}
              {item.images.length > 3 ? (
                <View style={[styles.postImg, styles.imgMore]}>
                  <Text style={styles.imgMoreText}>{`+${item.images.length - 3}`}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.postFooter}>
            <View style={styles.stat}>
              <Heart size={14} color={tk.text.tertiary} />
              <Text style={styles.statNum}>{item.likes ?? 0}</Text>
            </View>
            <View style={styles.stat}>
              <MessageCircle size={14} color={tk.text.tertiary} />
              <Text style={styles.statNum}>{item.comments ?? 0}</Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  )

  return (
    <View style={styles.container}>
      <View style={styles.navRow}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.navTitle}>{t('topic.detail.pageTitle')}</Text>
      </View>
      {topic.name ? (
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.topicName}>{`#${topic.name}`}</Text>
            {topic.description ? <Text style={styles.topicDesc}>{topic.description}</Text> : null}
            <Text style={styles.followers}>
              {t('topic.detail.followers', { n: topic.followerCount ?? 0 })}
            </Text>
          </View>
          <Pressable
            style={[styles.followBtn, topic.isFollowed ? styles.followBtnActive : null]}
            disabled={followBusy}
            onPress={onFollow}
            accessibilityRole="button"
          >
            <Text
              style={[styles.followBtnText, topic.isFollowed ? styles.followBtnTextActive : null]}
            >
              {topic.isFollowed ? t('topic.detail.following') : t('topic.detail.follow')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {topic.name ? (
        // publishBar 是通栏行盒 ⇒ 外层不设 style,通栏宽度由父列默认拉伸保持。
        <Pressable onPress={onPublish} accessibilityRole="button">
          {({ pressed }) => (
            <View style={[styles.publishBar, pressed ? styles.cardPressed : null]}>
              <PenLine size={15} color={tk.text.tertiary} />
              <Text style={styles.publishText} numberOfLines={1}>
                {t('topic.detail.publishPlaceholder')}
              </Text>
              <Text style={styles.publishBtn}>{t('topic.detail.publish')}</Text>
            </View>
          )}
        </Pressable>
      ) : null}
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.2}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tk.text.secondary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
          ) : (
            <EmptyState title={t('topic.detail.empty')} colorScheme={colorScheme} />
          )
        }
        ListFooterComponent={
          !loading && posts.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.stateText}>
                {hasMore || loadingMore ? t('topic.detail.loadingMore') : t('topic.detail.noMore')}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
