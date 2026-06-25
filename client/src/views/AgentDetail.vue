<template>
  <div class="agent-detail-container page-container radius-auto">
    <el-dialog v-model="buyDialogVisible" :title="t('agentDetail.buyAgent')" width="480px">
      <div>
        <div style="margin-bottom: 12px; color: var(--el-text-color-primary)">
          {{ t('agentDetail.selectPaymentMethod') }}
        </div>
        <el-radio-group v-model="paymentMethod">
          <el-radio-button value="coins">{{ t('agentDetail.platformCoins') }}</el-radio-button>
          <el-radio-button value="wechat">{{ t('agentDetail.wechatPay') }}</el-radio-button>
          <el-radio-button value="alipay">{{ t('agentDetail.alipay') }}</el-radio-button>
        </el-radio-group>
      </div>
      <template #footer>
        <el-button @click="buyDialogVisible = false">{{ t('agentDetail.close') }}</el-button>
        <el-button 
          type="primary" 
          :loading="buying" 
          @click="handleBuyConfirm"
        >
          {{ buying ? t('agentDetail.processing') : t('agentDetail.confirmPurchase') }}
        </el-button>
      </template>
    </el-dialog>

    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="10" animated />
    </div>

    <div v-else-if="agent" class="agent-detail-content radius-auto">
      <div class="page-indicator" aria-hidden="true">
        <span class="dot active"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
      <!-- 返回按钮 -->
      <div class="back-nav radius-auto">
        <el-button link @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          {{ t('agentDetail.backToList') }}
        </el-button>
      </div>

      <!-- 智能体头部信息 -->
      <el-card
        shadow="hover"
        class="agent-header-card radius-auto ihui-ai-card-hover ihui-ai-fade-in-left-animation"
      >
        <div class="agent-header">
          <el-avatar :size="120" :src="agent.avatar || agent.icon" class="agent-avatar-large">
            <el-icon :size="60"><Server /></el-icon>
          </el-avatar>
          <div class="agent-header-info">
            <div class="agent-title-row">
              <h1>{{ agent.agentName ?? agent.name }}</h1>
              <div class="agent-badges">
                <el-tag v-if="agent.platform" size="large" :type="getPlatformTagType(agent.platform)" class="platform-tag-large">
                  {{ getPlatformName(agent.platform) }}
                </el-tag>
                <el-tag v-if="agent.status" size="large" :type="getStatusTagType(agent.status)">
                  {{ getStatusText(agent.status) }}
                </el-tag>
                <el-tag v-if="agent.isPublic" size="large">{{ t('agentDetail.public') }}</el-tag>
              </div>
            </div>
            <p class="agent-description-large">{{ agent.description ?? agent.prologue }}</p>
            <div class="agent-meta-large">
              <div class="meta-item">
                <el-icon><User /></el-icon>
                <span>{{ agent.creatorName || t('agents.unknownCreator') }}</span>
              </div>
              <div class="meta-item">
                <el-icon><Star /></el-icon>
                <span>{{ agent.rating?.toFixed(1) || '0.0' }}</span>
                <span v-if="agent.ratingCount">({{ agent.ratingCount }})</span>
              </div>
              <div class="meta-item">
                <el-icon><Eye /></el-icon>
                <span
                  >{{ formatNumber(agent.usageCount || 0) }}{{ t('agentDetail.timesUsed') }}</span
                >
              </div>
              <div class="meta-item">
                <el-icon><Clock /></el-icon>
                <span>{{ formatTime(agent.createTime) }}</span>
              </div>
            </div>
            <div class="agent-actions-header">
              <el-button size="large" @click="handleStartChat">
                <el-icon><Eye /></el-icon>
                {{ t('agentDetail.viewAgentList') }}
              </el-button>
              <el-button size="large" @click="openBuyDialog">{{
                t('agentDetail.purchaseAgent')
              }}</el-button>
              <el-button v-if="agent.isFavorite" :icon="Star" @click="handleUnfavorite">
                {{ t('agentDetail.favorited') }}
              </el-button>
              <el-button v-else :icon="Star" @click="handleFavorite">{{
                t('agentDetail.favorite')
              }}</el-button>
              <el-button :icon="CheckCircle" @click="handleThumbs">
                <span v-if="agent.likeCount">({{ agent.likeCount }})</span>
                {{ t('agentDetail.thumbsUp') }}
              </el-button>
              <el-button :icon="Share2" @click="handleShare2">{{
                t('agentDetail.share')
              }}</el-button>
              <el-button
                :icon="RefreshCw"
                @click="handleRefreshCwDetails"
                :loading="refreshingDetails"
              >
                {{ t('agentDetail.refreshDetails') }}
              </el-button>
            </div>
          </div>
        </div>
      </el-card>

      <el-row :gutter="15">
        <!-- 左侧主要内容 -->
        <el-col :xs="24" :md="16">
          <!-- 详细信息 -->
          <el-card shadow="never" class="detail-section radius-auto">
            <template #header>
              <span>{{ t('agentDetail.detailedInfo') }}</span>
            </template>
            <el-tabs v-model="detailTab">
              <el-tab-pane :label="t('agentDetail.overview')" name="overview">
                <div class="detail-content">
                  <el-descriptions :column="2" border>
                    <el-descriptions-item :label="t('agentDetail.agentId')">
                      {{ String(agent.id) }}
                    </el-descriptions-item>
                    <el-descriptions-item :label="t('agentDetail.category')">
                      {{ agent.category || t('agents.noCategory') }}
                    </el-descriptions-item>
                    <el-descriptions-item :label="t('agentDetail.createTime')">
                      {{ formatTime(agent.createTime) }}
                    </el-descriptions-item>
                    <el-descriptions-item :label="t('agentDetail.updateTime')">
                      {{ formatTime(agent.updateTime) }}
                    </el-descriptions-item>
                    <el-descriptions-item :label="t('agentDetail.usageCount')">
                      {{ formatNumber(agent.usageCount || 0) }}
                    </el-descriptions-item>
                    <el-descriptions-item :label="t('agentDetail.rating')">
                      {{ agent.rating?.toFixed(1) || '0.0' }}
                      <span v-if="agent.ratingCount"
                        >({{ agent.ratingCount }}{{ t('agentDetail.ratingCount') }})</span
                      >
                    </el-descriptions-item>
                  </el-descriptions>

                  <div v-if="agent.tags && agent.tags.length > 0" class="tags-section">
                    <h4>{{ t('agentDetail.tags') }}</h4>
                    <div class="tags-list">
                      <el-tag v-for="tag in agent.tags" :key="tag" size="large" class="tag-item">
                        {{ tag }}
                      </el-tag>
                    </div>
                  </div>
                </div>
              </el-tab-pane>

              <el-tab-pane :label="t('agentDetail.platformInfo')" name="platform">
                <div class="platform-info-content">
                  <el-descriptions :column="1" border>
                    <el-descriptions-item :label="t('agentDetail.platformSource')">
                      <div class="platform-info-item">
                        <span class="platform-icon">{{ getPlatformIcon(agent.platform) }}</span>
                        <span>{{ getPlatformName(agent.platform) }}</span>
                      </div>
                    </el-descriptions-item>

                    <!-- 智汇智能体平台信息 -->
                    <template v-if="agent.platform === 'coze'">
                      <el-descriptions-item :label="t('agentDetail.cozeBotId')">
                        {{ agent.cozeBotId || t('agents.notSet') }}
                      </el-descriptions-item>
                    </template>

                    <!-- N8N平台信息 -->
                    <template v-if="agent.platform === 'n8n'">
                      <el-descriptions-item :label="t('agentDetail.n8nWorkflowId')">
                        {{ agent.n8nWorkflowId || t('agents.notSet') }}
                      </el-descriptions-item>
                      <el-descriptions-item :label="t('agentDetail.webhookUrl')">
                        <el-link
                          v-if="agent.n8nWebhookUrl"
                          :href="agent.n8nWebhookUrl"
                          target="_blank"
                        >
                          {{ agent.n8nWebhookUrl }}
                        </el-link>
                        <span v-else>{{ t('agents.notSet') }}</span>
                      </el-descriptions-item>
                    </template>

                    <!-- Dify平台信息 -->
                    <template v-if="agent.platform === 'dify'">
                      <el-descriptions-item :label="t('agentDetail.difyAppId')">
                        {{ agent.difyAppId || t('agents.notSet') }}
                      </el-descriptions-item>
                      <el-descriptions-item :label="t('agentDetail.difyBaseUrl')">
                        {{ agent.difyBaseUrl || t('agents.notSet') }}
                      </el-descriptions-item>
                    </template>

                    <!-- Make平台信息 -->
                    <template v-if="agent.platform === 'make'">
                      <el-descriptions-item :label="t('agentDetail.makeScenarioId')">
                        {{ agent.makeScenarioId || t('agents.notSet') }}
                      </el-descriptions-item>
                      <el-descriptions-item :label="t('agentDetail.webhookUrl')">
                        <el-link
                          v-if="agent.makeWebhookUrl"
                          :href="agent.makeWebhookUrl"
                          target="_blank"
                        >
                          {{ agent.makeWebhookUrl }}
                        </el-link>
                        <span v-else>{{ t('agents.notSet') }}</span>
                      </el-descriptions-item>
                    </template>

                    <!-- 阿里云百炼平台信息 -->
                    <template v-if="agent.platform === 'dashscope'">
                      <el-descriptions-item :label="t('agentDetail.modelName')">
                        {{ agent.dashscopeModel || t('agents.notSet') }}
                      </el-descriptions-item>
                      <el-descriptions-item :label="t('agentDetail.baseUrl')">
                        {{ agent.dashscopeBaseUrl || t('agents.notSet') }}
                      </el-descriptions-item>
                    </template>
                  </el-descriptions>
                </div>
              </el-tab-pane>

              <el-tab-pane :label="t('agentDetail.usageStats')" name="stats">
                <div class="stats-content">
                  <el-row :gutter="20" class="stats-grid">
                    <el-col :xs="12" :sm="6">
                      <div class="stat-box">
                        <div class="stat-value">
                          {{ formatNumber(agent.usageCount || 0) }}
                        </div>
                        <div class="stat-label">{{ t('agentDetail.totalUsageCount') }}</div>
                      </div>
                    </el-col>
                    <el-col :xs="12" :sm="6">
                      <div class="stat-box">
                        <div class="stat-value">
                          {{ agent.rating?.toFixed(1) || '0.0' }}
                        </div>
                        <div class="stat-label">{{ t('agentDetail.averageRating') }}</div>
                      </div>
                    </el-col>
                    <el-col :xs="12" :sm="6">
                      <div class="stat-box">
                        <div class="stat-value">
                          {{ agent.ratingCount || 0 }}
                        </div>
                        <div class="stat-label">{{ t('agentDetail.reviewCount') }}</div>
                      </div>
                    </el-col>
                    <el-col :xs="12" :sm="6">
                      <div class="stat-box">
                        <div class="stat-value">
                          {{ getDaysSince(agent.createTime) }}
                        </div>
                        <div class="stat-label">{{ t('agentDetail.daysOnline') }}</div>
                      </div>
                    </el-col>
                  </el-row>
                </div>
              </el-tab-pane>
            </el-tabs>
          </el-card>

          <!-- 评价列表 -->
          <el-card shadow="never" class="detail-section">
            <template #header>
              <span>{{ t('agentDetail.userReviews') }} ({{ agent.ratingCount || 0 }})</span>
            </template>
            <div v-if="reviews.length === 0" class="empty-reviews">
              <el-empty :description="t('agentDetail.noReviews')" />
            </div>
            <div v-else class="reviews-list">
              <div v-for="review in reviews" :key="review.id" class="review-item">
                <el-avatar :size="40" :src="review.userAvatar">
                  <el-icon><User /></el-icon>
                </el-avatar>
                <div class="review-content">
                  <div class="review-header">
                    <span class="review-user">{{ review.userName }}</span>
                    <el-rate
                      v-model="review.rating"
                      disabled
                      show-score
                      :text-color="'var(--el-text-color-primary)'"
                    />
                    <span class="review-time">{{ formatTime(review.createTime) }}</span>
                  </div>
                  <p class="review-text">{{ review.content }}</p>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 右侧边栏 -->
        <el-col :xs="24" :md="8">
          <!-- 快速操作 -->
          <el-card shadow="never" class="sidebar-card">
            <template #header>
              <span>{{ t('agentDetail.quickActions') }}</span>
            </template>
            <div class="quick-actions">
              <el-button size="large" @click="handleStartChat" block>
                <el-icon><Eye /></el-icon>
                {{ t('agentDetail.viewAgentList') }}
              </el-button>
              <el-button @click="openBuyDialog" block>{{
                t('agentDetail.purchaseAgent')
              }}</el-button>
              <el-button @click="handleFavorite" block>
                <el-icon><component :is="agent.isFavorite ? Star : Star" /></el-icon>
                {{ agent.isFavorite ? t('agentDetail.favorited') : t('agentDetail.favorite') }}
              </el-button>
              <el-button @click="handleShare2" block>
                <el-icon><Share2 /></el-icon>
                {{ t('agentDetail.share') }}
              </el-button>
            </div>
          </el-card>

          <!-- 相似智能体 -->
          <el-card shadow="never" class="sidebar-card">
            <template #header>
              <span>{{ t('agentDetail.similarAgents') }}</span>
            </template>
            <div v-if="similarAgentsLoading" class="loading-mini">
              <el-skeleton :rows="3" animated />
            </div>
            <div v-else-if="similarAgents.length === 0" class="empty-similar">
              <el-empty :description="t('agentDetail.noSimilarAgents')" :image-size="80" />
            </div>
            <div v-else class="similar-agents-list">
              <div
                v-for="similar in similarAgents"
                :key="similar.id"
                class="similar-agent-item"
                @click="handleAgentClick(similar, $event)"
              >
                <el-avatar :size="40" :src="similar.avatar || similar.icon">
                  <el-icon><Server /></el-icon>
                </el-avatar>
                <div class="similar-agent-info">
                  <div class="similar-agent-name">{{ similar.name }}</div>
                  <div class="similar-agent-meta">
                    <el-icon><Eye /></el-icon>
                    <span>{{ formatNumber(similar.usageCount || 0) }}</span>
                    <el-icon><Star /></el-icon>
                    <span>{{ similar.rating?.toFixed(1) || '0.0' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </el-card>

          <!-- 相关工具 -->
          <el-card shadow="never" class="sidebar-card">
            <template #header>
              <span>{{ t('agentDetail.relatedTools') }}</span>
            </template>
            <div v-if="relatedWrench.length === 0" class="empty-tools">
              <el-empty :description="t('agentDetail.noRelatedTools')" :image-size="80" />
            </div>
            <div v-else class="related-tools-list">
              <div
                v-for="tool in relatedWrench"
                :key="tool.id"
                class="related-tool-item"
                @click="handleToolClick(tool, $event)"
              >
                <el-avatar :size="32" :src="tool.icon" shape="square">
                  <el-icon><Wrench /></el-icon>
                </el-avatar>
                <span class="tool-name">{{ tool.name }}</span>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <div v-else class="empty-state">
      <el-empty :description="t('agentDetail.agentNotExist')" />
      <el-button type="primary" class="back-btn" @click="goBack">{{ t('agentDetail.backToList') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
 
import { ref, onMounted } from 'vue'
import { useAsyncState } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSafeNavigation } from '@/composables/useSafeNavigation'
import { useAuthStore } from '@/stores/auth'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { usePageState } from '@/composables/usePageState'
import { ApiErrorType } from '@/utils/errorHandler'
import {
  ArrowLeft,
  Server,
  Star,
  Eye,
  User,
  Clock,
  Share2,
  Wrench,
  CheckCircle,
  RefreshCw,
} from '@/lib/lucide-fallback'
import {
  getAgentDetail,
  favoriteAgent as _favoriteAgent,
  unfavoriteAgent as _unfavoriteAgent,
  getPopularAgents,
  getAgentReviews,
  type Agent,
  type AgentPlatform,
  toggleAgentThumbs,
  toggleAgentCollect,
  recordAgentUse,
  unpublishAgent as _unpublishAgent,
  getAgentDetails,
  fetchAgentDetails,
  updateAgent as _updateAgent,
  deleteAgent as _deleteAgent,
} from '@/api/agent/agents'
import { buyAgent } from '@/api/agent/agent-buy'
import { logger } from '@/utils/logger'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { showError, showSuccess, showWarning } = useOperationFeedback()
const { loading, error: pageError } = usePageState()

// 状态管理
const agent = ref<Agent | null>(null)
const detailTab = ref('overview')
const reviews = ref<
  Array<{
    id: string
    userId: string
    userName: string
    userAvatar: string
    rating: number
    content: string
    createTime: string
  }>
>([])
const relatedWrench = ref<Array<{ id: string; name: string; icon: string }>>([])
const buyDialogVisible = ref(false)
const paymentMethod = ref<'coins' | 'wechat' | 'alipay'>('coins')
const buying = ref(false)
const refreshingDetails = ref(false)
const agentDetails = ref<Record<string, unknown> | null>(null)

// 加载智能体详情
const loadAgentDetail = async () => {
  loading.value = true
  pageError.value = null
  try {
    const agentId = route.params.id as string
    const response = await getAgentDetail(agentId)
    if (response.code === 200 || response.success) {
      agent.value = response.data ?? null
      await Promise.all([
        refreshSimilarAgents(),
        loadReviews(),
        loadRelatedWrench(),
        loadAgentDetails(),
      ])
    } else {
      const errorMsg = response.message || t('agents.loadFailed')
      pageError.value = {
        type: ApiErrorType.BUSINESS,
        code: response.code,
        message: errorMsg,
      }
      showError(errorMsg)
      agent.value = null
    }
  } catch (error: any) {
    const errorMsg =
      (error instanceof Error ? error.message : String(error)) || t('agents.loadFailed')
    pageError.value = {
      type: ApiErrorType.UNKNOWN,
      code: 500,
      message: errorMsg,
      originalError: error,
    }
    showError(errorMsg)
    agent.value = null
  } finally {
    loading.value = false
  }
}

// 加载相似智能体（使用 useAsyncState）
const loadSimilarAgents = async (): Promise<Agent[]> => {
  if (!agent.value) return []
  const response = await getPopularAgents({
    limit: 5,
    platform: agent.value.platform,
  })
  if (response.code === 200 && response.data) {
    return response.data.filter((a: Agent) => a.id !== agent.value?.id).slice(0, 5)
  }
  return []
}

const {
  state: similarAgents,
  isLoading: similarAgentsLoading,
  execute: refreshSimilarAgents,
} = useAsyncState(loadSimilarAgents, [], {
  immediate: false, // 不立即执行，等待 loadAgentDetail 调用
})

// 加载评价
const loadReviews = async () => {
  if (!agent.value) return
  try {
    const response = await getAgentReviews(String(agent.value.id), {
      page: 1,
      pageSize: 10,
    })
    if (response.code === 200 && response.data && response.data.list) {
      reviews.value = response.data.list.map((review: Record<string, unknown>) => ({
        id: String(review.id || ''),
        userId: String(review.userId || ''),
        userName: String(review.userName || ''),
        userAvatar: String(review.userAvatar || ''),
        rating: Number(review.rating || 0),
        content: String(review.comment || ''),
        createTime: String(review.createTime || ''),
      }))
    }
  } catch (error) {
    // 静默失败，不影响页面显示
    logger.warn(t('agentDetail.loadReviewsFailed'), error)
  }
}

// 加载相关工具
const loadRelatedWrench = async () => {
  if (!agent.value || !agent.value.tags || agent.value.tags.length === 0) {
    relatedWrench.value = []
    return
  }

  try {
    // 根据智能体标签加载相关工具
    const { getToolsList } = await import('@/api/tools/tools')
    const tags = agent.value.tags.slice(0, 3) // 使用前3个标签

    // 尝试根据标签搜索工具
    const response = await getToolsList({
      page: 1,
      pageSize: 5,
      keyword: tags.join(' '), // 使用标签作为关键词搜索
    })

    if (response.code === 200 && response.data) {
      relatedWrench.value = (response.data.list ?? [])
        .slice(0, 5)
        .map((tool: { id?: string | number; name?: string; icon?: string }) => ({
          id: String(tool.id || ''),
          name: String(tool.name || ''),
          icon: String(tool.icon || ''),
        }))
    }
  } catch (error) {
    // 静默失败，不影响页面显示
    logger.warn(t('agentDetail.loadRelatedToolsFailed'), error)
    relatedWrench.value = []
  }
}

// 返回
const goBack = () => {
  ;(router as any).back()
}

// 开始对话
const handleStartChat = () => {
  if (agent.value) {
    // 跳转到智能体列表
    router.push({
      name: 'agents',
      query: { id: String(agent.value.id) },
    } as any)
  }
}

const openBuyDialog = () => {
  if (!agent.value) return
  buyDialogVisible.value = true
}

// 购买智能体 - 完整实现
const handleBuyConfirm = async () => {
  if (!agent.value) {
    showWarning(t('agentDetail.agentNotLoaded'))
    return
  }

  const user = authStore.user as { uuid?: string } | undefined
  if (!user?.uuid) {
    showWarning(t('agentDetail.pleaseLogin') || '请先登录')
    buyDialogVisible.value = false
    return
  }

  buying.value = true

  try {
    // 调用购买API
    const response = await buyAgent({
      agent_id: String(agent.value.id),
      payment_method: paymentMethod.value,
      client_ip: undefined, // 可选：可以从请求头获取
    })

    if (response.code === 200 || response.success) {
      const data = response.data
      
      if (data) {
        if (paymentMethod.value === 'wechat' || paymentMethod.value === 'alipay') {
          if (data.pay_info) {
            const payInfo = data.pay_info as {
              payForm?: string
              prepayId?: string
              qrCodeUrl?: string
              qr_code?: string
              paymentUrl?: string
              payment_url?: string
              redirectUrl?: string
            }
            
            if (payInfo.payForm) {
              // 安全验证：净化 HTML 后再插入 DOM，防止 XSS 攻击
              const payFormHtml = String(payInfo.payForm)
              if (payFormHtml.includes('<form') && payFormHtml.includes('</form>')) {
                const formDiv = document.createElement('div')
                formDiv.innerHTML = sanitizeHtml(payFormHtml)
                const form = formDiv.querySelector('form') as HTMLFormElement
                if (form) {
                  // 验证表单 action 是合法的支付 URL
                  const action = form.getAttribute('action') || ''
                  if (action.startsWith('https://') || action.startsWith('http://')) {
                    document.body.appendChild(form)
                    form.submit()
                    document.body.removeChild(form)
                  } else {
                    showWarning(t('agentDetail.invalidPaymentForm'))
                  }
                }
              }
              showSuccess(t('agentDetail.paymentRedirecting'))
            } else if (payInfo.prepayId) {
              showWarning(t('agentDetail.wechatPaymentRequiresJSAPI'))
            } else if (payInfo.qrCodeUrl || payInfo.qr_code) {
              const qrCodeUrl = payInfo.qrCodeUrl || payInfo.qr_code
              showSuccess(t('agentDetail.paymentQRCodeGenerated'))
              if (qrCodeUrl) {
                window.open(qrCodeUrl, '_blank')
              }
            } else if (payInfo.paymentUrl || payInfo.payment_url || payInfo.redirectUrl) {
              const paymentUrl = payInfo.paymentUrl || payInfo.payment_url || payInfo.redirectUrl
              if (paymentUrl) {
                window.open(paymentUrl, '_blank')
              }
              showSuccess(t('agentDetail.paymentRedirecting'))
            } else {
              showSuccess(t('agentDetail.orderCreated'))
            }
          } else {
            showSuccess(t('agentDetail.orderCreated'))
          }
        } else {
          showSuccess(t('agentDetail.purchaseSuccess') || '购买成功')
        }

        buyDialogVisible.value = false
        
        if (data.order_no) {
          router.push(`/orders/${data.order_no}`)
        }
      } else {
        showError(t('agentDetail.purchaseFailed') || '购买失败，请稍后重试')
      }

      logger.info('Agent purchase successful', {
        agentId: String(agent.value.id),
        agentName: agent.value.name,
        paymentMethod: paymentMethod.value,
        orderNo: data?.order_no,
      })
    } else {
      showError(response.message || t('agentDetail.purchaseFailed') || '购买失败')
      logger.error('Agent purchase failed', {
        agentId: String(agent.value.id),
        error: response.message,
      })
    }
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    showError(errorMsg || t('agentDetail.purchaseFailed') || '购买失败')
    logger.error('Agent purchase exception:', error)
  } finally {
    buying.value = false
  }
}

// 收藏/取消收藏
const handleFavorite = async () => {
  const user = authStore.user as { uuid?: string } | undefined
  if (!agent.value || !user?.uuid) {
    showWarning(t('agentDetail.pleaseLogin'))
    return
  }
  try {
    const response = await toggleAgentCollect({
      uuid: (authStore.user as { uuid?: string }).uuid || '',
      botId: String(agent.value.id),
    })
    if (response.code === 200 || response.success) {
      const isCollect = response.data?.is_collect ?? false
      agent.value.isFavorite = isCollect
      showSuccess(isCollect ? t('agents.favoriteSuccess') : t('agents.unfavoriteSuccess'))
      // 记录使用
      await recordAgentUse({
        uuid: (authStore.user as { uuid?: string }).uuid || '',
        botId: String(agent.value.id),
      })
    } else {
      showError(response.message || t('agents.favoriteFailed'))
    }
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    showError(errorMsg || t('agents.favoriteFailed'))
  }
}

// 取消收藏（保留兼容性）
const handleUnfavorite = handleFavorite

// 点赞/取消点赞
const handleThumbs = async () => {
  const user = authStore.user as { uuid?: string } | undefined
  if (!agent.value || !user?.uuid) {
    showWarning(t('agentDetail.pleaseLogin'))
    return
  }
  try {
    const response = await toggleAgentThumbs({
      uuid: (authStore.user as { uuid?: string }).uuid || '',
      botId: String(agent.value.id),
    })
    if (response.code === 200 || response.success) {
      const action = response.data?.action
      showSuccess(
        action === 'add' ? t('agentDetail.thumbsUpSuccess') : t('agentDetail.thumbsUpCancelSuccess')
      )
      // 可以更新本地点赞数
      const agentTyped = agent.value as { likeCount?: number }
      if (agentTyped.likeCount !== undefined) {
        agentTyped.likeCount += action === 'add' ? 1 : -1
      }
    }
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    showError(errorMsg || t('agentDetail.operationFailed'))
  }
}

// 刷新智能体详情
const handleRefreshCwDetails = async () => {
  if (!agent.value) return
  refreshingDetails.value = true
  try {
    const response = await fetchAgentDetails(String(agent.value.id))
    if (response.code === 200 || response.success) {
      agentDetails.value = (response.data?.details ? (response.data.details as Record<string, unknown>) : null)
      showSuccess(t('agentDetail.detailRefreshSuccess'))
      // 重新加载智能体详情
      await loadAgentDetail()
    } else {
      showError(response.message || t('agentDetail.refreshFailed'))
    }
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    showError(errorMsg || t('agentDetail.refreshFailed'))
  } finally {
    refreshingDetails.value = false
  }
}

// 加载智能体详细信息
const loadAgentDetails = async () => {
  if (!agent.value) return
  try {
    const response = await getAgentDetails(String(agent.value.id), false)
    if (response.code === 200 || response.success) {
      agentDetails.value = (response.data ? (response.data as Record<string, unknown>) : null)
    }
  } catch (_error) {
    // 静默失败
  }
}

// 分享
const handleShare2 = () => {
  if (!agent.value) return
  const url = `${window.location.origin}/agents/${String(agent.value.id)}`
  navigator.clipboard.writeText(url).then(
    () => {
      showSuccess(t('agentDetail.linkCopied'))
    },
    () => {
      showError(t('agentDetail.copyFailed'))
    }
  )
}

// 使用统一的导航 composable
const { isNavigating: _isNavigating, safeNavigate } = useSafeNavigation({
  componentName: 'AgentDetail',
})

// 点击智能体
const handleAgentClick = (agent: Agent, event?: MouseEvent) => {
  safeNavigate(`/agents/${String(agent.id)}`, event)
}

// 点击工具
const handleToolClick = (tool: { id: string }, event?: MouseEvent) => {
  safeNavigate(`/agents/${tool.id}`, event)
}

// 获取平台标签类型
const getPlatformTagType = (platform?: AgentPlatform): string => {
  switch (platform) {
    case 'coze':
      return 'success'
    case 'n8n':
      return 'warning'
    case 'dify':
      return 'primary'
    case 'make':
      return 'info'
    case 'dashscope':
      return 'danger'
    default:
      return ''
  }
}

// 获取平台名称
const getPlatformName = (platform?: AgentPlatform): string => {
  switch (platform) {
    case 'coze':
      return t('agents.platformCoze')
    case 'n8n':
      return t('agents.platformN8n')
    case 'dify':
      return t('agents.platformDify')
    case 'make':
      return t('agents.platformMake')
    case 'dashscope':
      return t('agents.platformDashscope')
    case 'internal':
      return t('agents.platformInternal')
    default:
      return ''
  }
}

// 获取平台图标
const getPlatformIcon = (platform?: AgentPlatform): string => {
  const icons: Record<string, string> = {
    coze: '🤖',
    n8n: '⚙️',
    dify: '🎯',
    make: '🔧',
    dashscope: '☁️',
    internal: '🏠',
  }
  return icons[platform || ''] || '🔗'
}

// 获取状态标签类型
const getStatusTagType = (status: string): string => {
  switch (status) {
    case 'active':
      return 'success'
    case 'inactive':
      return 'info'
    case 'deprecated':
      return 'danger'
    default:
      return ''
  }
}

// 获取状态文本
const getStatusText = (status: string): string => {
  switch (status) {
    case 'active':
      return t('agentDetail.statusActive')
    case 'inactive':
      return t('agentDetail.statusInactive')
    case 'deprecated':
      return t('agentDetail.statusDeprecated')
    default:
      return status
  }
}

// 格式化数字
const formatNumber = (num: number): string => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

// 格式化时间
const formatTime = (time?: string): string => {
  if (!time) return t('agents.never')
  const date = new Date(time)
  return date.toLocaleString('zh-CN')
}

// 获取上线天数
const getDaysSince = (time?: string): number => {
  if (!time) return 0
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// 初始化
onMounted(() => {
  loadAgentDetail()
})
</script>

<style scoped lang="scss">
@use './AgentDetail.vue.styles';
</style>
