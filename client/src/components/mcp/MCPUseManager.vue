<template>
  <div class="mcp-use-manager">
    <!-- 页面头部 -->
    <el-card class="header-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <h2 class="page-title">
              <el-icon><Network /></el-icon>
              {{ t('mcpUse.manager.title') }}
            </h2>
            <p class="page-subtitle">{{ t('mcpUse.manager.subtitle') }}</p>
          </div>
          <div class="header-actions">
            <el-button @click="goToProject">
              <el-icon><FileText /></el-icon>
              {{ t('mcpUse.manager.viewProject') }}
            </el-button>
            <el-button type="primary" @click="showConnectDialog = true">
              <el-icon><Plus /></el-icon>
              {{ t('mcpUse.manager.connectServer') }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- 统计信息 -->
      <div class="stats-grid">
        <el-statistic
          :value="connectedServers.length"
          :title="t('mcpUse.manager.connectedServers')"
        >
          <template #prefix>
            <el-icon><Server /></el-icon>
          </template>
        </el-statistic>
        <el-statistic :value="agents.length" :title="t('mcpUse.manager.agents')">
          <template #prefix>
            <el-icon><Cpu /></el-icon>
          </template>
        </el-statistic>
        <el-statistic :value="totalToolCalls" :title="t('mcpUse.manager.totalToolCalls')">
          <template #prefix>
            <el-icon><Wrench /></el-icon>
          </template>
        </el-statistic>
        <el-statistic :value="successRate" :title="t('mcpUse.manager.successRate')">
          <template #suffix>%</template>
        </el-statistic>
      </div>
    </el-card>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="main-tabs">
      <!-- 服务器管理标签页 -->
      <el-tab-pane :label="t('mcpUse.manager.servers')" name="servers">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('mcpUse.manager.connectedServers') }}</span>
              <el-button link @click="refreshServers">
                <el-icon><RefreshCw /></el-icon>
                {{ t('common.refresh') }}
              </el-button>
            </div>
          </template>

          <el-table
            v-loading="loading"
            :data="connectedServers"
            style="width: 100%"
            empty-text="暂无连接的服务器"
          >
            <el-table-column prop="serverUrl" :label="t('mcpUse.manager.serverUrl')" />
            <el-table-column prop="timeout" :label="t('mcpUse.manager.timeout')" width="120">
              <template #default="{ row }">{{ row.timeout || 30000 }}ms</template>
            </el-table-column>
            <el-table-column :label="t('mcpUse.manager.status')" width="120">
              <template #default>
                <el-tag type="success">
                  <el-icon><CheckCircle /></el-icon>
                  {{ t('mcpUse.manager.connected') }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('common.operation')" width="200">
              <template #default="{ row }">
                <el-button link size="small" @click="testNetwork(row)">
                  {{ t('mcpUse.manager.test') }}
                </el-button>
                <el-button link size="small" type="danger" @click="disconnectServerHandler(row)">
                  {{ t('mcpUse.manager.disconnect') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- Agent管理标签页 -->
      <el-tab-pane :label="t('mcpUse.manager.agents')" name="agents">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('mcpUse.manager.agents') }}</span>
              <el-button type="primary" @click="showCreateAgentDialog = true">
                <el-icon><Plus /></el-icon>
                {{ t('mcpUse.manager.createAgent') }}
              </el-button>
            </div>
          </template>

          <el-table v-loading="loading" :data="agents" style="width: 100%" empty-text="暂无Agent">
            <el-table-column prop="name" :label="t('mcpUse.manager.agentName')" />
            <el-table-column prop="description" :label="t('mcpUse.manager.description')" />
            <el-table-column prop="model" :label="t('mcpUse.manager.model')" width="150" />
            <el-table-column prop="tools" :label="t('mcpUse.manager.tools')" width="200">
              <template #default="{ row }">
                <el-tag
                  v-for="tool in row.tools"
                  :key="tool"
                  size="small"
                  style="margin-right: 4px"
                >
                  {{ tool }}
                </el-tag>
                <span v-if="!row.tools || row.tools.length === 0">
                  {{ t('mcpUse.manager.autoSelect') }}
                </span>
              </template>
            </el-table-column>
            <el-table-column :label="t('common.operation')" width="250">
              <template #default="{ row }">
                <el-button link size="small" type="primary" @click="runAgentTask(row)">
                  <el-icon><Play /></el-icon>
                  {{ t('mcpUse.manager.run') }}
                </el-button>
                <el-button link size="small" @click="editAgent(row)">
                  {{ t('common.edit') }}
                </el-button>
                <el-button link size="small" type="danger" @click="deleteAgent(row.name)">
                  {{ t('common.delete') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 任务执行标签页 -->
      <el-tab-pane :label="t('mcpUse.manager.tasks')" name="tasks">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('mcpUse.manager.taskExecution') }}</span>
            </div>
          </template>

          <div class="task-execution">
            <el-form :model="taskForm" label-width="120px">
              <el-form-item :label="t('mcpUse.manager.selectAgent')">
                <el-select
                  v-model="taskForm.agentId"
                  :placeholder="t('mcpUse.manager.selectAgentPlaceholder')"
                  style="width: 100%"
                >
                  <el-option
                    v-for="agent in agents"
                    :key="(agent as { agentName?: string }).agentName ?? agent.name"
                    :label="(agent as { agentName?: string }).agentName ?? agent.name"
                    :value="(agent as { agentName?: string }).agentName ?? agent.name"
                  >
                    <div>
                      <div>{{ (agent as { agentName?: string }).agentName ?? agent.name }}</div>
                      <div style="font-size: 12px; color: var(--el-text-color-placeholder)">
                        {{ (agent as { prologue?: string }).prologue ?? agent.description }}
                      </div>
                    </div>
                  </el-option>
                </el-select>
              </el-form-item>

              <el-form-item :label="t('mcpUse.manager.task')">
                <el-input
                  v-model="taskForm.task"
                  type="textarea"
                  :rows="4"
                  :placeholder="t('mcpUse.manager.taskPlaceholder')"
                />
              </el-form-item>

              <el-form-item :label="t('mcpUse.manager.context')">
                <el-input
                  v-model="taskForm.contextJson"
                  type="textarea"
                  :rows="3"
                  :placeholder="t('mcpUse.manager.contextPlaceholder')"
                />
                <div class="form-tip">
                  {{ t('mcpUse.manager.contextTip') }}
                </div>
              </el-form-item>

              <el-form-item>
                <el-button type="primary" :loading="taskLoading" @click="executeTask">
                  <el-icon><Play /></el-icon>
                  {{ t('mcpUse.manager.execute') }}
                </el-button>
                <el-button @click="clearTaskForm">
                  {{ t('common.clear') }}
                </el-button>
              </el-form-item>
            </el-form>

            <!-- 执行结果 -->
            <el-card
              v-if="taskResult"
              class="result-card"
              :class="{ 'result-success': taskResult.success, 'result-error': !taskResult.success }"
            >
              <template #header>
                <div class="card-header">
                  <span>{{ t('mcpUse.manager.result') }}</span>
                  <el-button link @click="copyResult">
                    <el-icon><Copy /></el-icon>
                    {{ t('common.copy') }}
                  </el-button>
                </div>
              </template>

              <div v-if="taskResult.success" class="result-content">
                <el-alert
                  type="success"
                  :title="t('mcpUse.manager.executionSuccess')"
                  :closable="false"
                  style="margin-bottom: 16px"
                />
                <pre class="result-data">{{ JSON.stringify(taskResult.data, null, 2) }}</pre>

                <!-- 工具调用记录 -->
                <div
                  v-if="taskResult.toolCalls && taskResult.toolCalls.length > 0"
                  class="tool-calls"
                >
                  <h4>{{ t('mcpUse.manager.toolCalls') }}</h4>
                  <el-timeline>
                    <el-timeline-item
                      v-for="(call, index) in taskResult.toolCalls"
                      :key="index"
                      :timestamp="call.tool"
                    >
                      <pre>{{ JSON.stringify(call.result, null, 2) }}</pre>
                    </el-timeline-item>
                  </el-timeline>
                </div>
              </div>

              <div v-else class="result-content">
                <el-alert
                  type="error"
                  :title="t('mcpUse.manager.executionFailed')"
                  :description="taskResult.error"
                  :closable="false"
                />
              </div>
            </el-card>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 连接服务器对话框 -->
    <el-dialog v-model="showConnectDialog" :title="t('mcpUse.manager.connectServer')" width="600px">
      <el-form ref="connectFormRef" :model="connectForm" :rules="connectRules" label-width="120px">
        <el-form-item :label="t('mcpUse.manager.serverId')" prop="serverId">
          <el-input
            v-model="connectForm.serverId"
            :placeholder="t('mcpUse.manager.serverIdPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('mcpUse.manager.serverUrl')" prop="serverUrl">
          <el-input
            v-model="connectForm.serverUrl"
            :placeholder="t('mcpUse.manager.serverUrlPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('mcpUse.manager.apiKey')" prop="apiKey">
          <el-input
            v-model="connectForm.apiKey"
            type="password"
            :placeholder="t('mcpUse.manager.apiKeyPlaceholder')"
            show-password
          />
        </el-form-item>
        <el-form-item :label="t('mcpUse.manager.timeout')" prop="timeout">
          <el-input-number
            v-model="connectForm.timeout"
            :min="1000"
            :max="60000"
            :step="1000"
            style="width: 100%"
          />
          <div class="form-tip">{{ t('mcpUse.manager.timeoutTip') }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConnectDialog = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="loading" @click="handleConnect">
          {{ t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 创建Agent对话框 -->
    <el-dialog
      v-model="showCreateAgentDialog"
      :title="t('mcpUse.manager.createAgent')"
      width="700px"
    >
      <el-form ref="agentFormRef" :model="agentForm" :rules="agentRules" label-width="120px">
        <el-form-item :label="t('mcpUse.manager.agentId')" prop="agentId">
          <el-input
            v-model="agentForm.agentId"
            :placeholder="t('mcpUse.manager.agentIdPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('mcpUse.manager.agentName')" prop="name">
          <el-input
            v-model="agentForm.name"
            :placeholder="t('mcpUse.manager.agentNamePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('mcpUse.manager.description')" prop="description">
          <el-input
            v-model="agentForm.description"
            type="textarea"
            :rows="2"
            :placeholder="t('mcpUse.manager.descriptionPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('mcpUse.manager.model')" prop="model">
          <el-select
            v-model="agentForm.model"
            :placeholder="t('mcpUse.manager.modelPlaceholder')"
            style="width: 100%"
          >
            <el-option label="GPT-4" value="gpt-4" />
            <el-option label="GPT-3.5" value="gpt-3.5-turbo" />
            <el-option label="Claude 3.5" value="claude-3-5-sonnet" />
            <el-option label="Claude 3" value="claude-3-opus" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('mcpUse.manager.temperature')" prop="temperature">
          <el-slider v-model="agentForm.temperature" :min="0" :max="2" :step="0.1" show-input />
        </el-form-item>
        <el-form-item :label="t('mcpUse.manager.tools')" prop="tools">
          <el-select
            v-model="agentForm.tools"
            multiple
            filterable
            :placeholder="t('mcpUse.manager.toolsPlaceholder')"
            style="width: 100%"
          >
            <el-option :label="t('mcpUse.manager.autoSelect')" value="auto" />
            <el-option
              v-for="tool in availableWrench"
              :key="tool.id"
              :label="tool.name"
              :value="tool.id"
            >
              <div>
                <div>{{ tool.name }}</div>
                <div style="font-size: 12px; color: var(--el-text-color-placeholder)">
                  {{ tool.description || t('mcp.manager.noDescription') }}
                </div>
              </div>
            </el-option>
          </el-select>
          <div class="form-tip">{{ t('mcpUse.manager.toolsTip') }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateAgentDialog = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="loading" @click="handleCreateAgent">
          {{ t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import {
  Plus,
  RefreshCw,
  Network,
  Cpu,
  Wrench,
  CheckCircle,
  Play,
  Copy,
  FileText,
} from '@/lib/lucide-fallback'
import { useRouter } from 'vue-router'
import { useMCPUse } from '@/composables/useMCPUse'
import { useMCP } from '@/composables/useMCP'
import type { MCPUseClientConfig, MCPUseAgentConfig } from '@/services/mcp-use-adapter'
import type { MCPCallResult } from '@/composables/useMCP'
import type { FormInstance, FormRules } from 'element-plus'

const { t } = useI18n()
const { showSuccess, showError, showWarning, showInfo } = useOperationFeedback()
const { confirm } = useConfirmDialog()
const router = useRouter()
const {
  loading,
  connectedServers,
  agents,
  connectServer,
  createAgent,
  runAgent,
  disconnectServer: disconnect,
  deleteAgent: deleteAgentFunc,
  refresh,
} = useMCPUse()

// 获取MCP工具列表
const { allTools, loadMCPServers } = useMCP()
const availableWrench = computed(() => {
  const tools: Array<{ id: string; name: string; description?: string }> = []
  for (const toolItem of allTools.value) {
    tools.push({
      id: `${toolItem.server.id}:${toolItem.tool.name}`,
      name: toolItem.tool.name,
      description: toolItem.tool.description,
    })
  }
  return tools
})

// 状态
const activeTab = ref('servers')
const showConnectDialog = ref(false)
const showCreateAgentDialog = ref(false)
const taskLoading = ref(false)
const taskResult = ref<MCPCallResult | null>(null)

// 连接表单
const connectFormRef = ref<FormInstance | null>(null)
const connectForm = ref({
  serverId: '',
  serverUrl: '',
  apiKey: '',
  timeout: 30000,
})

const connectRules: FormRules = {
  serverId: [{ required: true, message: t('mcpUse.manager.serverIdRequired'), trigger: 'blur' }],
  serverUrl: [
    { required: true, message: t('mcpUse.manager.serverUrlRequired'), trigger: 'blur' },
    { type: 'url', message: t('mcpUse.manager.serverUrlInvalid'), trigger: 'blur' },
  ],
}

// Agent表单
const agentFormRef = ref<FormInstance | null>(null)
const agentForm = ref({
  agentId: '',
  name: '',
  description: '',
  model: 'gpt-4',
  temperature: 0.7,
  tools: [] as string[],
})

const agentRules: FormRules = {
  agentId: [{ required: true, message: t('mcpUse.manager.agentIdRequired'), trigger: 'blur' }],
  name: [{ required: true, message: t('mcpUse.manager.agentNameRequired'), trigger: 'blur' }],
}

// 任务表单
const taskForm = ref({
  agentId: '',
  task: '',
  contextJson: '{}',
})

// 计算属性
const totalToolCalls = computed(() => {
  // 这里应该从历史记录中统计
  return 0
})

const successRate = computed(() => {
  // 这里应该从历史记录中计算
  return 100
})

// 方法
const refreshServers = () => {
  refresh()
  showSuccess(t('common.refreshSuccess'))
}

const handleConnect = async () => {
  if (!connectFormRef.value) return

  await connectFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      const success = await connectServer(connectFormRef.value!.serverId, {
        serverUrl: connectFormRef.value!.serverUrl,
        apiKey: connectFormRef.value!.apiKey,
        timeout: connectFormRef.value!.timeout,
      })

      if (success) {
        showConnectDialog.value = false
        connectFormRef.value.resetFields()
      }
    }
  })
}

const handleCreateAgent = async () => {
  if (!agentFormRef.value) return

  await agentFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      // 处理工具选择：如果选择了"auto"或为空，则设为undefined（自动选择）
      let tools: string[] | undefined = agentFormRef.value!.tools
      if (!tools || tools.length === 0 || tools.includes('auto')) {
        tools = undefined
      } else {
        // 移除"auto"选项（如果存在）
        tools = tools.filter(tool => tool !== 'auto')
      }

      const success = await createAgent(agentFormRef.value!.agentId, {
        name: agentFormRef.value!.name,
        description: agentFormRef.value!.description,
        model: agentFormRef.value!.model,
        temperature: agentFormRef.value!.temperature,
        tools,
      })

      if (success) {
        showCreateAgentDialog.value = false
        agentFormRef.value.resetFields()
      }
    }
  })
}

const testNetwork = async (_server: MCPUseClientConfig) => {
  showInfo(t('mcpUse.manager.testing'))
  // 这里应该实现实际的测试逻辑
  showSuccess(t('mcpUse.manager.testSuccess'))
}

const disconnectServerHandler = async (server: MCPUseClientConfig) => {
  try {
    const confirmed = await confirm(t('mcpUse.manager.disconnectConfirm'), t('common.confirm'), {
      type: 'warning',
    })
    if (!confirmed) return
    // 从connectedServers中找到对应的serverId
    const serverId = connectedServers.value.findIndex(s => s.serverUrl === server.serverUrl)
    if (serverId !== -1) {
      // 使用serverUrl作为标识符断开连接
      disconnect(server.serverUrl)
    }
  } catch {
    // 用户取消
  }
}

const runAgentTask = (agent: MCPUseAgentConfig) => {
  activeTab.value = 'tasks'
  taskForm.value.agentId = (agent as { agentName?: string; name?: string }).agentName ?? agent.name
}

const editAgent = (agent: MCPUseAgentConfig) => {
  const a = agent as { agentName?: string; name?: string; description?: string; prologue?: string }
  agentForm.value = {
    agentId: a.agentName ?? agent.name,
    name: a.agentName ?? agent.name,
    description: a.description ?? a.prologue ?? '',
    model: agent.model || 'gpt-4',
    temperature: agent.temperature || 0.7,
    tools: agent.tools || [],
  }
  showCreateAgentDialog.value = true
}

const _deleteAgentHandler = async (agentId: string) => {
  try {
    const confirmed = await confirm(t('mcpUse.manager.deleteAgentConfirm'), t('common.confirm'), {
      type: 'warning',
    })
    if (!confirmed) return
    deleteAgentFunc(agentId)
  } catch {
    // 用户取消
  }
}

const executeTask = async () => {
  if (!taskForm.value.agentId || !taskForm.value.task) {
    showWarning(t('mcpUse.manager.fillRequiredFields'))
    return
  }

  taskLoading.value = true
  taskResult.value = null

  try {
    let context: Record<string, unknown> = {}
    if (taskForm.value.contextJson) {
      try {
        context = JSON.parse(taskForm.value.contextJson)
      } catch {
        showWarning(t('mcpUse.manager.contextInvalid'))
        taskLoading.value = false
        return
      }
    }

    const result = await runAgent(taskForm.value.agentId, taskForm.value.task, context)
    taskResult.value = result
  } catch (error: unknown) {
    const err = error as { message?: string }
    showError(err?.message || t('mcpUse.manager.executionFailed'))
  } finally {
    taskLoading.value = false
  }
}

const clearTaskForm = () => {
  taskForm.value = {
    agentId: '',
    task: '',
    contextJson: '{}',
  }
  taskResult.value = null
}

const copyResult = () => {
  if (taskResult.value) {
    navigator.clipboard.writeText(JSON.stringify(taskResult.value, null, 2))
    showSuccess(t('common.copySuccess'))
  }
}

const goToProject = () => {
  router.push('/mcp-use-project')
}

// 生命周期
onMounted(async () => {
  refresh()
  // 加载MCP服务器以获取可用工具
  try { await loadMCPServers() } catch (e) { console.error(e) }
})
</script>

<style scoped lang="scss">
/* MCP Use Manager - 使用 CSS 变量，使用 CSS 变量控制 */
.mcp-use-manager {
  --manager-max-width: 100%;
  
  padding: 20px;
  max-width: var(--manager-max-width);
  margin: 0 auto;

  .header-card {
    margin-bottom: 20px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .header-left {
        .page-title {
          margin: 0 0 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 24px;
          font-weight: 600;
        }

        .page-subtitle {
          margin: 0;
          color: var(--el-text-color-secondary);
          font-size: 14px;
        }
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-top: 20px;

      @media (width <= 768px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  }

  .main-tabs {
    :deep(.el-tabs__content) {
      padding-top: 20px;
    }
  }

  .task-execution {
    .result-card {
      margin-top: 20px;

      &.result-success {
        border-left: 4px solid var(--el-color-success);
      }

      &.result-error {
        border-left: 4px solid var(--el-color-danger);
      }

      .result-content {
        .result-data {
          background: var(--el-fill-color-light);
          padding: 16px;
          border-radius: var(--global-border-radius);
          overflow-x: auto;
          font-size: 12px;
          line-height: 1.6;
        }

        .tool-calls {
          margin-top: 20px;

          h4 {
            margin-bottom: 12px;
            font-size: 16px;
          }
        }
      }
    }
  }

  .form-tip {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    margin-top: 4px;
  }
}
</style>
