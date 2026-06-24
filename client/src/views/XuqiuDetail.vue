<template>
  <div class="xuqiu-detail-page page-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="10" animated />
    </div>

    <!-- 需求详情 -->
    <div v-else-if="demand" class="detail-content">
      <!-- 返回按钮 -->
      <div class="back-section">
        <el-button @click="handleBack" :icon="ArrowLeft">
          {{ t('common.back') }}
        </el-button>
      </div>

      <!-- 需求头部 -->
      <el-card class="demand-header-card" :shadow="false">
        <div class="demand-header">
          <div class="user-info">
            <el-avatar :src="demand.avatar" :size="50" />
            <div class="user-details">
              <div class="username">{{ demand.userName }}</div>
              <div class="create-time">{{ formatTime(demand.createTime) }}</div>
            </div>
          </div>
          <div class="demand-status">
            <el-tag
              :type="getStatusTagType(demand.status)"
              size="large"
            >
              {{ getStatusText(demand.status) }}
            </el-tag>
          </div>
        </div>

        <h1 class="demand-title">{{ demand.title }}</h1>

        <div class="demand-tags">
          <el-tag
            v-for="tag in demand.tags"
            :key="tag"
            size="small"
            type="info"
            style="margin-right: 8px;"
          >
            {{ tag }}
          </el-tag>
        </div>
      </el-card>

      <!-- 需求内容 -->
      <el-card class="demand-content-card" :shadow="false">
        <div class="content-section">
          <h3 class="section-title">{{ t('xuqiu.detail.description') }}</h3>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="demand-description" v-html="sanitizeHtml(formatDescription(demand.description))"></div>
        </div>
      </el-card>

      <!-- 需求统计和操作 -->
      <el-card class="demand-actions-card" :shadow="false">
        <div class="stats-section">
          <div class="stat-item">
            <el-icon><View /></el-icon>
            <span>{{ demand.viewCount || 0 }}</span>
            <span class="stat-label">{{ t('xuqiu.detail.views') }}</span>
          </div>
          <div class="stat-item">
            <el-icon><ChatDotRound /></el-icon>
            <span>{{ demand.commentCount || 0 }}</span>
            <span class="stat-label">{{ t('xuqiu.detail.comments') }}</span>
          </div>
          <div class="stat-item">
            <el-icon><Star /></el-icon>
            <span>{{ (demand as { likeCount?: number }).likeCount ?? 0 }}</span>
            <span class="stat-label">{{ t('xuqiu.detail.likes') }}</span>
          </div>
        </div>

        <div class="action-buttons">
          <el-button
            :type="isLiked ? 'primary' : 'default'"
            :icon="isLiked ? StarFilled : Star"
            @click="handleLike"
            :loading="likeLoading"
          >
            {{ isLiked ? t('xuqiu.detail.unlike') : t('xuqiu.detail.like') }}
          </el-button>
          <el-button
            :type="isCollected ? 'warning' : 'default'"
            :icon="isCollected ? CollectionFilled : Collection"
            @click="handleCollect"
            :loading="collectLoading"
          >
            {{ isCollected ? t('xuqiu.detail.uncollect') : t('xuqiu.detail.collect') }}
          </el-button>
          <el-button
            type="primary"
            :icon="Share"
            @click="handleShare"
          >
            {{ t('xuqiu.detail.share') }}
          </el-button>
        </div>
      </el-card>

      <!-- 评论区域 -->
      <el-card class="comments-card" :shadow="false">
        <template #header>
          <div class="comments-header">
            <h3>{{ t('xuqiu.detail.comments') }} ({{ demand.commentCount || 0 }})</h3>
          </div>
        </template>

        <!-- 评论输入 -->
        <div class="comment-input-section">
          <div v-if="replyingTo" class="reply-indicator">
            <span>{{ t('xuqiu.detail.replyingTo') }}: @{{ replyingTo.username }}</span>
            <el-button link size="small" @click="handleCancelReply">
              {{ t('common.cancel') }}
            </el-button>
          </div>
          <el-input
            v-model="currentInputText"
            type="textarea"
            :rows="3"
            :placeholder="replyingTo ? t('xuqiu.detail.replyPlaceholder') : t('xuqiu.detail.commentPlaceholder')"
            maxlength="500"
            show-word-limit
          />
          <div class="comment-actions">
            <el-button
              v-if="replyingTo"
              @click="handleCancelReply"
            >
              {{ t('common.cancel') }}
            </el-button>
            <el-button
              type="primary"
              @click="replyingTo ? handleSubmitReply() : handleSubmitComment()"
              :loading="commentLoading"
              :disabled="replyingTo ? !replyText.trim() : !commentText.trim()"
            >
              {{ replyingTo ? t('xuqiu.detail.submitReply') : t('xuqiu.detail.submitComment') }}
            </el-button>
          </div>
        </div>

        <!-- 评论列表 -->
        <div class="comments-list" v-if="comments.length > 0">
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="comment-item"
          >
            <el-avatar :src="comment.avatar" :size="40" />
            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-author">{{ comment.userName }}</span>
                <span class="comment-time">{{ formatTime(comment.createTime) }}</span>
              </div>
              <div class="comment-text">{{ comment.content }}</div>
              <div class="comment-actions">
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click="handleReplyComment(comment)"
                >
                  {{ t('xuqiu.detail.reply') }}
                </el-button>
                <el-button
                  link
                  type="primary"
                  size="small"
                  :loading="commentLikeLoading[comment.id]"
                  @click="handleLikeComment(comment)"
                >
                  <el-icon><Star /></el-icon>
                  {{ comment.likeCount || 0 }}
                </el-button>
              </div>
              <!-- 回复列表 -->
              <div v-if="comment.replies && comment.replies.length > 0" class="comment-replies">
                <div
                  v-for="reply in comment.replies"
                  :key="reply.id"
                  class="comment-reply"
                >
                  <el-avatar :src="reply.avatar" :size="32" />
                  <div class="reply-content">
                    <div class="reply-header">
                      <span class="reply-author">{{ reply.userName }}</span>
                      <span v-if="reply.replyTo" class="reply-to">@{{ reply.replyTo }}</span>
                      <span class="reply-time">{{ formatTime(reply.createTime) }}</span>
                    </div>
                    <div class="reply-text">{{ reply.content }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <el-empty
          v-else
          :description="t('xuqiu.detail.noComments')"
          :image-size="100"
        />
      </el-card>
    </div>

    <!-- 错误状态 -->
    <div v-else class="error-container">
      <el-result
        icon="error"
        :title="t('hardcoded.xuqiu_detail.加载失败')"
        :sub-title="t('hardcoded.xuqiu_detail.errorMes1')"
      >
        <template #extra>
          <el-button type="primary" @click="loadDemandDetail">{{ t('common.retry') }}</el-button>
          <el-button @click="handleBack">{{ t('common.back') }}</el-button>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  View,
  ChatDotRound,
  Star,
  StarFilled,
  Collection,
  Share,
} from '@element-plus/icons-vue'
import { CollectionFilled } from '@/lib/lucide-fallback'
import { getDemandDetail, likeDemand, unlikeDemand, collectDemand, uncollectDemand, shareDemand } from '@/api/xuqiu'
import { logger } from '@/utils/logger'
import { escapeHtml, sanitizeHtml } from '@/utils/htmlSanitizer'
import { formatTimeDistance } from '@/utils/time-utils'
import type { Demand, DemandComment, PlazaDemand } from '@/api/xuqiu'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const demand = ref<Demand | null>(null)
const errorMessage = ref('')
const isLiked = ref(false)
const isCollected = ref(false)
const likeLoading = ref(false)
const collectLoading = ref(false)
const commentText = ref('')
const commentLoading = ref(false)
const replyText = ref('')
const replyingTo = ref<{ id: string; username: string } | null>(null)

