<template>
  <section class="ai-report-section">
    <el-tabs v-model="activeTab" type="border-card" class="ai-tabs">
      <!-- ① 本地分析 tab（前端规则引擎，实时计算） -->
      <el-tab-pane name="local" :label="t('edu.profile.aiReportLocal')">
        <div class="tab-body">
          <div v-if="localLoading" class="loading-wrap">
            <el-skeleton :rows="4" animated />
          </div>
          <div v-else-if="localSuggestions.length" class="suggestions-list">
            <div
              v-for="s in localSuggestions"
              :key="s.id"
              class="suggestion-item"
              :class="`cat-${s.category}`"
            >
              <div class="suggestion-header">
                <el-tag :type="categoryTagType(s.category)" size="small" effect="light">
                  {{ t(`edu.profile.aiCat_${s.category}`) }}
                </el-tag>
                <span v-if="s.subject" class="suggestion-subject">{{ s.subject }}</span>
              </div>
              <div class="suggestion-body">
                <h4 class="suggestion-title">{{ t(s.title) }}</h4>
                <p class="suggestion-desc">{{ t(s.description) }}</p>
                <p v-if="s.actionable" class="suggestion-actionable">
                  <el-icon><Promotion /></el-icon>
                  <span>{{ t(s.actionable) }}</span>
                </p>
              </div>
            </div>
          </div>
          <el-empty v-else :description="t('edu.profile.aiReportEmpty')" />
        </div>
      </el-tab-pane>

      <!-- ② AI 深度咨询 tab（调 useGlobalChat.open 传 prompt） -->
      <el-tab-pane name="chat" :label="t('edu.profile.aiReportChat')">
        <div class="tab-body chat-entry">
          <el-icon :size="40" class="chat-icon"><ChatDotRound /></el-icon>
          <p class="chat-desc">{{ t('edu.profile.aiReportChatDesc') }}</p>
          <el-button
            type="primary"
            :loading="chatLoading"
            :icon="Promotion"
            @click="handleOpenChat"
          >
            {{ t('edu.profile.aiReportChatOpen') }}
          </el-button>
        </div>
      </el-tab-pane>

      <!-- ③ AI 报告生成 tab（调 aiReportApi.generate，返回 markdown） -->
      <el-tab-pane name="api" :label="t('edu.profile.aiReportApi')">
        <div class="tab-body">
          <div v-if="apiLoading" class="loading-wrap">
            <el-skeleton :rows="8" animated />
          </div>
          <div v-else-if="apiReport" class="api-report-wrap">
            <div class="api-report-meta">
              <span class="meta-item">
                <el-icon><Clock /></el-icon>
                {{ formatTime(apiReport.generated_at) }}
              </span>
              <span class="meta-item">
                <el-icon><Cpu /></el-icon>
                {{ apiReport.model }}
              </span>
              <span class="meta-item">
                <el-icon><Coin /></el-icon>
                {{ apiReport.tokens_used }} tokens
              </span>
              <el-button
                size="small"
                :icon="Refresh"
                :loading="apiLoading"
                @click="handleGenerateViaApi"
              >
                {{ t('edu.profile.aiReportApiRegenerate') }}
              </el-button>
            </div>
            <!-- markdown 渲染（经 DOMPurify 清理） -->
            <div class="api-report-content" v-html="renderedApiReport" />
          </div>
          <div v-else class="api-entry">
            <el-icon :size="40" class="api-icon"><MagicStick /></el-icon>
            <p class="api-desc">{{ t('edu.profile.aiReportApiDesc') }}</p>
            <el-button
              type="primary"
              :icon="MagicStick"
              @click="handleGenerateViaApi"
            >
              {{ t('edu.profile.aiReportApiGenerate') }}
            </el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  Promotion,
  ChatDotRound,
  MagicStick,
  Clock,
  Cpu,
  Coin,
  Refresh,
} from '@element-plus/icons-vue'
import { useAiReportEngine } from '@/composables/useAiReportEngine'
import { useStudentProfile } from '@/composables/useStudentProfile'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { AiSuggestionCategory } from '@/api/edu/ai-report'

const { t } = useI18n()

const {
  localSuggestions,
  chatLoading,
  openChatConsult,
  apiLoading,
  apiReport,
  apiError,
  generateViaApi,
} = useAiReportEngine()

