<template>
  <div class="database-optimization">
    <Card class="page-card"><CardHeader>
        <div class="card-header">
          <h2>{{ t('adminComponents.databaseOptimization.title') }}</h2>
          <Button variant="default" @click="refreshData">
            <Refresh class="h-4 w-4" />
            {{ t('commonText.view') }}
          </Button>
        </div>
      </CardHeader><CardContent class="p-5">
      
      <div class="flex flex-wrap gap-5">
        <div class="w-1/3">
          <el-statistic :title="t('adminCommon.stat.tableCount')" :value="stats.tableCount" />
        </div>
        <div class="w-1/3">
          <el-statistic :title="t('adminCommon.stat.recordCount')" :value="stats.recordCount" />
        </div>
        <div class="w-1/3">
          <el-statistic :title="t('adminCommon.stat.dbSize')" :value="stats.dbSize" suffix="MB" />
        </div>
      </div>

      <Divider />

      <h3>{{ t('adminComponents.databaseOptimization.operations') }}</h3>
      <el-space>
        <Button variant="default" @click="optimizeTables">
          <MagicStick class="h-4 w-4" />
          优化表结�?
        </Button>
        <Button variant="secondary" @click="clearCache">
          <Delete class="h-4 w-4" />
          清理缓存
        </Button>
        <Button variant="destructive" @click="vacuumDatabase">
          <FirstAidKit class="h-4 w-4" />
          压缩数据�?
        </Button>
      </el-space>

      <Divider />

      <h3>{{ t('adminComponents.databaseOptimization.tableStatus') }}</h3>
      <div v-if="loading" class="loading-text">加载中...</div>
      <Table v-show="!loading" class="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>表名</TableHead>
            <TableHead>记录数</TableHead>
            <TableHead>大小 (MB)</TableHead>
            <TableHead>碎片率</TableHead>
            <TableHead class="w-[120px]">{{ t('adminComponents.userManagement.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in tableStatus" :key="row.name ?? index">
            <TableCell>{{ row.name }}</TableCell>
            <TableCell>{{ row.rows }}</TableCell>
            <TableCell>{{ row.size }}</TableCell>
            <TableCell>
              <el-progress
                :percentage="row.fragmentation"
                :status="row.fragmentation > 30 ? 'exception' : 'success'"
              />
            </TableCell>
            <TableCell>
              <Button variant="default" size="sm" @click="optimizeTable(row.name)">
                {{ t('adminComponents.databaseOptimization.operations') }}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent></Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, MagicStick, Delete, FirstAidKit } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useCleanup } from '@/composables/useCleanup'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Divider } from '@/components/ui/divider'
import Button from '@/components/ui/Button.vue'

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
}
</style>