// 计算属性：根据是否在回复模式返回对应的文本
const currentInputText = computed({
  get: () => replyingTo.value ? replyText.value : commentText.value,
  set: (value: string) => {
    if (replyingTo.value) {
      replyText.value = value
    } else {
      commentText.value = value
    }
  }
})
const commentLikeLoading = ref<Record<string, boolean>>({})
const comments = ref<DemandComment[]>([])

// 格式化时间
const formatTime = (time: string) => {
  const result = formatTimeDistance(time)
  return result || time
}

// 获取状态文本
const getStatusText = (status: string | number) => {
  const statusStr = String(status)
  if (statusStr === 'pending' || statusStr === '0') {
    return t('xuqiu.statusPending')
  } else if (statusStr === 'completed' || statusStr === '1') {
    return t('xuqiu.statusCompleted')
  } else if (statusStr === 'processing' || statusStr === '2') {
    return t('xuqiu.statusInProgress')
  } else if (statusStr === 'cancelled') {
    return t('xuqiu.statusCancelled')
  }
  return t('xuqiu.statusPending')
}

// 获取状态标签类型
const getStatusTagType = (status: string | number) => {
  const statusStr = String(status)
  if (statusStr === 'pending' || statusStr === '0') {
    return 'info'
  } else if (statusStr === 'completed' || statusStr === '1') {
    return 'success'
  } else if (statusStr === 'processing' || statusStr === '2') {
    return 'warning'
  } else if (statusStr === 'cancelled') {
    return 'danger'
  }
  return 'info'
}

