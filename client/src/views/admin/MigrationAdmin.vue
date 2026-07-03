<template>
  <div class="migration-admin">
    <h2 class="page-title">{{ t('migrationAdmin.title') }}</h2>

    <!-- 健康检查 -->
    <el-card class="health-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>{{ t('migrationAdmin.healthCheck') }}</span>
          <el-button size="small" @click="loadHealth" :loading="healthLoading">{{ t('common.refresh') }}</el-button>
        </div>
      </template>
      <el-descriptions v-if="health" :column="2" border>
        <el-descriptions-item label="G 盘 zhs_ai_project">{{ health.g_disk?.engines?.ai }}</el-descriptions-item>
        <el-descriptions-item label="G 盘 zhs_center_project">{{ health.g_disk?.engines?.center }}</el-descriptions-item>
        <el-descriptions-item label="G 盘 zhs_educational_training">{{ health.g_disk?.engines?.course }}</el-descriptions-item>
        <el-descriptions-item label="H 盘 member-service">{{ health.h_disk?.['ihui-ai-edu-member-service'] }}</el-descriptions-item>
        <el-descriptions-item label="H 盘 learn-service">{{ health.h_disk?.['ihui-ai-edu-learn-service'] }}</el-descriptions-item>
        <el-descriptions-item label="id_mapping 总数">{{ health.id_mapping_count }}</el-descriptions-item>
        <el-descriptions-item label="checkpoint 总数">{{ health.checkpoint_count }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 批次列表 -->
    <el-card class="batch-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>{{ t('migrationAdmin.batchList') }}</span>
          <el-button size="small" @click="loadBatches" :loading="loading">{{ t('common.refresh') }}</el-button>
        </div>
      </template>
      <el-table :data="batches" border stripe>
        <el-table-column prop="batch_id" label="批次号" width="200" />
        <el-table-column prop="description" label="描述" min-width="280" show-overflow-tooltip />
        <el-table-column prop="task_count" label="任务数" width="80" align="center" />
        <el-table-column label="进度" width="200">
          <template #default="{ row }">
            <el-progress
              :percentage="row.task_count > 0 ? Math.round((row.done_count / row.task_count) * 100) : 0"
              :status="row.failed_count > 0 ? 'exception' : 'success'"
            />
            <span class="progress-text">
              {{ row.done_count }} / {{ row.task_count }} done
              <el-tag v-if="row.running_count > 0" type="warning" size="mini">{{ t('migrationAdmin.running') }} {{ row.running_count }}</el-tag>
              <el-tag v-if="row.failed_count > 0" type="danger" size="mini">{{ t('migrationAdmin.failed') }} {{ row.failed_count }}</el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="数据量" width="200">
          <template #default="{ row }">
            {{ row.migrated_rows.toLocaleString() }} / {{ row.total_rows.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button size="mini" type="primary" @click="runBatch(row, false, false)">{{ t('migrationAdmin.execute') }}</el-button>
            <el-button size="mini" @click="runBatch(row, true, false)">Dry-Run</el-button>
            <el-button size="mini" type="warning" @click="runBatch(row, false, true)">{{ t('migrationAdmin.restart') }}</el-button>
            <el-button size="mini" @click="showCheckpoints(row.batch_id)">{{ t('migrationAdmin.details') }}</el-button>
            <el-button size="mini" @click="verifyBatch(row.batch_id)">{{ t('migrationAdmin.validate') }}</el-button>
            <el-button size="mini" type="danger" @click="confirmRollback(row.batch_id)">{{ t('migrationAdmin.rollback') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 校验结果 -->
    <el-card v-if="verifyResult" class="verify-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>{{ t('migrationAdmin.validationResult') }} {{ verifyResult.batch_id }}</span>
          <el-button size="small" @click="verifyResult = null">{{ t('common.close') }}</el-button>
        </div>
      </template>
      <el-table :data="verifyResult.tables" border>
        <el-table-column prop="source_table" label="H 盘表" />
        <el-table-column prop="target_table" label="G 盘表" />
        <el-table-column prop="h_count" label="H 行数" align="right" />
        <el-table-column prop="g_count" label="G 行数" align="right" />
        <el-table-column prop="ratio" label="覆盖率" align="right">
          <template #default="{ row }">
            <el-tag :type="row.ok ? 'success' : 'danger'">{{ row.ratio }}%</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- checkpoint 明细 -->
    <el-dialog
      v-model="checkpointDialogVisible"
      :title="`Checkpoint 明细: ${currentBatchId}`"
      width="80%"
    >
      <el-table :data="checkpoints" border>
        <el-table-column prop="source_table" label="源表" />
        <el-table-column prop="target_table" label="目标表" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="migrated_rows" label="已迁移" width="100" />
        <el-table-column prop="total_rows" label="总数" width="100" />
        <el-table-column prop="last_pk" label="最后 PK" width="100" />
        <el-table-column prop="updated_at" label="更新时间" width="180" />
        <el-table-column prop="error_msg" label="错误" show-overflow-tooltip />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  type BatchInfo,
  type CheckpointInfo,
  type TableVerifyInfo,
  getHealth,
  listBatches,
  listCheckpoints,
  rollbackBatch,
  runMigration,
  verifyBatch,
} from '@/api/admin/admin-migration'

const { t } = useI18n()
const batches = ref<BatchInfo[]>([])
const loading = ref(false)
const health = ref<any>(null)
const healthLoading = ref(false)

const verifyResult = ref<{ batch_id: string; tables: TableVerifyInfo[] } | null>(null)
const checkpointDialogVisible = ref(false)
const currentBatchId = ref('')
const checkpoints = ref<CheckpointInfo[]>([])

const statusTagType = (status: string) => {
  switch (status) {
    case 'done':
      return 'success'
    case 'running':
      return 'warning'
    case 'failed':
      return 'danger'
    default:
      return 'info'
  }
}

const loadBatches = async () => {
  loading.value = true
  try {
    const data = await listBatches()
    batches.value = data
  } finally {
    loading.value = false
  }
}

const loadHealth = async () => {
  healthLoading.value = true
  try {
    health.value = await getHealth()
  } finally {
    healthLoading.value = false
  }
}

const runBatch = async (batch: BatchInfo, dryRun: boolean, restart: boolean) => {
  try {
    await ElMessageBox.confirm(
      `确认${dryRun ? 'Dry-Run 试跑' : restart ? '重新开始' : '执行'}批次 ${batch.batch_id}?`,
      '操作确认',
      { type: 'warning' },
    )
    const res: any = await runMigration({
      batch_id: batch.batch_id,
      dry_run: dryRun,
      restart,
    })
    ElMessage.success(`${res.msg} (PID=${res.data.pid})`)
    ElMessage.info(`日志: ${res.data.log_file}`)
    setTimeout(loadBatches, 2000)
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('操作失败: ' + (e as Error).message)
    }
  }
}

// 2026-06-25 修复 ESLint: verifyBatchAction 在 setup 中定义后未在模板/事件中调用,
// 实际 verifyResult 展示逻辑由 verifyBatch(...) 直接驱动, 此 helper 属冗余, 直接移除.
const showCheckpoints = async (batchId: string) => {
  currentBatchId.value = batchId
  checkpoints.value = await listCheckpoints(batchId)
  checkpointDialogVisible.value = true
}

const confirmRollback = async (batchId: string) => {
  try {
    await ElMessageBox.confirm(
      `⚠️ 确认回滚批次 ${batchId}? 该操作将删除 G 盘业务数据 + id_mapping 记录!`,
      '危险操作',
      {
        type: 'error',
        confirmButtonText: '确认回滚',
        cancelButtonText: '取消',
      },
    )
    await ElMessageBox.confirm('再次确认, 此操作不可逆!', '最终确认', {
      type: 'error',
      confirmButtonText: '我已确认',
    })
    await rollbackBatch(batchId, true)
    ElMessage.success('回滚已启动')
    setTimeout(loadBatches, 2000)
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('回滚失败: ' + (e as Error).message)
    }
  }
}

onMounted(() => {
  loadBatches()
  loadHealth()
})
</script>

<style scoped>
.migration-admin {
  padding: 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--el-text-color-primary);
}

.health-card,
.batch-card,
.verify-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-text {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
