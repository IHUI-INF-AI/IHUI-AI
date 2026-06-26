<template>
  <div class="database-optimization">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <h2>{{ t('adminComponents.databaseOptimization.title') }}</h2>
          <el-button type="primary" @click="refreshData">
            <el-icon><Refresh /></el-icon>
            {{ t('commonText.view') }}
          </el-button>
        </div>
      </template>

      <el-row :gutter="20">
        <el-col :span="8">
          <el-statistic title="总表数量" :value="stats.tableCount" />
        </el-col>
        <el-col :span="8">
          <el-statistic title="总记录数" :value="stats.recordCount" />
        </el-col>
        <el-col :span="8">
          <el-statistic title="数据库大小" :value="stats.dbSize" suffix="MB" />
        </el-col>
      </el-row>

      <el-divider />

      <h3>{{ t('adminComponents.databaseOptimization.operations') }}</h3>
      <el-space>
        <el-button type="primary" @click="optimizeTables">
          <el-icon><MagicStick /></el-icon>
          优化表结构
        </el-button>
        <el-button type="warning" @click="clearCache">
          <el-icon><Delete /></el-icon>
          清理缓存
        </el-button>
        <el-button type="danger" @click="vacuumDatabase">
          <el-icon><FirstAidKit /></el-icon>
          压缩数据库
        </el-button>
      </el-space>

      <el-divider />

      <h3>{{ t('adminComponents.databaseOptimization.tableStatus') }}</h3>
      <el-table :data="tableStatus" class="full-width" v-loading="loading">
        <el-table-column prop="name" label="表名" />
        <el-table-column prop="rows" label="记录数" />
        <el-table-column prop="size" label="大小 (MB)" />
        <el-table-column prop="fragmentation" label="碎片率">
          <template #default="{ row }">
            <el-progress
              :percentage="row.fragmentation"
              :status="row.fragmentation > 30 ? 'exception' : 'success'"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('adminComponents.userManagement.actions')" width="120">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="optimizeTable(row.name)">
              {{ t('adminComponents.databaseOptimization.operations') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, MagicStick, Delete, FirstAidKit } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useCleanup } from '@/composables/useCleanup'

const { t } = useI18n()

interface TableStatus {
  name: string
  rows: number
  size: number
  fragmentation: number
}

interface Stats {
  tableCount: number
  recordCount: number
  dbSize: number
}

const loading = ref(false)
const stats = ref<Stats>({
  tableCount: 0,
  recordCount: 0,
  dbSize: 0,
})

const tableStatus = ref<TableStatus[]>([])

const cleanup = useCleanup()

// 加载状态定时器引用，用于手动清除前一个定时器
let statusTimer: ReturnType<typeof setTimeout> | null = null

const loadData = () => {
  loading.value = true
  setTimeout(() => {
    stats.value = {
      tableCount: 24,
      recordCount: 125680,
      dbSize: 256.5,
    }
    tableStatus.value = [
      { name: 'users', rows: 15234, size: 45.2, fragmentation: 15 },
      { name: 'agents', rows: 8921, size: 32.1, fragmentation: 8 },
      { name: 'conversations', rows: 45678, size: 128.5, fragmentation: 35 },
      { name: 'messages', rows: 234567, size: 456.8, fragmentation: 42 },
      { name: 'settings', rows: 156, size: 2.3, fragmentation: 5 },
    ]
    loading.value = false
  }, 500)
}

const refreshData = () => {
  loadData()
  ElMessage.success(t('commonText.success'))
}

const optimizeTables = async () => {
  try {
    await ElMessageBox.confirm(t('adminComponents.databaseOptimization.confirmOptimize'), t('adminComponents.userManagement.tip'), {
      type: 'warning',
    })
    loading.value = true
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = cleanup.addTimer(() => {
      loading.value = false
      ElMessage.success(t('commonText.success'))
    }, 2000)
  } catch {
    // 用户取消操作
  }
}

const clearCache = async () => {
  try {
    await ElMessageBox.confirm(t('adminComponents.databaseOptimization.confirmClearCache'), t('adminComponents.userManagement.tip'), {
      type: 'warning',
    })
    ElMessage.success(t('commonText.success'))
  } catch {
    // 用户取消操作
  }
}

const vacuumDatabase = async () => {
  try {
    await ElMessageBox.confirm(t('adminComponents.databaseOptimization.confirmVacuum'), t('adminComponents.userManagement.tip'), {
      type: 'warning',
    })
    loading.value = true
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = cleanup.addTimer(() => {
      loading.value = false
      ElMessage.success(t('commonText.success'))
    }, 3000)
  } catch {
    // 用户取消操作
  }
}

const optimizeTable = (_tableName: string) => {
  ElMessage.success(t('commonText.success'))
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.database-optimization {
  padding: 20px;

  .page-card {
    max-width: 1200px;
    margin: 0 auto;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h2 {
      margin: 0;
      font-size: 18px;
    }
  }

  h3 {
    margin: 20px 0 16px;
    font-size: 16px;
    font-weight: 500;
  }

  .full-width {
    width: 100%;
  }
}
</style>
