/**
 * ArticleDetailScreen 资讯详情页(mobile-rn 端 wrapper)
 *
 * 对齐历史项目 pagesA/news/detail.vue(新闻详情):
 * - 共享组件渲染:返回 + 标题 + 作者/时间 + 阅读/点赞统计 + 正文(SharedArticleDetailScreen)
 * - RN 端补充原页面底部操作栏(L40-54 bottom-bar):
 *   ① 点赞(icon-like + count,本地 toggle 状态,对齐 isLiked/handleLike)
 *   ② 评论(icon-comment + count → 原跳 /pagesA/news/comment?id=,该页未实现,点击提示)
 *   ③ 分享(icon-share → RN Share API,对齐 handleShare)
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { createComment, fetchApi, getComments, type CommentItem } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  ArticleDetailScreen as SharedArticleDetailScreen,
  type ArticleDetailItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'
import { Heart, MessageCircle, Share2 } from 'lucide-react-native'

type Route = RouteProp<RootStackParamList, 'ArticleDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ArticleDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [article, setArticle] = useState<ArticleDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // 底部操作栏状态(对齐 Uniapp news/detail.vue isLiked/handleLike)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  // 评论弹窗(getComments/createComment,对齐原 /pagesA/news/comment 评论页)
  const [commentVisible, setCommentVisible] = useState(false)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentLoading, setCommentLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<ArticleDetailItem>(`/api/articles/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) {
        setArticle(res.data)
        setLikeCount(res.data.likes ?? 0)
      } else {
        setError(res.error || t('articleDetail.loadFailed'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  /** 点赞切换(对齐 handleLike:本地 toggle,UI 即时反馈) */
  const handleLike = useCallback((): void => {
    setLiked((prev) => {
      const next = !prev
      setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)))
      return next
    })
  }, [])

  /** 评论入口(对齐原 /pagesA/news/comment?id=:打开评论列表,加载 getComments) */
  const handleComment = useCallback((): void => {
    setCommentVisible(true)
    setCommentLoading(true)
    setCommentError('')
    void getComments({ resourceType: 'post', resourceId: id, page: 1, pageSize: 20 })
      .then((res) => {
        if (res.success) {
          setComments(res.data.list)
        } else {
          setComments([])
          setCommentError(res.error || '评论加载失败')
        }
      })
      .catch(() => {
        setComments([])
        setCommentError('评论加载失败')
      })
      .finally(() => setCommentLoading(false))
  }, [id])

  /** 发表评论(对齐 news/comment 提交) */
  const handleCommentSubmit = useCallback(async (): Promise<void> => {
    const content = commentText.trim()
    if (!content) return
    setCommentSubmitting(true)
    setCommentError('')
    try {
      const res = await createComment({ resourceType: 'post', resourceId: id, content })
      if (res.success) {
        setComments((prev) => [res.data, ...prev])
        setCommentText('')
      } else {
        setCommentError(res.error || '评论失败')
      }
    } catch {
      setCommentError('评论失败,请重试')
    } finally {
      setCommentSubmitting(false)
    }
  }, [commentText, id])

  /** 分享(对齐 handleShare:uni.share → RN Share API) */
  const handleShare = useCallback((): void => {
    if (!article) return
    void Share.share({
      title: article.title,
      message: `${article.title}\n${article.content.slice(0, 100)}${article.content.length > 100 ? '…' : ''}`,
    })
  }, [article])

  return (
    <View style={styles.shell}>
      <View style={styles.body}>
        <SharedArticleDetailScreen
          t={t}
          item={article}
          loading={loading}
          error={error}
          onBack={() => navigation.goBack()}
        />
      </View>
      {/* 底部操作栏(对齐 Uniapp news/detail.vue bottom-bar:点赞/评论/分享) */}
      {article ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.actionItem} onPress={handleLike} activeOpacity={0.7}>
            <Heart
              size={18}
              color={liked ? '#f43f5e' : '#6b7280'}
              fill={liked ? '#f43f5e' : 'transparent'}
            />
            <Text style={styles.actionCount}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={handleComment} activeOpacity={0.7}>
            <MessageCircle size={18} color="#6b7280" />
            {/* 评论数:原 article.comments 字段未在后端 ArticleDetailItem 契约中,暂展示 0 */}
            <Text style={styles.actionCount}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={handleShare} activeOpacity={0.7}>
            <Share2 size={18} color="#6b7280" />
            <Text style={styles.actionLabel}>分享</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 评论弹窗(对齐原 /pagesA/news/comment?id= 评论列表 + 发表) */}
      <Modal
        visible={commentVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentVisible(false)}
      >
        <View style={styles.commentOverlay}>
          <Pressable style={styles.commentMask} onPress={() => setCommentVisible(false)} />
          <View style={styles.commentSheet}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>评论</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setCommentVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="关闭评论"
              >
                <Text style={styles.commentClose}>×</Text>
              </Pressable>
            </View>
            {commentLoading ? (
              <ActivityIndicator style={styles.commentLoading} color={tokens.text.secondary} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                style={styles.commentList}
                contentContainerStyle={comments.length === 0 ? styles.commentListEmpty : undefined}
                ListEmptyComponent={
                  <Text style={styles.commentEmptyText}>
                    {commentError || '暂无评论,快来抢沙发'}
                  </Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>
                        {(item.author.nickname || '用')[0] ?? '用'}
                      </Text>
                    </View>
                    <View style={styles.commentBody}>
                      <Text style={styles.commentNickname} numberOfLines={1}>
                        {item.author.nickname || '匿名用户'}
                      </Text>
                      <Text style={styles.commentContent}>{item.content}</Text>
                      <Text style={styles.commentTime}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="写下你的评论..."
                placeholderTextColor={tokens.text.tertiary}
                style={styles.commentInput}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.commentSendBtn,
                  (!commentText.trim() || commentSubmitting) && styles.commentSendBtnDisabled,
                ]}
                onPress={() => void handleCommentSubmit()}
                disabled={!commentText.trim() || commentSubmitting}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="发表评论"
              >
                <Text style={styles.commentSendText}>{commentSubmitting ? '…' : '发送'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  } as ViewStyle,
  body: {
    flex: 1,
  } as ViewStyle,
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    paddingVertical: rpx(16),
    paddingBottom: rpx(20),
  } as ViewStyle,
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
  } as ViewStyle,
  actionIcon: {
    fontSize: 18,
    color: tokens.text.secondary,
  } as TextStyle,
  actionIconActive: {
    color: '#FF3B3B',
  } as TextStyle,
  actionCount: {
    fontSize: 13,
    color: tokens.text.secondary,
  } as TextStyle,
  actionLabel: {
    fontSize: 13,
    color: tokens.text.secondary,
  } as TextStyle,
  // ── 评论弹窗 ──
  commentOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  } as ViewStyle,
  commentMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.overlay.modal,
  } as ViewStyle,
  commentSheet: {
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 14,
    minHeight: 360,
    maxHeight: '72%',
  } as ViewStyle,
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  } as ViewStyle,
  commentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  commentClose: {
    fontSize: 24,
    lineHeight: 26,
    color: tokens.text.tertiary,
    fontWeight: '300',
  } as TextStyle,
  commentLoading: {
    marginVertical: 40,
  },
  commentList: {
    flexGrow: 0,
    paddingHorizontal: 16,
  } as ViewStyle,
  commentListEmpty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  } as ViewStyle,
  commentEmptyText: {
    fontSize: 13,
    color: tokens.text.tertiary,
  } as TextStyle,
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border.light,
  } as ViewStyle,
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  } as ViewStyle,
  commentAvatarText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  } as TextStyle,
  commentBody: {
    flex: 1,
  } as ViewStyle,
  commentNickname: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.text.primary,
    marginTop: 2,
  } as TextStyle,
  commentTime: {
    fontSize: 11,
    color: tokens.text.tertiary,
    marginTop: 4,
  } as TextStyle,
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.border.light,
  } as ViewStyle,
  commentInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 80,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.bg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: tokens.text.primary,
  } as TextStyle,
  commentSendBtn: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 19,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  commentSendBtnDisabled: {
    opacity: 0.5,
  } as ViewStyle,
  commentSendText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  } as TextStyle,
})
