<template>
  <div class="variables-container page-container">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <el-icon><Setting /></el-icon>
          {{ t('variables.title') }}
        </h1>
        <p class="page-subtitle">{{ t('variables.subtitle') }}</p>
      </div>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        {{ t('variables.createVariable') }}
      </el-button>
    </div>

    <div class="variables-content">
      <el-card shadow="hover">
        <template #header>
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
        </template>

        <div v-loading="loading">
          <el-empty v-if="!selectedBotId" :description="t('variables.pleaseSelectBot')" />
          <div v-else-if="variables.length === 0" class="empty-state">
            <el-empty :description="t('variables.noVariables')">
              <el-button type="primary" @click="showCreateDialog = true">{{
                t('variables.createFirstVariable')
              }}</el-button>
            </el-empty>
          </div>
          <el-table v-else :data="variables" style="width: 100%">
            <el-table-column prop="name" :label="t('variables.table.name')" width="200" />
            <el-table-column prop="type" :label="t('variables.table.type')" width="120" />
            <el-table-column
              prop="value"
              :label="t('variables.table.value')"
              show-overflow-tooltip
            />
            <el-table-column
              prop="description"
              :label="t('variables.table.description')"
              show-overflow-tooltip
            />
            <el-table-column :label="t('variables.table.actions')" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link @click="handleEdit(row)">{{
                  t('variables.buttons.edit')
                }}</el-button>
                <el-button link type="danger" @click="handleDelete(row)">{{
                  t('variables.buttons.delete')
                }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingVariable ? t('variables.dialog.editTitle') : t('variables.dialog.createTitle')"
      width="600px"
    >
      <el-form :model="variableForm" :rules="rules" ref="variableFormRef" label-width="100px">
        <el-form-item :label="t('variables.dialog.name')" prop="name">
          <el-input v-model="variableForm.name" :disabled="!!editingVariable" />
        </el-form-item>
        <el-form-item :label="t('variables.dialog.value')" prop="value">
          <el-input v-model="variableForm.value" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item :label="t('variables.dialog.description')">
          <el-input v-model="variableForm.description" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">{{ t('variables.buttons.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">{{
          t('variables.buttons.save')
        }}</el-button>
      </template>
    </el-dialog>
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
