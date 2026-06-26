<template>
  <div class="mcp-manager">
    <el-card class="mcp-header-card">
      <template #header>
        <div class="card-header">
          <span class="header-title">{{ t('mcp.manager.title') }}</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            {{ t('mcp.manager.addServer') }}
          </el-button>
        </div>
      </template>

      <!-- 统计信息 -->
      <div class="stats-row">
        <el-statistic :value="activeServers.length" :title="t('mcp.manager.activeServers')" />
        <el-statistic :value="allTools.length" :title="t('mcp.manager.availableTools')" />
        <el-statistic :value="callHistory.length" :title="t('mcp.manager.callHistory')" />
      </div>
    </el-card>

    <!-- 服务器列表 -->
    <el-card class="mcp-servers-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('mcp.manager.servers') }}</span>
          <el-button link @click="refreshServers">
            <el-icon><RefreshCw /></el-icon>
            {{ t('common.refresh') }}
          </el-button>
        </div>
      </template>

      <el-table v-loading="serversLoading" :data="availableServers" style="width: 100%">
        <el-table-column prop="name" :label="t('mcp.manager.serverName')" />
        <el-table-column prop="protocol" :label="t('mcp.manager.protocol')">
          <template #default="{ row }">
            <el-tag :type="getProtocolTagType(row.protocol)">
              {{ MCP_PROTOCOLS[row.protocol]?.name || row.protocol }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" :label="t('mcp.manager.status')">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">
              {{ t(`mcp.status.${row.status}`) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="tools" :label="t('mcp.manager.toolsCount')" width="100">
          <template #default="{ row }">
            {{ getServerToolsCount(row.id) }}
          </template>
        </el-table-column>
        <el-table-column :label="t('common.operation')" width="200">
          <template #default="{ row }">
            <el-button link size="small" @click="viewServerDetails(row)">
              {{ t('common.view') }}
            </el-button>
            <el-button link size="small" @click="testServer(row)">
              {{ t('mcp.manager.test') }}
            </el-button>
            <el-button link size="small" type="danger" @click="deleteServer(row)">
              {{ t('common.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 工具市场 -->
    <el-card class="mcp-tools-card">
      <template #header>
        <span>{{ t('mcp.manager.toolsMarket') }}</span>
      </template>

      <el-input
        v-model="toolSearchKeyword"
        :placeholder="t('mcp.manager.searchTools')"
        clearable
        style="margin-bottom: 16px"
      >
        <template #prefix>
          <SearchIcon />
        </template>
      </el-input>

      <el-row :gutter="16">
        <el-col
          v-for="toolItem in filteredTools"
          :key="`${toolItem.server.id}-${toolItem.tool.name}`"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
        >
          <el-card class="tool-card" shadow="hover" @click="showToolDialog(toolItem)">
            <div class="tool-card-header">
              <h4>{{ toolItem.tool.name }}</h4>
              <el-tag size="small" effect="plain">
                {{ toolItem.server.name }}
              </el-tag>
            </div>
            <p class="tool-description">
              {{ toolItem.tool.description || t('mcp.manager.noDescription') }}
            </p>
            <div class="tool-actions">
              <el-button type="primary" size="small" @click.stop="invokeTool(toolItem)">
                {{ t('mcp.manager.useTool') }}
              </el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-empty v-if="filteredTools.length === 0" :description="t('mcp.manager.noTools')" />
    </el-card>

    <!-- 资源管理 -->
    <el-card class="mcp-resources-card">
      <template #header>
        <span>{{ t('mcp.manager.resources') }}</span>
      </template>

      <el-input
        v-model="resourceSearchKeyword"
        :placeholder="t('mcp.manager.searchResources')"
        clearable
        style="margin-bottom: 16px"
      >
        <template #prefix>
          <SearchIcon />
        </template>
      </el-input>

      <el-row :gutter="16">
        <el-col
          v-for="resourceItem in filteredResources"
          :key="`${resourceItem.server.id}-${resourceItem.resource.uri}`"
          :xs="24"
          :sm="12"
          :md="8"
        >
          <el-card class="resource-card" shadow="hover" @click="viewResource(resourceItem)">
            <div class="resource-card-header">
              <h4>{{ resourceItem.resource.name || resourceItem.resource.uri }}</h4>
              <el-tag size="small" effect="plain">
                {{ resourceItem.server.name }}
              </el-tag>
            </div>
            <p class="resource-card-desc">
              {{ resourceItem.resource.description || t('mcp.manager.noDescription') }}
            </p>
            <div class="resource-card-meta">
              <el-tag size="small" effect="plain">
                {{ resourceItem.resource.mimeType || t('mcp.resource.unknown') }}
              </el-tag>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-empty v-if="filteredResources.length === 0" :description="t('mcp.manager.noResources')" />
    </el-card>

    <!-- 性能监控 -->
    <el-card class="mcp-performance-card">
      <template #header>
        <span>{{ t('mcp.manager.performance') }}</span>
      </template>

      <el-tabs v-model="performanceTab">
        <el-tab-pane :label="t('mcp.performance.overview')" name="overview">
          <div class="performance-stats">
            <el-statistic
              :value="performanceStats.totalCalls"
              :title="t('mcp.performance.totalCalls')"
            />
            <el-statistic
              :value="performanceStats.successRate.toFixed(1) + '%'"
              :title="t('mcp.performance.successRate')"
            />
            <el-statistic
              :value="performanceStats.averageResponseTime.toFixed(0) + 'ms'"
              :title="t('mcp.performance.avgResponseTime')"
            />
            <el-statistic
              :value="performanceStats.toolCount"
              :title="t('mcp.performance.toolCount')"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('mcp.performance.slowest')" name="slowest">
          <el-table :data="slowestTools" style="width: 100%">
            <el-table-column prop="toolName" :label="t('mcp.performance.toolName')" />
            <el-table-column prop="serverId" :label="t('mcp.performance.serverId')" />
            <el-table-column prop="averageResponseTime" :label="t('mcp.performance.avgTime')">
              <template #default="{ row }">{{ row.averageResponseTime.toFixed(0) }}ms</template>
            </el-table-column>
            <el-table-column prop="callCount" :label="t('mcp.performance.callCount')" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="t('mcp.performance.mostUsed')" name="mostUsed">
          <el-table :data="mostUsedTools" style="width: 100%">
            <el-table-column prop="toolName" :label="t('mcp.performance.toolName')" />
            <el-table-column prop="callCount" :label="t('mcp.performance.callCount')" />
            <el-table-column prop="successCount" :label="t('mcp.performance.successCount')" />
            <el-table-column prop="failureCount" :label="t('mcp.performance.failureCount')" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 调用历史 -->
    <el-card class="mcp-history-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('mcp.manager.callHistory') }}</span>
          <el-button link size="small" @click="clearHistory">
            {{ t('common.clear') }}
          </el-button>
        </div>
      </template>

      <el-timeline>
        <el-timeline-item
          v-for="(call, index) in callHistory.slice(0, 20)"
          :key="index"
          :timestamp="formatTime(call.timestamp)"
          :type="call.success ? 'success' : 'danger'"
        >
          <div class="history-item">
            <div class="history-header">
              <strong>{{ call.toolName }}</strong>
              <el-tag :type="call.success ? 'success' : 'danger'" size="small">
                {{ call.success ? t('common.success') : t('common.failed') }}
              </el-tag>
            </div>
            <div class="history-details">
              <span class="history-server">{{ call.serverId }}</span>
              <span v-if="call.error" class="history-error">
                {{ call.error }}
              </span>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <!-- 创建/编辑服务器对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingServer ? t('mcp.manager.editServer') : t('mcp.manager.addServer')"
      width="600px"
    >
      <el-form :model="serverForm" label-width="120px">
        <el-form-item :label="t('mcp.manager.serverName')" required>
          <el-input
            v-model="serverForm.name"
            :placeholder="t('mcp.manager.serverNamePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('mcp.manager.protocol')" required>
          <el-select v-model="serverForm.protocol" :placeholder="t('mcp.manager.selectProtocol')">
            <el-option
              v-for="(protocol, key) in MCP_PROTOCOLS"
              :key="key"
              :label="protocol.name"
              :value="key"
            >
              <span>{{ protocol.icon }} {{ protocol.name }}</span>
              <span
                style="color: var(--el-text-color-secondary); font-size: 13px; margin-left: 8px"
              >
                {{ protocol.description }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="t('mcp.manager.url')" required>
          <el-input v-model="serverForm.url" :placeholder="t('mcp.manager.urlPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('mcp.manager.description')">
          <el-input
            v-model="serverForm.description"
            type="textarea"
            :rows="3"
            :placeholder="t('mcp.manager.descriptionPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" @click="saveServer">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 工具调用对话框 -->
    <el-dialog v-model="showToolDialog" :title="selectedTool?.tool.name" width="700px">
      <div v-if="selectedTool">
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="t('mcp.manager.server')">
            {{ selectedTool.server.name }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('mcp.manager.description')">
            {{ selectedTool.tool.description || t('mcp.manager.noDescription') }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <!-- 使用参数表单组件 -->
        <MCPToolParameterForm
          v-model="toolArguments"
          :tool-schema="selectedTool.tool.inputSchema"
          :context="{
            userMessage: '',
            conversationHistory: [],
          }"
        />
      </div>
      <template #footer>
        <el-button @click="showToolDialog = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="executingTool" @click="executeTool">
          {{ t('mcp.manager.execute') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 资源查看对话框 -->
    <el-dialog
      v-model="showResourceDialog"
      :title="selectedResource?.resource.name || selectedResource?.resource.uri"
      width="800px"
    >
      <MCPResourceViewer
        v-if="selectedResource"
        :resource="selectedResource.resource"
        :server-id="selectedResource.server.id"
      />
    </el-dialog>

    <!-- 工具调用结果对话框 -->
    <el-dialog v-model="showToolResultDialog" :title="t('mcp.manager.executeResult')" width="800px">
      <MCPToolCallResult v-if="toolResult" :result="toolResult" :show-actions="true" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { Plus, RefreshCw } from '@/lib/lucide-fallback'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useMCP, type MCPCallResult } from '@/composables/useMCP'
import { useMCPPerformance } from '@/composables/useMCPPerformance'
import {
  createMCPServer,
  updateMCPServer,
  deleteMCPServer,
  testMCPServer,
  type MCPServer,
  type MCPProtocol,
  type MCPTool,
  type MCPResource,
} from '@/api/tools/mcp'
import MCPResourceViewer from './MCPResourceViewer.vue'
import MCPToolParameterForm from './MCPToolParameterForm.vue'
import MCPToolCallResult from './MCPToolCallResult.vue'
import { formatDateTime as formatTime } from '@/utils/format'

const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()
const { confirm } = useConfirmDialog()
const {
  availableServers,
  serversLoading,
  callHistory,
  activeServers,
  allTools,
  allResources,
  serverCapabilitiesCache,
  loadMCPServers,
  getServerCapabilities,
  invokeMCPTool,
} = useMCP()

const { getPerformanceStats, getSlowestTools, getMostUsedTools, clearMetrics } = useMCPPerformance()

const showCreateDialog = ref(false)
const editingServer = ref<MCPServer | null>(null)
const serverForm = ref<Partial<MCPServer>>({
  name: '',
  protocol: 'websocket',
  url: '',
  description: '',
})

const toolSearchKeyword = ref('')
const resourceSearchKeyword = ref('')
const performanceTab = ref('overview')
const showToolDialog = ref(false)
const showResourceDialog = ref(false)
const selectedTool = ref<{
  server: MCPServer
  tool: MCPTool
} | null>(null)
const selectedResource = ref<{
  server: MCPServer
  resource: MCPResource
} | null>(null)
const toolArguments = ref<Record<string, unknown>>({})
const executingTool = ref(false)

const filteredTools = computed(() => {
  if (!toolSearchKeyword.value) {
    return allTools.value
  }
  const keyword = toolSearchKeyword.value.toLowerCase()
  return allTools.value.filter(
    item =>
      (item.tool.name &&
        typeof item.tool.name === 'string' &&
        item.tool.name.toLowerCase().includes(keyword)) ||
      (item.tool.description &&
        typeof item.tool.description === 'string' &&
        item.tool.description.toLowerCase().includes(keyword)) ||
      (item.server.name &&
        typeof item.server.name === 'string' &&
        item.server.name.toLowerCase().includes(keyword))
  )
})

const filteredResources = computed(() => {
  if (!resourceSearchKeyword.value) {
    return allResources.value
  }
  const keyword = resourceSearchKeyword.value.toLowerCase()
  return allResources.value.filter(
    item =>
      (item.resource.name &&
        typeof item.resource.name === 'string' &&
        item.resource.name.toLowerCase().includes(keyword)) ||
      (item.resource.uri &&
        typeof item.resource.uri === 'string' &&
        item.resource.uri.toLowerCase().includes(keyword)) ||
      (item.resource.description &&
        typeof item.resource.description === 'string' &&
        item.resource.description.toLowerCase().includes(keyword)) ||
      (item.server.name &&
        typeof item.server.name === 'string' &&
        item.server.name.toLowerCase().includes(keyword))
  )
})

const performanceStats = computed(() => getPerformanceStats.value)
const slowestTools = computed(() => getSlowestTools.value)
const mostUsedTools = computed(() => getMostUsedTools.value)

const getProtocolTagType = (protocol: MCPProtocol) => {
  const map: Record<MCPProtocol, string> = {
    stdio: 'info',
    sse: 'warning',
    websocket: 'success',
  }
  return map[protocol] || ''
}

const getStatusTagType = (status: string) => {
  const map: Record<string, string> = {
    active: 'success',
    inactive: 'info',
    error: 'danger',
  }
  return map[status] || ''
}

const getServerToolsCount = (serverId: string) => {
  const capabilities = serverCapabilitiesCache.value[serverId]
  return capabilities?.tools?.length || 0
}

const refreshServers = async () => {
  await loadMCPServers()
  // 加载所有服务器的能力
  for (const server of availableServers.value) {
    await getServerCapabilities(server.id)
  }
}

const viewServerDetails = async (server: MCPServer) => {
  editingServer.value = server
  serverForm.value = { ...server }
  showCreateDialog.value = true
}

const testServer = async (server: MCPServer) => {
  try {
    const response = await testMCPServer(server.id)
    if (response.code === 200 && response.success) {
      showSuccess(t('mcp.manager.testSuccess'))
      await refreshServers()
    } else {
      showError(response.message || t('mcp.manager.testFailed'))
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : t('mcp.manager.testFailed')
    showError(errorMessage)
  }
}

const deleteServer = async (server: MCPServer) => {
  const confirmed = await confirm(t('mcp.manager.deleteConfirm'), t('common.warning'), {
    type: 'warning',
  })
  if (!confirmed) return

  try {
    const response = await deleteMCPServer(server.id)
    if (response.code === 200 && response.success) {
      showSuccess(t('mcp.manager.deleteSuccess'))
      await refreshServers()
    } else {
      showError(response.message || t('mcp.manager.deleteFailed'))
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : t('mcp.manager.deleteFailed')
    showError(errorMessage)
  }
}

const saveServer = async () => {
  try {
    let response
    if (editingServer.value) {
      response = await updateMCPServer(editingServer.value.id, serverForm.value)
    } else {
      response = await createMCPServer(serverForm.value)
    }

    if (response.code === 200 && response.success) {
      showSuccess(
        editingServer.value ? t('mcp.manager.updateSuccess') : t('mcp.manager.createSuccess')
      )
      showCreateDialog.value = false
      editingServer.value = null
      serverForm.value = {
        name: '',
        protocol: 'websocket',
        url: '',
        description: '',
      }
      await refreshServers()
    } else {
      showError(response.message || t('mcp.manager.saveFailed'))
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : t('mcp.manager.saveFailed')
    showError(errorMessage)
  }
}

const _showToolDialogFn = (toolItem: { server: MCPServer; tool: MCPTool }) => {
  selectedTool.value = toolItem
  toolArguments.value = {}
  showToolDialog.value = true
}

const invokeTool = async (toolItem: { server: MCPServer; tool: MCPTool }) => {
  selectedTool.value = toolItem
  toolArguments.value = {}
  showToolDialog.value = true
}

const executeTool = async () => {
  if (!selectedTool.value) return

  executingTool.value = true
  try {
    const result = await invokeMCPTool(
      selectedTool.value.server.id,
      selectedTool.value.tool.name,
      toolArguments.value
    )

    if (result.success) {
      showSuccess(t('mcp.manager.executeSuccess'))
      showToolDialog.value = false
      // 显示结果对话框
      showToolResult(result)
    } else {
      showError(result.error || t('mcp.manager.executeFailed'))
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : t('mcp.manager.executeFailed')
    showError(errorMessage)
  } finally {
    executingTool.value = false
  }
}

const showToolResultDialog = ref(false)
const toolResult = ref<MCPCallResult | null>(null)

const showToolResult = (result: MCPCallResult) => {
  toolResult.value = result
  showToolResultDialog.value = true
}

const viewResource = (resourceItem: { server: MCPServer; resource: MCPResource }) => {
  selectedResource.value = resourceItem
  showResourceDialog.value = true
}

const clearHistory = () => {
  callHistory.value = []
  clearMetrics()
  showSuccess(t('mcp.manager.historyCleared'))
}

onMounted(async () => {
  try { await refreshServers() } catch (e) { console.error(e) }
})
</script>

<style scoped lang="scss">
/* MCP Manager - 使用 CSS 变量，使用 CSS 变量控制 */
.mcp-manager {
  --manager-max-width: 100%;
  
  padding: 20px;
  max-width: var(--manager-max-width);
  margin: 0 auto;

  .mcp-header-card {
    margin-bottom: 20px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .header-title {
        font-size: 18px;
        font-weight: 600;
      }
    }

    .stats-row {
      display: flex;
      gap: 40px;
      margin-top: 20px;
    }
  }

  .mcp-servers-card,
  .mcp-tools-card,
  .mcp-history-card {
    margin-bottom: 20px;
  }

  .tool-card {
    margin-bottom: 16px;
    cursor: pointer;
    transition: transform 0.3s, box-shadow 0.3s;

    &:hover {
      
      box-shadow: none;
    }

    .tool-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      h4 {
        margin: 0;
        font-size: 16px;
      }
    }

    .tool-description {
      color: var(--el-text-color-regular);
      font-size: 14px;
      margin: 8px 0;
      min-height: 40px;
    }

    .tool-actions {
      margin-top: 12px;
    }
  }

  .history-item {
    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .history-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: var(--el-text-color-placeholder);

      .history-server {
        font-family: var(--font-family-mono);
      }

      .history-error {
        color: var(--el-color-danger);
      }
    }
  }
}
</style>
