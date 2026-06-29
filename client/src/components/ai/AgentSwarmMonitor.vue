<template>
  <div class="agent-swarm-monitor">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('aiChat.agenticMonitor.title') }}</span>
          <el-button
            v-if="swarmId"
            link
            size="small"
            @click="refreshStatus"
            :loading="loading"
          >
            {{ t('common.refresh') }}
          </el-button>
        </div>
      </template>

      <!-- Swarm信息 -->
      <div v-if="swarmData" class="swarm-info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="Swarm ID">
            {{ swarmData.swarm?.swarmId }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('agentSwarmMonitor.status')">
            <el-tag :type="getStatusType(swarmData.swarm?.status)">
              {{ getStatusText(swarmData.swarm?.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('agentSwarmMonitor.task')">
            {{ swarmData.swarm?.task }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('agentSwarmMonitor.currentIteration')">
            {{ swarmData.swarm?.currentIteration }} / {{ swarmData.swarm?.maxIterations }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- Agent状态 -->
        <div class="agents-status" style="margin-top: 20px">
          <h4>{{ t('agentSwarmMonitor.agentStatus') }}</h4>
          <el-table :data="swarmData.agentList || []" style="width: 100%">
            <el-table-column prop="name" :label="t('agentSwarmMonitor.agentName')" width="150" />
            <el-table-column prop="type" :label="t('agentSwarmMonitor.type')" width="120" />
            <el-table-column prop="status" :label="t('agentSwarmMonitor.status')" width="120">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="currentStep" :label="t('agentSwarmMonitor.currentStep')" />
          </el-table>
        </div>

        <!-- 性能指标 -->
        <div v-if="performanceMetrics" class="performance-metrics" style="margin-top: 20px">
          <h4>{{ t('agentSwarmMonitor.performanceMetrics') }}</h4>
          <el-descriptions :column="3" border>
            <el-descriptions-item :label="t('agentSwarmMonitor.successRate')">
              {{ (performanceMetrics.successRate * 100).toFixed(1) }}%
            </el-descriptions-item>
            <el-descriptions-item :label="t('agentSwarmMonitor.averageExecutionTime')">
              {{ performanceMetrics.averageStepTime }}ms
            </el-descriptions-item>
            <el-descriptions-item :label="t('agentSwarmMonitor.averageTokens')">
              {{ performanceMetrics.averageTokensPerStep }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('agentSwarmMonitor.totalSteps')">
              {{ performanceMetrics.totalSteps }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('agentSwarmMonitor.completedSteps')">
              {{ performanceMetrics.completedSteps }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('agentSwarmMonitor.failedSteps')">
              {{ performanceMetrics.failedSteps }}
            </el-descriptions-item>
          </el-descriptions>

          <div
            v-if="optimizationSuggestions && optimizationSuggestions.length > 0"
            style="margin-top: 15px"
          >
            <h5>{{ t('aiChat.agenticMonitor.optimizationSuggestions') }}</h5>
            <el-alert
              v-for="(suggestion, index) in optimizationSuggestions"
              :key="index"
              :title="suggestion"
              type="info"
              :closable="false"
              style="margin-bottom: 10px"
            />
          </div>
        </div>

        <!-- 执行结果 -->
        <div class="execution-results" style="margin-top: 20px">
          <h4>{{ t('aiChat.agenticMonitor.executionResults') }}</h4>
          <el-timeline>
            <el-timeline-item
              v-for="result in swarmData.results"
              :key="result.step_id"
              :timestamp="formatTime(result.created_at)"
              placement="top"
            >
              <el-card>
                <h4>{{ result.step_action }}</h4>
                <p v-if="result.result" class="result-text">{{ result.result }}</p>
                <p v-if="result.error_message" class="error-text">{{ result.error_message }}</p>

                <!-- 工具调用结果 -->
                <div
                  v-if="result.tool_results && result.tool_results.length > 0"
                  class="tool-results"
                  style="margin-top: 10px"
                >
                  <el-collapse>
                    <el-collapse-item :title="t('agentSwarmMonitor.toolResults')" name="tools">
                      <div
                        v-for="(tool, idx) in result.tool_results"
                        :key="idx"
                        style="margin-bottom: 10px"
                      >
                        <el-tag size="small" type="info">{{ tool.toolId }}</el-tag>
                        <pre
                          v-if="tool.result"
                          style="
                            margin-top: 5px;
                            padding: 10px;
                            background: var(--el-bg-color);
                            border-radius: var(--global-border-radius);
                            font-size: 12px;
                          "
                          >{{ JSON.stringify(tool.result, null, 2) }}</pre
                        >
                        <p v-if="tool.error" class="error-text" style="margin-top: 5px">
                          错误: {{ tool.error }}
                        </p>
                      </div>
                    </el-collapse-item>
                  </el-collapse>
                </div>

                <!-- 反思结果 -->
                <div v-if="result.reflection" class="reflection-result" style="margin-top: 10px">
                  <el-collapse>
                    <el-collapse-item :title="t('agentSwarmMonitor.reflection')" name="reflection">
                      <div v-if="typeof result.reflection === 'string'">
                        <pre
                          style="
                            padding: 10px;
                            background: var(--el-bg-color);
                            border-radius: var(--global-border-radius);
                            font-size: 12px;
                          "
                          >{{ result.reflection }}</pre
                        >
                      </div>
                      <div v-else>
                        <p>
                          <strong>质量:</strong>
                          {{ (result.reflection.quality * 100).toFixed(1) }}%
                        </p>
                        <p>
                          <strong>效率:</strong>
                          {{ (result.reflection.efficiency * 100).toFixed(1) }}%
                        </p>
                        <div v-if="result.reflection.errors && result.reflection.errors.length > 0">
                          <strong>错误:</strong>
                          <ul>
                            <li v-for="(err, idx) in result.reflection.errors" :key="idx">
                              [{{ err.severity }}] {{ err.description }}
                            </li>
                          </ul>
                        </div>
                        <div
                          v-if="
                            result.reflection.improvements &&
                            result.reflection.improvements.length > 0
                          "
                        >
                          <strong>改进建议:</strong>
                          <ul>
                            <li v-for="(imp, idx) in result.reflection.improvements" :key="idx">
                              {{ imp }}
                            </li>
                          </ul>
                        </div>
                      </div>
                    </el-collapse-item>
                  </el-collapse>
                </div>

                <!-- 纠正结果 -->
                <div
                  v-if="result.corrected_result"
                  class="corrected-result"
                  style="margin-top: 10px"
                >
                  <el-alert
                    :title="t('agentSwarmMonitor.corrected')"
                    type="warning"
                    :closable="false"
                    style="margin-bottom: 10px"
                  />
                  <el-collapse>
                    <el-collapse-item
                      :title="t('agentSwarmMonitor.correctedResult')"
                      name="corrected"
                    >
                      <pre
                        style="
                          padding: 10px;
                          background: var(--el-bg-color);
                          border-radius: var(--global-border-radius);
                          font-size: 12px;
                        "
                        >{{
                          typeof result.corrected_result === 'string'
                            ? result.corrected_result
                            : JSON.stringify(result.corrected_result, null, 2)
                        }}</pre
                      >
                    </el-collapse-item>
                  </el-collapse>
                </div>

                <div class="result-meta">
                  <el-tag size="small" :type="result.status === 'completed' ? 'success' : 'danger'">
                    {{ result.status }}
                  </el-tag>
                  <span v-if="result.execution_time" style="margin-left: 10px">
                    执行时间: {{ result.execution_time }}ms
                  </span>
                  <span v-if="result.tokens_used" style="margin-left: 10px">
                    Tokens: {{ result.tokens_used }}
                  </span>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>

      <el-empty v-else :description="t('common.noData')" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useI18n } from 'vue-i18n'
import { io, Socket } from 'socket.io-client'
import {
  getSwarmStatus,
  getSwarmPerformance,
  getSwarmResults,
  type SwarmExecutionResult,
} from '@/api/services/agentic.service'
import { logger } from '../../utils/logger'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useApiError } from '@/composables/useApiError'
import { formatDateTime as formatTime } from '@/utils/format'

const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()

const props = defineProps<{
  swarmId: string
}>()

const { loading, execute: executeApi } = useApiError({ showMessage: false })
const swarmData = ref<{
  swarm?: {
    swarmId?: string
    status?: string
    task?: string
    currentIteration?: number
    maxIterations?: number
    agents?: Array<Record<string, unknown>>
  }
  agentStates?: Record<string, string>
  agentList?: Array<{
    name?: string
    type?: string
    status?: string
    currentStep?: string
    agentId?: string
  }>
  results?: unknown[]
} | null>(null)
const performanceMetrics = ref<{
  successRate?: number
  averageStepTime?: number
  averageTokensPerStep?: number
  totalSteps?: number
  completedSteps?: number
  failedSteps?: number
} | null>(null)
const optimizationSuggestions = ref<string[]>([])
let socket: Socket | null = null
const cleanup = useCleanup()
cleanup.add(() => {
  socket?.disconnect()
  socket = null
})

const getStatusType = (status?: string) => {
  const statusMap: Record<string, string> = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger',
  }
  return statusMap[status || ''] || 'info'
}

const getStatusText = (status?: string) => {
  const statusMap: Record<string, string> = {
    pending: t('aiChat.agenticStatus.pending'),
    running: t('aiChat.agenticStatus.running'),
    completed: t('aiChat.agenticStatus.completed'),
    failed: t('aiChat.agenticStatus.failed'),
    idle: t('aiChat.agenticStatus.idle'),
    thinking: t('aiChat.agenticStatus.thinking'),
    acting: t('aiChat.agenticStatus.acting'),
    reflecting: t('aiChat.agenticStatus.reflecting'),
    waiting: t('aiChat.agenticStatus.pending'),
  }
  return statusMap[status || ''] || status || t('common.unknown')
}

const refreshStatus = async () => {
  if (!props.swarmId) return

  // 获取 Swarm 状态
  const statusResponse = await executeApi(() => getSwarmStatus(props.swarmId))
  // executeApi 返回的是 SwarmStatusResponse | null（已提取 data）
  if (statusResponse) {
    const { swarm, agentStates } = statusResponse

    // 构建 Swarm 数据
    swarmData.value = {
      swarm: swarm as Record<string, unknown>,
      agentStates: agentStates || {},
      agentList: [],
      results: [],
    }

    // 构建Agent列表
    if (swarm && typeof swarm === 'object' && 'agents' in swarm) {
      const agents = Array.isArray(swarm.agents) ? swarm.agents : []

      // 获取执行结果用于显示当前步骤
      try {
        const resultsResponse = await getSwarmResults(props.swarmId)
        const results =
          resultsResponse.code === 200 && resultsResponse.data
            ? Array.isArray(resultsResponse.data)
              ? resultsResponse.data
              : []
            : []

        const agentList = agents.map((agent: Record<string, unknown>) => {
          const filteredResults = results.filter(
            (r: SwarmExecutionResult) =>
              (r.agentId as string) === (agent.agentId as string) && r.status === 'completed'
          )
          const lastResult =
            filteredResults.length > 0 ? filteredResults[filteredResults.length - 1] : undefined

          return {
            ...agent,
            status:
              (agentStates && typeof agent.agentId === 'string' && agentStates[agent.agentId]) ||
              'idle',
            currentStep:
              (lastResult && typeof lastResult.stepAction === 'string'
                ? lastResult.stepAction
                : undefined) || '-',
          }
        })

        if (swarmData.value) {
          swarmData.value.agentList = agentList
          swarmData.value.results = results
        }
      } catch (error) {
        logger.warn(t('aiChat.agenticMonitor.loadResultsFailed'), error)
        // 即使结果加载失败，也显示 Agent 列表
        if (swarmData.value) {
          swarmData.value.agentList = agents.map((agent: Record<string, unknown>) => ({
            ...agent,
            status:
              (agentStates && typeof agent.agentId === 'string' && agentStates[agent.agentId]) ||
              'idle',
            currentStep: '-',
          }))
        }
      }
    }

    // 加载性能指标
    try {
      const perfResponse = await getSwarmPerformance(props.swarmId)
      if (perfResponse.code === 200 && perfResponse.data) {
        const perfData = perfResponse.data as {
          metrics?: typeof performanceMetrics.value
          suggestions?: string[]
        }
        performanceMetrics.value = perfData.metrics || null
        optimizationSuggestions.value = (
          Array.isArray(perfData.suggestions) ? perfData.suggestions : []
        ) as string[]
      }
    } catch (error) {
      // 性能指标加载失败不影响主功能
      logger.warn(t('aiChat.agenticMonitor.loadPerformanceFailed'), error)
    }
  } else {
    showError(t('aiChat.agenticMonitor.getStatusFailed'))
  }
}

const setupWebSocket = () => {
  if (!props.swarmId) return

  socket = io(import.meta.env.VITE_API_BASE_URL || window.location.origin, {
    path: '/socket.io',
  })

  socket.on('connect', () => {
    logger.info(t('aiChat.agenticMonitor.websocketConnected'))
  })

  socket.on('agentic:swarm:started', (data: { swarmId?: string }) => {
    if (data.swarmId === props.swarmId) {
      refreshStatus()
    }
  })

  socket.on('agentic:step:completed', (data: { swarmId?: string }) => {
    if (data.swarmId === props.swarmId) {
      refreshStatus()
    }
  })

  socket.on('agentic:swarm:completed', (data: { swarmId?: string }) => {
    if (data.swarmId === props.swarmId) {
      refreshStatus()
      showSuccess(t('aiChat.agenticMonitor.swarmCompleted'))
    }
  })

  socket.on('agentic:swarm:failed', (data: { swarmId?: string; error?: string }) => {
    if (data.swarmId === props.swarmId) {
      refreshStatus()
      showError(t('aiChat.agenticMonitor.swarmFailed', { error: data.error || t('aiChat.agenticMonitor.unknownError') }))
    }
  })
}

onMounted(() => {
  refreshStatus()
  setupWebSocket()

  // 定时刷新
  cleanup.addInterval(() => {
    if (swarmData.value?.swarm?.status === 'running') {
      refreshStatus()
    }
  }, 3000)
})
</script>

<style lang="scss" scoped>
.agent-swarm-monitor {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .swarm-info {
    .result-text {
      margin: 10px 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .error-text {
      color: var(--el-color-danger);
      margin: 10px 0;
    }

    .result-meta {
      margin-top: 10px;
      display: flex;
      align-items: center;
    }
  }
}
</style>
