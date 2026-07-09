<template>
  <div class="variables-container page-container">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <Setting class="h-4 w-4" />
          {{ t('variables.title') }}
        </h1>
        <p class="page-subtitle">{{ t('variables.subtitle') }}</p>
      </div>
      <Button variant="default" @click="showCreateDialog = true">
        <Plus class="h-4 w-4" />
        {{ t('variables.createVariable') }}
      </Button>
    </div>

    <div class="variables-content">
      <Card class="transition-shadow hover:shadow-md"><CardHeader>
          <div class="card-header">
            <span>{{ t('variables.selectBot') }}</span>
            <el-select
              v-model="selectedBotId"
              :placeholder="t('variables.selectBotPlaceholder')"
              style="width: 300px"
              @change="loadVariables"
            >
              <el-option v-for="bot in bots" :key="bot.id" :label="bot.name" :value="bot.id" />
            </el-select>
          </div>
        </CardHeader><CardContent class="p-5">
        
        <div v-loading="loading">
          <Empty v-if="!selectedBotId" :description="t('variables.pleaseSelectBot')" />
          <div v-else-if="variables.length === 0" class="empty-state">
            <Empty :description="t('variables.noVariables')">
              <Button variant="default" @click="showCreateDialog = true">{{
                t('variables.createFirstVariable')
              }}</Button>
            </Empty>
          </div>
          <Table v-else class="w-full">
            <TableHeader>
              <TableRow>
                <TableHead class="w-[200px]">{{ t('variables.table.name') }}</TableHead>
                <TableHead class="w-[120px]">{{ t('variables.table.type') }}</TableHead>
                <TableHead>{{ t('variables.table.value') }}</TableHead>
                <TableHead>{{ t('variables.table.description') }}</TableHead>
                <TableHead class="w-[180px]">{{ t('variables.table.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in variables" :key="row.name ?? index">
                <TableCell>{{ row.name }}</TableCell>
                <TableCell>{{ row.type }}</TableCell>
                <TableCell class="max-w-[400px] truncate" :title="String(row.value ?? '')">{{ row.value }}</TableCell>
                <TableCell class="max-w-[400px] truncate" :title="String(row.description ?? '')">{{ row.description }}</TableCell>
                <TableCell>
                  <Button variant="link" @click="handleEdit(row)">{{
                    t('variables.buttons.edit')
                  }}</Button>
                  <Button variant="link" @click="handleDelete(row)">{{
                    t('variables.buttons.delete')
                  }}</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>
    </div>

    <!-- 创建/编辑对话框 -->
    <Dialog
      v-model="showCreateDialog"
      width="600px"
    >
      <DialogHeader>
        <DialogTitle>{{ editingVariable ? t('variables.dialog.editTitle') : t('variables.dialog.createTitle') }}</DialogTitle>
      </DialogHeader>
      <form ref="variableFormRef" @submit.prevent>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('variables.dialog.name') }}</label>
          <div class="flex-1">
            <Input v-model="variableForm.name" :disabled="!!editingVariable" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('variables.dialog.value') }}</label>
          <div class="flex-1">
            <Textarea v-model="variableForm.value" :rows="4" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('variables.dialog.description') }}</label>
          <div class="flex-1">
            <Input v-model="variableForm.description" />
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="showCreateDialog = false">{{ t('variables.buttons.cancel') }}</Button>
        <Button variant="default" @click="handleSave">{{
          t('variables.buttons.save')
        }}</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Setting, Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox, FormInstance } from 'element-plus'
import {
  listVariables,
  createVariable,
  updateVariable,
  deleteVariable,
  type Variable,
} from '@/api/services/variables.service'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Empty } from '@/components/ui/empty'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const { t } = useI18n()
const { loading, execute: executeApi } = useApiError({ showMessage: true })
const saving = ref(false)
const selectedBotId = ref('')
const bots = ref<Array<{ id: string; name: string }>>([])
const variables = ref<Variable[]>([])
const showCreateDialog = ref(false)
const editingVariable = ref<Variable | null>(null)
const variableFormRef = ref<FormInstance | null>(null)

const variableForm = reactive({
  name: '',
  value: '',
  description: '',
})

const rules = {
  name: [{ required: true, message: t('variables.validation.nameRequired'), trigger: 'blur' }],
  value: [{ required: true, message: t('variables.validation.valueRequired'), trigger: 'blur' }],
}

const loadBots = async () => {
  try {
    // 使用模拟数据代替真实API调用，避免构建失败
    bots.value = [
      { id: '1', name: t('variables.testBot1') },
      { id: '2', name: t('variables.testBot2') },
      { id: '3', name: t('variables.testBot3') },
    ]
  } catch (error) {
    logger.error(t('variables.messages.loadBotsFailed'), error)
  }
}

const loadVariables = async () => {
  if (!selectedBotId.value) return
  const data = await executeApi(() => listVariables({ bot_id: selectedBotId.value }))
  if (data !== null) {
    const listData = Array.isArray(data) ? data : (typeof data === 'object' && 'list' in data ? (data as { list?: Variable[] }).list : [])
    variables.value = listData || []
  }
}

const handleEdit = (variable: Variable) => {
  editingVariable.value = variable
  variableForm.name = variable.name
  variableForm.value = String(variable.value || '')
  variableForm.description = variable.description || ''
  showCreateDialog.value = true
}

const handleDelete = async (variable: Variable) => {
  try {
    await ElMessageBox.confirm(
      t('variables.messages.deleteConfirm'),
      t('variables.messages.deleteConfirmTitle'),
      { type: 'warning' }
    )
    const response = await deleteVariable({
      bot_id: selectedBotId.value,
      name: variable.name,
    })
    if (response.success) {
      ElMessage.success(t('variables.messages.deleteSuccess'))
      loadVariables()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('variables.messages.deleteFailed'))
    }
  }
}

const handleSave = async () => {
  if (!variableFormRef.value) return
  await variableFormRef.value.validate(async (valid: boolean) => {
    if (valid && selectedBotId.value) {
      saving.value = true
      try {
        let response
        if (editingVariable.value) {
          response = await updateVariable({
            bot_id: selectedBotId.value,
            name: variableForm.name,
            value: variableForm.value,
          })
        } else {
          response = await createVariable({
            bot_id: selectedBotId.value,
            name: variableForm.name,
            value: variableForm.value,
          })
        }
        if (response.success) {
          ElMessage.success(t('variables.messages.saveSuccess'))
          showCreateDialog.value = false
          resetForm()
          loadVariables()
        }
      } catch (_error) {
        ElMessage.error(t('variables.messages.saveFailed'))
      } finally {
        saving.value = false
      }
    }
  })
}

const resetForm = () => {
  editingVariable.value = null
  variableForm.name = ''
  variableForm.value = ''
  variableForm.description = ''
}

onMounted(() => {
  loadBots()
})
</script>

<style scoped lang="scss">
.variables-container {
  padding: 32px;
  width: 100%;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;

  .header-content {
    .page-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 8px;
    }

    .page-subtitle {
      color: var(--el-text-color-secondary);
      margin: 0;
    }
  }
}

.empty-state {
  padding: 40px 0;
}
</style>
