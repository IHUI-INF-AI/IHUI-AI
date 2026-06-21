<template>
  <div class="agent-manager">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('agentManager.title') }}</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            {{ t('agentManager.createAgent') }}
          </el-button>
        </div>
      </template>

      <!-- 智能体列表 -->
      <el-table :data="agentList" v-loading="loading">
        <el-table-column prop="name" :label="t('agentManager.name')" width="200" />
        <el-table-column prop="type" :label="t('agentManager.type')" width="120">
          <template #default="scope">
            <el-tag :type="getTypeTagType(scope.row.type)">
              {{ getTypeLabel(scope.row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="model.primary" :label="t('agentManager.model')" width="150" />
        <el-table-column prop="status" :label="t('agentManager.status')" width="100">
          <template #default="scope">
            <el-tag :type="getStatusTagType(scope.row.status)">
              {{ getStatusLabel(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="200" fixed="right">
          <template #default="scope">
            <el-button size="small" type="primary" @click="testAgent(scope.row)">
              {{ t('agentManager.test') }}
            </el-button>
            <el-button size="small" @click="editAgent(scope.row)">
              {{ t('common.edit') }}
            </el-button>
            <el-button size="small" type="danger" @click="deleteAgent(scope.row)">
              {{ t('common.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 智能体测试对话框 -->
    <el-dialog
      v-model="testDialogVisible"
      :title="t('agentManager.testAgent')"
      width="800px"
      :close-on-click-modal="false"
    >
      <AIChat mode="agent" :agent-id="currentAgentId" />
    </el-dialog>

    <!-- 创建/编辑智能体对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingAgent ? t('agentManager.editAgent') : t('agentManager.createAgent')"
      width="600px"
    >
      <el-form :model="agentForm" label-width="100px">
        <el-form-item :label="t('agentManager.name')" required>
          <el-input
            v-model="agentForm.name"
            :placeholder="t('agentManager.agentNamePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('agentManager.type')" required>
          <el-select
            v-model="agentForm.type"
            :placeholder="t('agentManager.selectTypePlaceholder')"
          >
            <el-option :label="t('agentManager.typeReasoning')" value="reasoning" />
            <el-option :label="t('agentManager.typeActing')" value="acting" />
            <el-option :label="t('agentManager.typeSpecialist')" value="specialist" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('agentManager.model')">
          <el-select
            v-model="agentForm.model.primary"
            :placeholder="t('agentManager.selectModelPlaceholder')"
          >
            <el-option label="GPT-4" value="gpt-4" />
            <el-option label="GPT-3.5" value="gpt-3.5-turbo" />
            <el-option label="Claude 3" value="claude-3" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('agentManager.systemPrompt')">
          <el-input
            v-model="agentForm.prompt.system"
            type="textarea"
            :rows="4"
            :placeholder="t('agentManager.systemPromptPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveAgent">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { Plus } from '@/lib/lucide-fallback'
const AIChat = defineAsyncComponent(() => import('./AIChat.vue'))
import { useI18n } from 'vue-i18n'
import { getAgentsList, createAgent, deleteAgent as deleteAgentApi, updateAgent as updateAgentApi } from '@/api/agents'
import type { Agent as ApiAgent } from '@/api/agents'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()
const { confirm } = useConfirmDialog()

interface Agent {
  agentId: string
  name: string
  type: string
  model: {
    primary: string
    fallback?: string
  }
  prompt?: {
    system?: string
  }
  status?: string
}

const agentList = ref<Agent[]>([])
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const testDialogVisible = ref(false)
const currentAgentId = ref<string | null>(null)
const showCreateDialog = ref(false)
const editingAgent = ref<Agent | null>(null)

const agentForm = ref({
  name: '',
  type: 'reasoning',
  model: {
    primary: 'gpt-4',
  },
  prompt: {
    system: '',
  },
})

onMounted(() => {
  loadAgents()
})

const loadAgents = async () => {
  const res = await executeApi(() => getAgentsList({
    page: 1,
    pageSize: 10,
    sortBy: 'createTime',
    sortOrder: 'desc',
    platform: 'all'
  }))
  // executeApi 返回的是 PaginationResponse<Agent> | null（已提取 data）
  if (res && res.list) {
    agentList.value = (res.list || []).map((agent: ApiAgent) => ({
      agentId: String(agent.id),
      name: (agent as ApiAgent).agentName ?? (agent as ApiAgent).name ?? '',
      type: agent.type || 'reasoning',
      model: {
        primary: (agent as { model?: { primary?: string } }).model?.primary || 'gpt-4',
      },
      prompt: {
        system: (agent as { prompt?: { system?: string } }).prompt?.system || '',
      },
      status: agent.status || 'active',
    }))
  }
}

const testAgent = (agent: Agent) => {
  currentAgentId.value = agent.agentId
  testDialogVisible.value = true
}

const editAgent = (agent: Agent) => {
  editingAgent.value = agent
  agentForm.value = {
    name: agent.name,
    type: agent.type,
    model: agent.model,
    prompt: {
      system: agent.prompt?.system || '',
    },
  }
  showCreateDialog.value = true
}

const deleteAgent = async (agent: Agent) => {
  const confirmed = await confirm(
    t('agentManager.deleteConfirm', { name: agent.name }),
    t('agentManager.deleteTitle'),
    { type: 'warning' }
  )
  if (!confirmed) return

  try {
    await deleteAgentApi(agent.agentId)
    showSuccess(t('aiList.deleteSuccess'))
    loadAgents()
  } catch (error: any) {
      logger.error(t('common.errors.deleteFailed'), error)
    showError(error instanceof Error ? error.message : t('aiList.deleteFailed'))
  }
}

const saveAgent = async () => {
  try {
    if (editingAgent.value) {
      const updateData = {
        name: agentForm.value.name,
        type: agentForm.value.type,
        model: {
          provider: 'openai',
          primary: agentForm.value.model.primary,
        },
        prompt: agentForm.value.prompt,
      }
      await updateAgentApi(updateData)
      showSuccess(t('aiList.updateSuccess'))
    } else {
      const createData = {
        agent_name: agentForm.value.name,
        type: agentForm.value.type,
        model: {
          provider: 'openai',
          primary: agentForm.value.model.primary,
        },
        prompt: agentForm.value.prompt,
      }
      const res = await createAgent(createData)
      showSuccess(t('aiList.createSuccess'))
      currentAgentId.value = String(res.data?.id ?? (res.data as { agent_id?: string })?.agent_id ?? '')
    }

    showCreateDialog.value = false
    editingAgent.value = null
    agentForm.value = {
      name: '',
      type: 'reasoning',
      model: { primary: 'gpt-4' },
      prompt: { system: '' },
    }
    loadAgents()
  } catch (error) {
    logger.error(editingAgent.value ? 'Update agent failed:' : 'Create agent failed:', error)
    showError(editingAgent.value ? t('aiList.updateFailed') : t('aiList.createFailed'))
  }
}

const getTypeTagType = (type: string) => {
  const map: Record<string, string> = {
    reasoning: 'primary',
    acting: 'success',
    specialist: 'warning',
  }
  return map[type] || 'info'
}

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    reasoning: t('agentManager.typeReasoning'),
    acting: t('agentManager.typeActing'),
    specialist: t('agentManager.typeSpecialist'),
  }
  return map[type] || type
}

const getStatusTagType = (status?: string) => {
  const map: Record<string, string> = {
    active: 'success',
    inactive: 'info',
    deprecated: 'danger',
  }
  return map[status || 'active'] || 'info'
}

const getStatusLabel = (status?: string) => {
  const map: Record<string, string> = {
    active: t('agentManager.statusActive'),
    inactive: t('agentManager.statusInactive'),
    deprecated: t('agentManager.statusDeprecated'),
  }
  return map[status || 'active'] || t('agentManager.statusUnknown')
}
</script>

<style scoped lang="scss">
.agent-manager {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
