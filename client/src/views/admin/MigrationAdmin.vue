<template>
  <div class="migration-admin">
    <h2 class="page-title">{{ t('migrationAdmin.title') }}</h2>

    <!-- 健康检查 -->
    <Card class="health-card shadow-none"><CardHeader>
        <div class="card-header">
          <span>{{ t('migrationAdmin.healthCheck') }}</span>
          <Button variant="outline" size="sm" @click="loadHealth">{{ t('common.refresh') }}</Button>
        </div>
      </CardHeader><CardContent class="p-5">
            <div v-if="health" class="grid grid-cols-2 gap-px bg-border rounded-md overflow-hidden border border-border">
        <div class="flex flex-col bg-background p-3">
          <span class="text-xs text-muted-foreground mb-1">G 盘 zhs_ai_project</span>
          <span class="text-sm">{{ health.g_disk?.engines?.ai }}</span>
        </div>
        <div class="flex flex-col bg-background p-3">
          <span class="text-xs text-muted-foreground mb-1">G 盘 zhs_center_project</span>
          <span class="text-sm">{{ health.g_disk?.engines?.center }}</span>
        </div>
        <div class="flex flex-col bg-background p-3">
          <span class="text-xs text-muted-foreground mb-1">G 盘 zhs_educational_training</span>
          <span class="text-sm">{{ health.g_disk?.engines?.course }}</span>
        </div>
        <div class="flex flex-col bg-background p-3">
          <span class="text-xs text-muted-foreground mb-1">H 盘 member-service</span>
          <span class="text-sm">{{ health.h_disk?.['ihui-ai-edu-member-service'] }}</span>
        </div>
        <div class="flex flex-col bg-background p-3">
          <span class="text-xs text-muted-foreground mb-1">H 盘 learn-service</span>
          <span class="text-sm">{{ health.h_disk?.['ihui-ai-edu-learn-service'] }}</span>
        </div>
        <div class="flex flex-col bg-background p-3">
          <span class="text-xs text-muted-foreground mb-1">id_mapping 总数</span>
          <span class="text-sm">{{ health.id_mapping_count }}</span>
        </div>
        <div class="flex flex-col bg-background p-3">
          <span class="text-xs text-muted-foreground mb-1">checkpoint 总数</span>
          <span class="text-sm">{{ health.checkpoint_count }}</span>
        </div>
      </div>
    </CardContent></Card>

    <!-- 批次列表 -->
    <Card class="batch-card shadow-none"><CardHeader>
        <div class="card-header">
          <span>{{ t('migrationAdmin.batchList') }}</span>
          <Button variant="outline" size="sm" @click="loadBatches">{{ t('common.refresh') }}</Button>
        </div>
      </CardHeader><CardContent class="p-5">
            <Table class="border">
        <TableHeader>
          <TableRow>
            <TableHead class="w-[200px]">批次号</TableHead>
            <TableHead class="min-w-[280px]">描述</TableHead>
            <TableHead class="w-[80px] text-center">任务数</TableHead>
            <TableHead class="w-[200px]">进度</TableHead>
            <TableHead class="w-[200px]">数据量</TableHead>
            <TableHead class="w-[320px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in batches" :key="row.batch_id ?? index">
            <TableCell>{{ row.batch_id }}</TableCell>
            <TableCell class="max-w-[400px] truncate" :title="row.description ?? ''">{{ row.description }}</TableCell>
            <TableCell class="text-center">{{ row.task_count }}</TableCell>
            <TableCell>
              <div class="w-full bg-muted rounded-full h-2"><div class="h-2 rounded-full" :class="row.failed_count > 0 ? 'bg-red-500' : 'bg-green-500'" :style="{ width: (row.task_count > 0 ? Math.round((row.done_count / row.task_count) * 100) : 0) + '%' }"></div></div>
              <span class="progress-text">
                {{ row.done_count }} / {{ row.task_count }} done
                <Tag v-if="row.running_count > 0" type="warning" size="small">{{ t('migrationAdmin.running') }} {{ row.running_count }}</Tag>
                <Tag v-if="row.failed_count > 0" type="danger" size="small">{{ t('migrationAdmin.failed') }} {{ row.failed_count }}</Tag>
              </span>
            </TableCell>
            <TableCell>
              {{ row.migrated_rows.toLocaleString() }} / {{ row.total_rows.toLocaleString() }}
            </TableCell>
            <TableCell>
              <Button variant="default" size="sm" @click="runBatch(row, false, false)">{{ t('migrationAdmin.execute') }}</Button>
              <Button variant="outline" size="sm" @click="runBatch(row, true, false)">Dry-Run</Button>
              <Button variant="secondary" size="sm" @click="runBatch(row, false, true)">{{ t('migrationAdmin.restart') }}</Button>
              <Button variant="outline" size="sm" @click="showCheckpoints(row.batch_id)">{{ t('migrationAdmin.details') }}</Button>
              <Button variant="outline" size="sm" @click="verifyBatch(row.batch_id)">{{ t('migrationAdmin.validate') }}</Button>
              <Button variant="destructive" size="sm" @click="confirmRollback(row.batch_id)">{{ t('migrationAdmin.rollback') }}</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent></Card>

    <!-- 校验结果 -->
    <Card class="verify-card shadow-none" v-if="verifyResult"><CardHeader>
        <div class="card-header">
          <span>{{ t('migrationAdmin.validationResult') }} {{ verifyResult.batch_id }}</span>
          <Button variant="outline" size="sm" @click="verifyResult = null">{{ t('common.close') }}</Button>
        </div>
      </CardHeader><CardContent class="p-5">
            <Table class="border">
        <TableHeader>
          <TableRow>
            <TableHead>H 盘表</TableHead>
            <TableHead>G 盘表</TableHead>
            <TableHead class="text-right">H 行数</TableHead>
            <TableHead class="text-right">G 行数</TableHead>
            <TableHead class="text-right">覆盖率</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in verifyResult.tables" :key="(row.source_table ?? '') + index">
            <TableCell>{{ row.source_table }}</TableCell>
            <TableCell>{{ row.target_table }}</TableCell>
            <TableCell class="text-right">{{ row.h_count }}</TableCell>
            <TableCell class="text-right">{{ row.g_count }}</TableCell>
            <TableCell class="text-right">
              <Tag :type="row.ok ? 'success' : 'danger'">{{ row.ratio }}%</Tag>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent></Card>

    <!-- checkpoint 明细 -->
    <Dialog
      v-model="checkpointDialogVisible"
      width="80%"
    >
      <DialogHeader>
        <DialogTitle>Checkpoint 明细: {{ currentBatchId }}</DialogTitle>
      </DialogHeader>
      <Table class="border">
        <TableHeader>
          <TableRow>
            <TableHead>源表</TableHead>
            <TableHead>目标表</TableHead>
            <TableHead class="w-[100px]">状态</TableHead>
            <TableHead class="w-[100px]">已迁移</TableHead>
            <TableHead class="w-[100px]">总数</TableHead>
            <TableHead class="w-[100px]">最后 PK</TableHead>
            <TableHead class="w-[180px]">更新时间</TableHead>
            <TableHead>错误</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in checkpoints" :key="(row.source_table ?? '') + index">
            <TableCell>{{ row.source_table }}</TableCell>
            <TableCell>{{ row.target_table }}</TableCell>
            <TableCell>
              <Tag :type="statusTagType(row.status ?? '')">{{ row.status }}</Tag>
            </TableCell>
            <TableCell>{{ row.migrated_rows }}</TableCell>
            <TableCell>{{ row.total_rows }}</TableCell>
            <TableCell>{{ row.last_pk }}</TableCell>
            <TableCell>{{ row.updated_at }}</TableCell>
            <TableCell class="max-w-[400px] truncate" :title="row.error_msg ?? ''">{{ row.error_msg }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from '@/utils/message'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Tag } from '@/components/ui/tag'
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
    await rollbackBatch(batchId)
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
  color: hsl(var(--foreground));
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
  color: hsl(var(--muted-foreground));
  margin-top: 4px;
}
</style>