// 格式化描述（支持换行）- 使用 escapeHtml 防止 XSS 攻击
const formatDescription = (description: string) => {
  if (!description) return ''
  // 先转义 HTML 特殊字符，再替换换行符
  const escaped = escapeHtml(description)
  return escaped.replace(/\n/g, '<br>')
}

// 加载需求详情
const loadDemandDetail = async () => {
  const demandId = route.params.id as string
  if (!demandId) {
    errorMessage.value = t('value.xuqiu_detail.需求ID不存在')
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await getDemandDetail(demandId)
    if (response.success && response.data) {
      demand.value = response.data
      // 加载评论
      await loadComments()
    } else {
      errorMessage.value = response.message || t('msg.xuqiu_detail.fetchDetailFailed')
    }
  } catch (error) {
    logger.error('Failed to load demand details:', error)
    errorMessage.value = error instanceof Error ? error.message : t('msg.xuqiu_detail.加载失败')
  } finally {
    loading.value = false
  }
}

// 点赞/取消点赞
const handleLike = async () => {
  if (!demand.value) return

  likeLoading.value = true
  try {
    if (isLiked.value) {
      const response = await unlikeDemand(String(demand.value.id))
      if (response.success) {
        isLiked.value = false
        const d = demand.value as PlazaDemand & { likeCount?: number }
        if (d.likeCount !== undefined) {
          d.likeCount--
        }
        ElMessage.success(t('xuqiu.detail.unlikeSuccess'))
      }
    } else {
      const response = await likeDemand(String(demand.value.id))
      if (response.success) {
        isLiked.value = true
        const d = demand.value as PlazaDemand & { likeCount?: number }
        if (d.likeCount !== undefined) {
          d.likeCount++
        }
        ElMessage.success(t('xuqiu.detail.likeSuccess'))
      }
    }
  } catch (error) {
    logger.error('Like operation failed:', error)
    ElMessage.error(t('xuqiu.detail.likeFailed'))
  } finally {
    likeLoading.value = false
  }
}

// 收藏/取消收藏
const handleCollect = async () => {
  if (!demand.value) return

  collectLoading.value = true
  try {
    if (isCollected.value) {
      const response = await uncollectDemand(String(demand.value.id))
      if (response.success) {
        isCollected.value = false
        ElMessage.success(t('xuqiu.detail.uncollectSuccess'))
      }
    } else {
      const response = await collectDemand(String(demand.value.id))
      if (response.success) {
        isCollected.value = true
        ElMessage.success(t('xuqiu.detail.collectSuccess'))
      }
    }
  } catch (error) {
    logger.error('Favorite operation failed:', error)
    ElMessage.error(t('xuqiu.detail.collectFailed'))
  } finally {
    collectLoading.value = false
  }
}

