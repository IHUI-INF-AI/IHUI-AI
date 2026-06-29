<template>
  <div class="p19-page">
    <h2 class="p19-title">{{ t('p19AgentsList.title') }}</h2>
    <el-row :gutter="16" v-loading="loading">
      <el-col v-for="a in agents" :key="a.id" :span="6">
        <el-card shadow="hover" class="p19-agent">
          <div class="p19-agent-header">
            <el-avatar :size="40">{{ a.name?.slice(0, 1) }}</el-avatar>
            <div>
              <div class="p19-agent-name">{{ a.name }}</div>
              <el-tag size="small" :type="a.status === 'online' ? 'success' : 'info'">
                {{ a.status }}
              </el-tag>
            </div>
          </div>
          <div class="p19-agent-desc">{{ a.description }}</div>
          <div class="p19-agent-stats">
            <span>{{ t('p19AgentsList.calls') }} {{ a.calls }}</span>
            <span>{{ t('p19AgentsList.rating') }} {{ a.rating }}</span>
          </div>
          <el-button type="primary" size="small" class="p19-agent-btn" @click="hit(a.id, a.name)">
            {{ t('p19AgentsList.call') }}
          </el-button>
        </el-card>
      </el-col>
    </el-row>
    <el-dialog v-model="answerVisible" :title="t('p19AgentsList.answerTitle')" width="500">
      <p>{{ answer }}</p>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ElMessage } from 'element-plus'
import { v2Agents } from '@/api/v2-business'

const loading = ref(false)
const agents_ = ref<unknown[]>([])
const answerVisible = ref(false)
const answer = ref('')

async function load() {
  loading.value = true
  try {
    const r = await v2Agents.list({ page: 1, size: 20 }) as unknown as { data?: { items?: unknown[]; records?: unknown[] } }
    agents_.value = r?.data?.items || r?.data?.records || []
  } catch (e: unknown) {
    const err = e as { message?: string }
    ElMessage.error(t('common.errors.loadAgentFailed') + ': ' + (err?.message || e))
  } finally {
    loading.value = false
  }
}

async function hit(agentId: number, _name: string) {
  try {
    const r = await v2Agents.info(String(agentId)) as unknown as { data?: { description?: string } }
    answer.value = r?.data?.description || '[无回答]'
    answerVisible.value = true
  } catch (e: unknown) {
    const err = e as { message?: string }
    ElMessage.error(t('common.errors.callFailed') + ': ' + (err?.message || e))
  }
}

onMounted(load)
</script>

<style scoped>
.p19-page {
  padding: 24px;
}

.p19-title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
}

.p19-agent {
  margin-bottom: 16px;
}

.p19-agent-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.p19-agent-name {
  font-size: 15px;
  font-weight: 600;
}

.p19-agent-desc {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 12px;
  min-height: 40px;
}

.p19-agent-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
}

.p19-agent-btn {
  width: 100%;
}
</style>
