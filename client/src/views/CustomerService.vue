<template>
  <div class="customer-service-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Service /></el-icon>
        {{ t('customerService.title') }}
      </h1>
      <p class="page-subtitle">{{ t('customerService.subtitle') }}</p>
    </div>

    <!-- 功能选项卡 -->
    <el-tabs v-model="activeTab" class="service-tabs">
      <!-- 在线客服 -->
      <el-tab-pane :label="t('customerService.chat.title')" name="chat">
        <div class="chat-container">
          <ChatWindow
            :conversation-id="chatConversationId"
            @close="handleChatClose"
          />
        </div>
      </el-tab-pane>

      <!-- 工单系统 -->
      <el-tab-pane :label="t('customerService.ticket.title')" name="tickets">
        <SupportTickets />
      </el-tab-pane>

      <!-- 常见问题 -->
      <el-tab-pane :label="t('customerService.faq.title')" name="faq">
        <div class="faq-container">
          <el-card v-loading="loadingFAQs" class="faq-card">
            <template v-if="faqs.length > 0">
              <el-collapse v-model="activeFAQ">
                <el-collapse-item
                  v-for="faq in faqs"
                  :key="faq.id"
                  :name="faq.id"
                  :title="faq.question"
                >
                  <div class="faq-answer">{{ faq.answer }}</div>
                </el-collapse-item>
              </el-collapse>
            </template>
            <el-empty v-else :description="t('customerService.faq.noFAQs')" />
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Service } from '@element-plus/icons-vue'
import ChatWindow from '@/components/customer-service/ChatWindow.vue'
import SupportTickets from '@/views/SupportTickets.vue'
import { getFAQs, type FAQ } from '@/api/customer-service'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()

const activeTab = ref<'chat' | 'tickets' | 'faq'>('chat')
const chatConversationId = ref<string>('')
const { loading: loadingFAQs, execute: executeApi } = useApiError({ showMessage: false })
const faqs = ref<FAQ[]>([])
const activeFAQ = ref<string[]>([])

const DEFAULT_FAQS: FAQ[] = [
  { id: 'faq-1', category: 'general', question: '如何联系商务合作？', answer: '请在本页使用「联系商务」或提交工单，我们会尽快与您联系。', order: 1 },
  { id: 'faq-2', category: 'general', question: 'API 调用限制与计费？', answer: '详见开放平台文档的「定价与用量」说明，可按需选择套餐。', order: 2 },
  { id: 'faq-3', category: 'general', question: '遇到问题如何提交工单？', answer: '在客服中心切换到「工单」标签，填写问题类型与描述并提交即可。', order: 3 },
]

// 加载常见问题（接口失败或空时使用兜底数据）
const loadFAQs = async () => {
  const data = await executeApi(() => getFAQs())
  if (data !== null && typeof data === 'object') {
    const faqData = data as { list?: FAQ[] }
    if (faqData.list && faqData.list.length > 0) {
      faqs.value = faqData.list
      return
    }
  }
  faqs.value = DEFAULT_FAQS
}

// 处理聊天关闭
const handleChatClose = () => {
  // 可以在这里处理聊天关闭逻辑
}

onMounted(() => {
  loadFAQs()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.customer-service-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 1400px;
  margin: 0 auto;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  text-align: center;
}

.page-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 28px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.title-icon {
  font-size: 32px;
  color: var(--el-color-primary);
}

.page-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.service-tabs {
  :deep(.el-tabs__content) {
    padding: 24px 0;
  }
}

.chat-container {
  height: 600px;
  border-radius: var(--global-border-radius); // 使用项目标准圆角
  overflow: hidden;
  background: var(--el-bg-color);
  border: var(--unified-border); // 扁平化设计：使用边框而非阴影
  // 扁平化设计：无阴影
}

.faq-container {
  .faq-card {
    border-radius: var(--global-border-radius); // 使用项目标准圆角
    min-height: 400px;

    // 扁平化设计：el-card 默认无阴影
  }

  .faq-answer {
    padding: 16px;
    line-height: 1.8;
    color: var(--el-text-color-primary);
  }
}
</style>