// 分享
const handleShare = async () => {
  if (!demand.value) return

  try {
    const response = await shareDemand(String(demand.value.id))
    if (response.success && response.data?.shareUrl) {
      // 跳转到分享页面
      router.push(`/share/${demand.value.id}`)
    } else {
      // 直接复制链接
      const shareUrl = `${window.location.origin}/xuqiu/${demand.value.id}`
      await navigator.clipboard.writeText(shareUrl)
      ElMessage.success(t('xuqiu.detail.shareSuccess'))
    }
  } catch (error) {
    logger.error('Share failed:', error)
    // 降级：直接复制链接
    const shareUrl = `${window.location.origin}/xuqiu/${demand.value.id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      ElMessage.success(t('xuqiu.detail.shareSuccess'))
    } catch {
      ElMessage.error(t('xuqiu.detail.shareFailed'))
    }
  }
}

// 加载评论列表
const loadComments = async () => {
  if (!demand.value) return

  try {
    const { getDemandComments } = await import('@/api/xuqiu')
    const response = await getDemandComments(String(demand.value.id), {
      page: 1,
      pageSize: 50,
    })

    if (response.success && response.data) {
      comments.value = response.data.list || []
      // 更新需求评论数
      if (demand.value) {
        demand.value.commentCount = response.data.pagination?.total || comments.value.length
      }
    }
  } catch (error) {
    logger.error('Failed to load comments:', error)
  }
}

// 提交评论
const handleSubmitComment = async () => {
  if (!commentText.value.trim() || !demand.value) return

  commentLoading.value = true
  try {
    const { createDemandComment } = await import('@/api/xuqiu')
    const response = await createDemandComment({
      demandId: String(demand.value.id),
      content: commentText.value.trim(),
    })

    if (response.success) {
      commentText.value = ''
      ElMessage.success(t('xuqiu.detail.commentSuccess'))
      await loadComments()
    } else {
      ElMessage.error(response.message || t('xuqiu.detail.commentFailed'))
    }
  } catch (error) {
    logger.error('Failed to submit comment:', error)
    ElMessage.error(t('xuqiu.detail.commentFailed'))
  } finally {
    commentLoading.value = false
  }
}

// 回复评论
const handleReplyComment = (comment: DemandComment) => {
  replyingTo.value = { id: comment.id, username: comment.userName }
  replyText.value = `@${comment.userName} `
  // 聚焦到评论输入框
  nextTick(() => {
    const textarea = document.querySelector('.comment-input-section textarea') as HTMLTextAreaElement
    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }
  })
}

// 取消回复
const handleCancelReply = () => {
  replyingTo.value = null
  replyText.value = ''
}

// 点赞评论
const handleLikeComment = async (comment: { id: string; likeCount?: number; isLiked?: boolean }) => {
  if (!demand.value) return

  commentLikeLoading.value[comment.id] = true
  try {
    const { likeComment, unlikeComment } = await import('@/api/xuqiu')

    if (comment.isLiked) {
      const response = await unlikeComment(comment.id)
      if (response.success && response.data) {
        comment.isLiked = false
        comment.likeCount = (comment.likeCount || 0) - 1
      }
    } else {
      const response = await likeComment(comment.id)
      if (response.success && response.data) {
        comment.isLiked = true
        comment.likeCount = (comment.likeCount || 0) + 1
      }
    }
  } catch (error) {
    logger.error('Failed to like comment:', error)
    ElMessage.error(t('xuqiu.detail.likeCommentFailed'))
  } finally {
    commentLikeLoading.value[comment.id] = false
  }
}

// 提交回复
const handleSubmitReply = async () => {
  if (!replyText.value.trim() || !replyingTo.value || !demand.value) return

  commentLoading.value = true
  try {
    const { createDemandComment } = await import('@/api/xuqiu')
    const response = await createDemandComment({
      demandId: String(demand.value.id),
      content: replyText.value.trim(),
      parentId: replyingTo.value.id,
    })

    if (response.success) {
      replyText.value = ''
      replyingTo.value = null
      ElMessage.success(t('xuqiu.detail.replySuccess'))
      await loadComments()
    } else {
      ElMessage.error(response.message || t('xuqiu.detail.replyFailed'))
    }
  } catch (error) {
    logger.error('Failed to submit reply:', error)
    ElMessage.error(t('xuqiu.detail.replyFailed'))
  } finally {
    commentLoading.value = false
  }
}

// 返回
const handleBack = () => {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    router.push('/xuqiu')
  }
}

onMounted(() => {
  loadDemandDetail()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.xuqiu-detail-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: $desktop-page-padding;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.loading-container {
  padding: 40px;
}

.back-section {
  margin-bottom: 20px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.demand-header-card,
.demand-content-card,
.demand-actions-card,
.comments-card {
  border-radius: var(--global-border-radius); // 使用项目标准圆角
  // 扁平化设计：el-card 默认无阴影（已通过 :shadow="false" 设置）
}

.demand-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.username {
  font-weight: 600;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.create-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.demand-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 20px 0;
}

.demand-tags {
  margin-top: 16px;
}

.content-section {
  margin-top: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 16px;
}

.demand-description {
  font-size: 16px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
}

.stats-section {
  display: flex;
  gap: 32px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: var(--unified-border-bottom);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: var(--el-text-color-primary);

  .stat-label {
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-input-section {
  margin-bottom: 24px;
}

.comment-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

.comment-content {
  flex: 1;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.comment-author {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.comment-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.comment-text {
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

.error-container {
  padding: 40px;
}
</style>
