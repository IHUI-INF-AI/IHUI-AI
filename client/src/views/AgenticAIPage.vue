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

    <div class="flex flex-wrap gap-5">
      <!-- 左侧：创建Swarm -->
      <div class="w-1/3">
        <Card><CardHeader>
            <span>{{ t('agenticAI.createSwarm') }}</span>
          </CardHeader><CardContent class="p-5">
          
          <form @submit.prevent>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('agenticAI.taskDescription') }}</label>
              <div class="flex-1">
                <Textarea
                  v-model="swarmForm.task"
                  :rows="4"
                  :placeholder="t('agenticAI.taskDescriptionPlaceholder')"
                />
              </div>
            </div>

            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('agenticAI.coordinationMode') }}</label>
              <div class="flex-1">
                <Select v-model="swarmForm.coordination">
                  <SelectOption :label="t('agenticAI.coordinationHierarchical')" value="hierarchical" />
                  <SelectOption :label="t('agenticAI.coordinationPeerToPeer')" value="peer-to-peer" />
                  <SelectOption :label="t('agenticAI.coordinationMarketBased')" value="market-based" />
                </Select>
              </div>
            </div>

            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('agenticAI.maxIterations') }}</label>
              <div class="flex-1">
                <el-input-number v-model="swarmForm.maxIterations" :min="1" :max="20" />
              </div>
            </div>

            <div class="mb-4">
              <Checkbox v-model="swarmForm.autoOptimize">{{
                t('agenticAI.autoOptimize')
              }}</Checkbox>
            </div>

            <div class="mb-4">
              <Button
                variant="default"
                @click="createSwarm"
                :disabled="!swarmForm.task"
              >
                {{ t('agenticAI.createAndExecute') }}
              </Button>
            </div>
          </form>
        </CardContent></Card>

        <!-- Swarm列表 -->
        <Card style="margin-top: 20px"><CardHeader>
            <span>{{ t('agenticAI.mySwarm') }}</span>
          </CardHeader><CardContent class="p-5">
          
          <Table class="w-full">
            <TableHeader>
              <TableRow>
                <TableHead class="w-[120px]">{{ t('agenticAI.id') }}</TableHead>
                <TableHead>{{ t('agenticAI.task') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('agenticAI.status.title') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('agenticAI.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in swarmList" :key="row.swarm_id ?? index">
                <TableCell class="max-w-[200px] truncate" :title="row.swarm_id">{{ row.swarm_id }}</TableCell>
                <TableCell class="max-w-[400px] truncate" :title="row.task">{{ row.task }}</TableCell>
                <TableCell>
                  <Tag :type="getStatusType(row.status)">
                    {{ getStatusText(row.status) }}
                  </Tag>
                </TableCell>
                <TableCell>
                  <Button variant="link" size="sm" @click="viewSwarm(row.swarm_id)">
                    {{ t('agenticAI.view') }}
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>

      <!-- 右侧：Swarm监控 -->
      <div class="w-2/3">
        <AgentSwarmMonitor v-if="selectedSwarmId" :swarm-id="selectedSwarmId" />
        <Empty v-else :description="t('agenticAI.selectSwarmHint')" />
      </div>
    </div>
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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Empty } from '@/components/ui/empty'
import { Checkbox } from '@/components/ui/checkbox'
import Button from '@/components/ui/Button.vue'
import { Textarea } from '@/components/ui/textarea'
import { Tag } from '@/components/ui/tag'
import { Select, SelectOption } from '@/components/ui/select'

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
