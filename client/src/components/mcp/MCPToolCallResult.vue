<template>
  <div class="mcp-tool-call-result">
    <el-card
      :class="{
        'result-success': result.success,
        'result-error': !result.success,
      }"
      shadow="hover"
    >
      <template #header>
        <div class="result-header">
          <div class="result-title">
            <el-icon :class="result.success ? 'success-icon' : 'error-icon'">
              <component :is="result.success ? CheckCircle : XCircle" />
            </el-icon>
            <span class="tool-name">{{ result.toolName }}</span>
            <el-tag :type="result.success ? 'success' : 'danger'" size="small" effect="plain">
              {{ result.success ? t('common.success') : t('common.failed') }}
            </el-tag>
          </div>
          <div class="result-meta">
            <span class="server-name">{{ result.serverId }}</span>
            <span class="timestamp">{{ formatTime(result.timestamp) }}</span>
          </div>
        </div>
      </template>

      <div class="result-content">
        <!-- 成功结果 -->
        <div v-if="result.success && result.data" class="result-data">
          <el-tabs v-model="activeTab">
            <el-tab-pane :label="t('mcp.result.preview')" name="preview">
              <div class="preview-content">
                <MCPResultPreview :data="result.data" />
              </div>
            </el-tab-pane>
            <el-tab-pane :label="t('mcp.result.raw')" name="raw">
              <div class="raw-content">
                <pre>{{ formatData(result.data) }}</pre>
                <el-button link size="small" @click="copyToClipboard(formatData(result.data))">
                  <el-icon><Copy /></el-icon>
                  {{ t('common.copy') }}
                </el-button>
              </div>
            </el-tab-pane>
            <el-tab-pane
              v-if="result.data && typeof result.data === 'object'"
              :label="t('mcp.result.structure')"
              name="structure"
            >
              <div class="structure-content">
                <MCPDataStructure :data="result.data" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- 错误结果 -->
        <div v-if="!result.success" class="result-error">
          <el-alert :title="t('mcp.result.error')" type="error" :closable="false">
            <template #default>
              <p class="error-message">{{ result.error }}</p>
              <div v-if="showRetry" class="error-actions">
                <el-button size="small" @click="handleRetry">
                  {{ t('common.retry') }}
                </el-button>
              </div>
            </template>
          </el-alert>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="result-loading">
          <el-skeleton :rows="3" animated />
        </div>
      </div>

      <template v-if="showActions" #footer>
        <div class="result-actions">
          <el-button link size="small" @click="handleUseResult" :disabled="!result.success">
            <el-icon><Check /></el-icon>
            {{ t('mcp.result.useResult') }}
          </el-button>
          <el-button link size="small" @click="handleExport">
            <el-icon><Download /></el-icon>
            {{ t('common.export') }}
          </el-button>
          <el-button link size="small" @click="handleShare2">
            <el-icon><Share2 /></el-icon>
            {{ t('common.share') }}
          </el-button>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
 
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { CheckCircle, XCircle, Copy, Check, Download, Share2 } from '@/lib/lucide-fallback'
import type { MCPCallResult } from '@/composables/useMCP'
import MCPResultPreview from './MCPResultPreview.vue'
import MCPDataStructure from './MCPDataStructure.vue'

interface Props {
  result: MCPCallResult
  showActions?: boolean
  showRetry?: boolean
}

interface Emits {
  (e: 'retry', result: MCPCallResult): void
  (e: 'use-result', result: MCPCallResult): void
  (e: 'export', result: MCPCallResult): void
  (e: 'share', result: MCPCallResult): void
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
  showRetry: true,
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()
const activeTab = ref('preview')
const loading = ref(false)

const formatData = (data: any): string => {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return data
    }
  }
  return JSON.stringify(data, null, 2)
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(t('common.copySuccess'))
  } catch (_error) {
    showError(t('common.copyFailed'))
  }
}

const handleRetry = () => {
  emit('retry', props.result)
}

const handleUseResult = () => {
  emit('use-result', props.result)
}

const handleExport = () => {
  emit('export', props.result)
}

const handleShare2 = () => {
  emit('share', props.result)
}
</script>

<style scoped lang="scss">
.mcp-tool-call-result {
  margin-bottom: 16px;

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;

    .result-title {
      display: flex;
      align-items: center;
      gap: 8px;

      .tool-name {
        font-weight: 600;
        font-size: 16px;
      }

      .success-icon {
        color: var(--el-color-success);
      }

      .error-icon {
        color: var(--el-color-danger);
      }
    }

    .result-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);

      .server-name {
        font-family: var(--font-family-mono);
        background: var(--el-bg-color-page);
        padding: 2px 6px;
        border-radius: var(--global-border-radius);
      }
    }
  }

  .result-content {
    margin-top: 16px;

    .result-data {
      .preview-content,
      .raw-content,
      .structure-content {
        max-height: 400px;
        overflow-y: auto;
        padding: 12px;
        background: var(--el-bg-color-page);
        border-radius: var(--global-border-radius);

        pre {
          margin: 0;
          font-family: var(--font-family-mono);
          font-size: 12px;
          line-height: 1.6;
        }
      }
    }

    .result-error {
      .error-message {
        margin: 8px 0;
        font-family: var(--font-family-mono);
        font-size: 13px;
      }

      .error-actions {
        margin-top: 12px;
      }
    }

    .result-loading {
      padding: 20px;
    }
  }

  .result-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
}
</style>
