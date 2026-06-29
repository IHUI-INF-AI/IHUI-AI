<template>
  <div class="unified-ai-panel">
    <el-card>
      <template #header>
        <div class="panel-header">
          <span class="header-title">{{ t('unifiedAI.title') }}</span>
          <el-button link size="small" @click="refreshCapabilities">
            <el-icon><RefreshCw /></el-icon>
            {{ t('common.refresh') }}
          </el-button>
        </div>
      </template>

      <!-- 能力统计 -->
      <div class="capabilities-stats">
        <el-statistic :value="availableModels.length" :title="t('unifiedAI.models')" />
        <el-statistic :value="availableAgents.length" :title="t('unifiedAI.agents')" />
        <el-statistic :value="availableMCPTools.length" :title="t('unifiedAI.mcpTools')" />
        <el-statistic :value="allCapabilities.length" :title="t('unifiedAI.totalCapabilities')" />
      </div>

      <!-- 快速调用 -->
      <el-card class="quick-invoke-card" shadow="never">
        <template #header>
          <span>{{ t('unifiedAI.quickInvoke') }}</span>
        </template>

        <el-input
          v-model="quickInvokeInput"
          :placeholder="t('unifiedAI.inputPlaceholder')"
          type="textarea"
          :rows="3"
          @keyup.ctrl.enter="handleQuickInvoke"
        />
        <div class="quick-invoke-actions">
          <el-select
            v-model="preferredType"
            :placeholder="t('unifiedAI.selectType')"
            style="width: 200px"
          >
            <el-option :label="t('unifiedAI.autoSelect')" :value="undefined" />
            <el-option :label="t('unifiedAI.typeModel')" :value="AICapabilityType.MODEL" />
            <el-option :label="t('unifiedAI.typeAgent')" :value="AICapabilityType.AGENT" />
            <el-option :label="t('unifiedAI.typeAgentic')" :value="AICapabilityType.AGENTIC" />
            <el-option :label="t('unifiedAI.typeMCP')" :value="AICapabilityType.MCP" />
            <el-option :label="t('unifiedAI.typeHybrid')" :value="AICapabilityType.HYBRID" />
          </el-select>
          <el-button type="primary" :loading="loading" @click="handleQuickInvoke">
            {{ t('unifiedAI.invoke') }}
          </el-button>
        </div>

        <!-- 调用结果 -->
        <div v-if="lastResponse" class="invoke-result">
          <el-divider />
          <MCPToolCallResult
            :result="{
              success: lastResponse.success,
              data: lastResponse.data,
              error: lastResponse.error,
              serverId: lastResponse.capabilityId,
              toolName: lastResponse.capabilityType,
              timestamp: lastResponse.timestamp,
            }"
            :show-actions="true"
          />
        </div>
      </el-card>

      <!-- 能力列表 -->
      <el-tabs v-model="activeTab" class="capabilities-tabs">
        <el-tab-pane :label="t('unifiedAI.models')" name="models">
          <el-table :data="availableModels" style="width: 100%">
            <el-table-column prop="name" :label="t('unifiedAI.name')" />
            <el-table-column prop="provider" :label="t('unifiedAI.provider')" />
            <el-table-column prop="description" :label="t('unifiedAI.description')" />
            <el-table-column :label="t('common.operation')" width="150">
              <template #default="{ row }">
                <el-button
                  link
                  size="small"
                  @click="
                    invokeCapability({
                      type: AICapabilityType.MODEL,
                      capabilityId: row.id,
                      input: quickInvokeInput,
                    })
                  "
                >
                  {{ t('unifiedAI.use') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="t('unifiedAI.agents')" name="agents">
          <el-table :data="availableAgents" style="width: 100%">
            <el-table-column prop="name" :label="t('unifiedAI.name')" />
            <el-table-column prop="description" :label="t('unifiedAI.description')" />
            <el-table-column prop="platform" :label="t('unifiedAI.platform')" />
            <el-table-column :label="t('common.operation')" width="150">
              <template #default="{ row }">
                <el-button
                  link
                  size="small"
                  @click="
                    invokeCapability({
                      type: AICapabilityType.AGENT,
                      capabilityId: row.id,
                      input: quickInvokeInput,
                    })
                  "
                >
                  {{ t('unifiedAI.use') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="t('unifiedAI.mcpTools')" name="mcp">
          <el-table :data="availableMCPTools" style="width: 100%">
            <el-table-column prop="name" :label="t('unifiedAI.name')" />
            <el-table-column prop="description" :label="t('unifiedAI.description')" />
            <el-table-column :label="t('common.operation')" width="150">
              <template #default="{ row }">
                <el-button
                  link
                  size="small"
                  @click="
                    invokeCapability({
                      type: AICapabilityType.MCP,
                      capabilityId: row.metadata?.server?.id + ':' + row.name,
                      input: quickInvokeInput,
                    })
                  "
                >
                  {{ t('unifiedAI.use') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="t('unifiedAI.performance')" name="performance">
          <el-tabs v-model="performanceTab">
            <el-tab-pane :label="t('unifiedAI.performanceStats')" name="stats">
              <el-table :data="performanceStats" style="width: 100%">
                <el-table-column prop="capabilityKey" :label="t('unifiedAI.capability')" />
                <el-table-column prop="callCount" :label="t('unifiedAI.callCount')" />
                <el-table-column prop="successCount" :label="t('unifiedAI.successCount')" />
                <el-table-column prop="averageLatency" :label="t('unifiedAI.avgLatency')">
                  <template #default="{ row }">{{ row.averageLatency.toFixed(0) }}ms</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane :label="t('unifiedAI.cacheStats')" name="cache">
              <el-descriptions :column="2" border>
                <el-descriptions-item :label="t('unifiedAI.cacheTotal')">
                  {{ cacheStats.total }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('unifiedAI.totalHits')">
                  {{ cacheStats.totalHits }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('unifiedAI.avgHitCount')">
                  {{ cacheStats.avgHitCount.toFixed(2) }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('unifiedAI.hitRate')">
                  {{ (cacheStats.hitRate * 100).toFixed(2) }}%
                </el-descriptions-item>
              </el-descriptions>
              <el-button type="danger" style="margin-top: 16px" @click="clearCache">
                {{ t('unifiedAI.clearCache') }}
              </el-button>
            </el-tab-pane>
          </el-tabs>
        </el-tab-pane>

        <el-tab-pane :label="t('unifiedAI.templates')" name="templates">
          <el-select
            v-model="selectedTemplate"
            :placeholder="t('unifiedAI.selectTemplate')"
            style="width: 100%; margin-bottom: 16px"
            filterable
          >
            <el-option
              v-for="template in templates"
              :key="template.id"
              :label="template.name"
              :value="template"
            >
              <div>
                <div>{{ template.name }}</div>
                <div style="font-size: 12px; color: var(--el-text-color-placeholder)">
                  {{ template.description }}
                </div>
              </div>
            </el-option>
          </el-select>
          <el-button
            type="primary"
            :disabled="!selectedTemplate"
            :loading="loading"
            @click="executeSelectedTemplate"
          >
            {{ t('unifiedAI.executeTemplate') }}
          </el-button>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
 
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { RefreshCw } from '@/lib/lucide-fallback'
import { useUnifiedAI } from '@/composables/useUnifiedAI'
import { AICapabilityType } from '@/services/unified-ai-orchestrator'
import { capabilityTemplates, type CapabilityComposition } from '@/services/ai-capability-templates'
import MCPToolCallResult from '@/components/mcp/MCPToolCallResult.vue'

const { t } = useI18n()
const { showSuccess, showError, showWarning, showInfo } = useOperationFeedback()
const {
  loading,
  lastResponse,
  availableModels,
  availableAgents,
  availableMCPTools,
  allCapabilities,
  smartInvoke,
  invokeCapability,
  executeComposition,
  getPerformanceStats,
  getCacheStats,
  clearCache,
} = useUnifiedAI()

const quickInvokeInput = ref('')
const preferredType = ref<AICapabilityType | undefined>(undefined)
const activeTab = ref('models')
const performanceTab = ref('stats')

const performanceStats = computed(() => getPerformanceStats())
const cacheStats = computed(() => getCacheStats())
const templates = ref<CapabilityComposition[]>(capabilityTemplates)
const selectedTemplate = ref<CapabilityComposition | null>(null)

const handleQuickInvoke = async () => {
  if (!quickInvokeInput.value.trim()) {
    showWarning(t('unifiedAI.inputRequired'))
    return
  }

  await smartInvoke(quickInvokeInput.value, {
    preferredType: preferredType.value,
  })
}

const refreshCapabilities = async () => {
  // 重新加载能力
  showInfo(t('unifiedAI.refreshing'))
  // orchestrator 会自动重新加载
}

const executeSelectedTemplate = async () => {
  if (!selectedTemplate.value) return

  loading.value = true
  try {
    const results = await executeComposition(selectedTemplate.value)
    showSuccess(t('unifiedAI.templateExecuted', { count: results.length }))
    // 显示结果
    if (results.length > 0) {
      lastResponse.value = results[results.length - 1]
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    showError(err?.message || t('unifiedAI.templateExecuteFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // 组件挂载时自动加载能力
})
</script>

<style scoped lang="scss">
.unified-ai-panel {
  padding: 20px;

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-title {
      font-size: 18px;
      font-weight: 600;
    }
  }

  .capabilities-stats {
    display: flex;
    gap: 40px;
    margin: 20px 0;
  }

  .quick-invoke-card {
    margin: 20px 0;

    .quick-invoke-actions {
      display: flex;
      gap: 12px;
      margin-top: 12px;
      justify-content: flex-end;
    }

    .invoke-result {
      margin-top: 20px;
    }
  }

  .capabilities-tabs {
    margin-top: 20px;
  }
}
</style>
