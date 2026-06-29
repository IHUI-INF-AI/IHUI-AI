<template>
  <div class="agentic-ai-page page-container">
    <div class="page-header">
      <div
        class="header-content"
        style="display: flex; justify-content: space-between; align-items: center"
      >
        <div>
          <h1 class="page-title">{{ t('agenticAI.title') }}</h1>
          <p class="page-subtitle">{{ t('agenticAI.subtitle') }}</p>
        </div>
        <MCPQuickCall />
      </div>
    </div>

    <el-row :gutter="20">
      <!-- 左侧：创建Swarm -->
      <el-col :span="8">
        <el-card>
          <template #header>
            <span>{{ t('agenticAI.createSwarm') }}</span>
          </template>

          <el-form :model="swarmForm" label-width="100px">
            <el-form-item :label="t('agenticAI.taskDescription')" required>
              <el-input
                v-model="swarmForm.task"
                type="textarea"
                :rows="4"
                :placeholder="t('agenticAI.taskDescriptionPlaceholder')"
              />
            </el-form-item>

            <el-form-item :label="t('agenticAI.coordinationMode')">
              <el-select v-model="swarmForm.coordination">
                <el-option :label="t('agenticAI.coordinationHierarchical')" value="hierarchical" />
                <el-option :label="t('agenticAI.coordinationPeerToPeer')" value="peer-to-peer" />
                <el-option :label="t('agenticAI.coordinationMarketBased')" value="market-based" />
              </el-select>
            </el-form-item>

            <el-form-item :label="t('agenticAI.maxIterations')">
              <el-input-number v-model="swarmForm.maxIterations" :min="1" :max="20" />
            </el-form-item>

            <el-form-item>
              <el-checkbox v-model="swarmForm.autoOptimize">{{
                t('agenticAI.autoOptimize')
              }}</el-checkbox>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                @click="createSwarm"
                :loading="creating"
                :disabled="!swarmForm.task"
              >
                {{ t('agenticAI.createAndExecute') }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- Swarm列表 -->
        <el-card style="margin-top: 20px">
          <template #header>
            <span>{{ t('agenticAI.mySwarm') }}</span>
          </template>

          <el-table :data="swarmList" style="width: 100%">
            <el-table-column
              prop="swarm_id"
              :label="t('agenticAI.id')"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column prop="task" :label="t('agenticAI.task')" show-overflow-tooltip />
            <el-table-column prop="status" :label="t('agenticAI.status.title')" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('agenticAI.actions')" width="100">
              <template #default="{ row }">
                <el-button link size="small" @click="viewSwarm(row.swarm_id)">
                  {{ t('agenticAI.view') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 右侧：Swarm监控 -->
      <el-col :span="16">
        <AgentSwarmMonitor v-if="selectedSwarmId" :swarm-id="selectedSwarmId" />
        <el-empty v-else :description="t('agenticAI.selectSwarmHint')" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
 
import { ref, onMounted } from 'vue'
import { logger } from '../utils/logger'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import {
  createAgenticSwarm,
  getUserSwarms,
  type CreateSwarmRequest,
} from '@/api/services/agentic.service'
import AgentSwarmMonitor from '@/components/ai/AgentSwarmMonitor.vue'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import MCPQuickCall from '@/components/mcp/MCPQuickCall.vue'

const { showWarning, showSuccess, showError: showErrorMsg } = useOperationFeedback()

const { t } = useI18n()
const authStore = useAuthStore()

// 为 swarmForm 添加明确的类型注解，确保 coordination 字段的类型正确
const swarmForm = ref<{
  task: string
  coordination: 'hierarchical' | 'peer-to-peer' | 'market-based'
  maxIterations: number
  autoOptimize: boolean
}>({
  task: '',
  coordination: 'hierarchical',
  maxIterations: 10,
  autoOptimize: false,
})

const creating = ref(false)
interface SwarmItem {
  swarm_id: string
  task: string
  status: string
}
const swarmList = ref<SwarmItem[]>([])
const selectedSwarmId = ref<string>('')

const getStatusType = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger',
  }
  return statusMap[status] || 'info'
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: t('agenticAI.status.pending'),
    running: t('agenticAI.status.running'),
    completed: t('agenticAI.status.completed'),
    failed: t('agenticAI.status.failed'),
  }
  return statusMap[status] || status
}

const createSwarm = async () => {
  if (!swarmForm.value.task.trim()) {
    showWarning(t('agenticAI.enterTaskDescription'))
    return
  }

  creating.value = true
  try {
    const requestData: CreateSwarmRequest = {
      task: swarmForm.value.task,
      userId: (authStore.user as { uuid?: string })?.uuid,
      options: {
        coordination: swarmForm.value.coordination,
        maxIterations: swarmForm.value.maxIterations,
      },
      autoOptimize: swarmForm.value.autoOptimize,
    }

    const response = await createAgenticSwarm(requestData)

    if (response.code === 200 && response.data) {
      showSuccess(t('agenticAIPage.swarmCreated'))
      selectedSwarmId.value = response.data.swarmId || ''
      swarmForm.value.task = ''
      loadSwarmList()
    } else {
      showErrorMsg(response.message || t('agenticAIPage.createSwarmFailed'))
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    logger.error('Failed to create Swarm:', err)
    showErrorMsg(err?.message || t('agenticAIPage.createSwarmFailed2'))
  } finally {
    creating.value = false
  }
}

const loadSwarmList = async () => {
  if (!(authStore.user as { uuid?: string })?.uuid) return

  try {
    const response = await getUserSwarms((authStore.user as { uuid?: string }).uuid, {
      page: 1,
      pageSize: 20,
    })

    if (response.code === 200 && response.data) {
      // 将 items 转换为列表格式，兼容现有数据结构
      swarmList.value = (response.data.items || []).map(
        (item: { swarmId?: string; swarm_id?: string; task?: string; status?: string }) => ({
          swarm_id: item.swarmId || item.swarm_id || '',
          task: item.task || '',
          status: item.status || 'pending',
        })
      ) as SwarmItem[]
    }
  } catch (error: unknown) {
    logger.error('Failed to load Swarm list', error)
  }
}

const viewSwarm = (swarmId: string) => {
  selectedSwarmId.value = swarmId
}

onMounted(() => {
  loadSwarmList()
})
</script>

<style lang="scss" scoped>
.agentic-ai-page {
  padding: 20px;
  width: 100%;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
  text-align: center;

  .page-title {
    font-size: 32px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .page-subtitle {
    font-size: 16px;
    color: var(--el-text-color-regular);
  }
}
</style>