const { loading: profileLoading } = useStudentProfile()

// tab 持久化到 localStorage（PR-D D3 关键点）
const activeTab = ref<'local' | 'chat' | 'api'>('local')
const STORAGE_KEY = 'ai-report-tab'

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'local' || saved === 'chat' || saved === 'api') {
    activeTab.value = saved
  }
})

watch(() => activeTab.value, (val: 'local' | 'chat' | 'api') => {
  localStorage.setItem(STORAGE_KEY, String(val))
})

// local 模式 loading 跟随 useStudentProfile.loading
const localLoading = computed(() => profileLoading.value)

// markdown 渲染（安全：marked + DOMPurify 清理）
const renderedApiReport = computed(() => {
  if (!apiReport.value?.report_text) return ''
  try {
    const html = marked.parse(apiReport.value.report_text) as string
    return DOMPurify.sanitize(html)
  } catch (e) {
    console.error('[AiReportSection] markdown render failed', e)
    return ''
  }
})

function categoryTagType(cat: AiSuggestionCategory): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  const map: Record<AiSuggestionCategory, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    strength: 'success',
    weakness: 'danger',
    plan: 'primary',
    risk: 'warning',
    tip: 'info',
  }
  return map[cat]
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

async function handleOpenChat() {
  try {
    await openChatConsult()
  } catch (e) {
    console.error('[AiReportSection] openChat failed', e)
    ElMessage.error(t('edu.profile.aiReportChatFailed'))
  }
}

async function handleGenerateViaApi() {
  await generateViaApi('month')
  if (apiError.value) {
    ElMessage.error(t('edu.profile.aiReportApiFailed'))
  } else if (apiReport.value) {
    ElMessage.success(t('edu.profile.aiReportApiSuccess'))
  }
}
</script>

<style scoped lang="scss">
.ai-report-section {
  width: 100%;
}

.ai-tabs {
  border-radius: 8px;
  overflow: hidden;
}

.tab-body {
  padding: 8px 4px;
  min-height: 200px;
}

.loading-wrap {
  padding: 16px;
}

/* local 模式：建议列表 */
.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--color-white-30);
  border-left: 4px solid var(--el-color-primary);
  border-radius: 8px;
  background: var(--el-bg-color);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.suggestion-item:hover {
  border-color: var(--color-white-50);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.suggestion-item.cat-strength {
  border-left-color: var(--el-color-success);
}

.suggestion-item.cat-weakness {
  border-left-color: var(--el-color-danger);
}

.suggestion-item.cat-plan {
  border-left-color: var(--el-color-primary);
}

.suggestion-item.cat-risk {
  border-left-color: var(--el-color-warning);
}

.suggestion-item.cat-tip {
  border-left-color: var(--el-color-info);
}

.suggestion-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.suggestion-subject {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.suggestion-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.suggestion-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.suggestion-actionable {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-size: 12px;
  color: var(--el-color-primary);
}

/* chat 模式入口 */
.chat-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 16px;
  text-align: center;
}

.chat-icon {
  color: var(--el-color-primary);
}

.chat-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  max-width: 400px;
  line-height: 1.6;
}

/* api 模式 */
.api-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 16px;
  text-align: center;
}

.api-icon {
  color: var(--el-color-primary);
}

.api-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  max-width: 400px;
  line-height: 1.6;
}

.api-report-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.api-report-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--color-white-30);
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.api-report-meta .meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.api-report-content {
  padding: 16px;
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  background: var(--el-bg-color);
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
}

.api-report-content :deep(h1),
.api-report-content :deep(h2),
.api-report-content :deep(h3) {
  margin: 16px 0 8px;
  font-weight: 600;
}

.api-report-content :deep(h1) {
  font-size: 18px;
}

.api-report-content :deep(h2) {
  font-size: 16px;
}

.api-report-content :deep(h3) {
  font-size: 14px;
}

.api-report-content :deep(ul),
.api-report-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.api-report-content :deep(li) {
  margin: 4px 0;
}

.api-report-content :deep(p) {
  margin: 8px 0;
}

.api-report-content :deep(strong) {
  font-weight: 600;
}

@media (max-width: 640px) {
  .suggestion-item {
    padding: 12px;
  }

  .api-report-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
