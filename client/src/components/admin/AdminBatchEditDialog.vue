<template>
  <ElDialog v-model="visibleModel" title="批量编辑" width="500px" append-to-body :close-on-click-modal="!submitting">
    <div class="batch-edit" v-if="visibleModel">
      <p class="batch-edit__tip">{{ t('adminBatchEditDialog.selectedTip', { count: rows.length }) }}</p>
      <ElForm label-width="120px">
        <ElFormItem v-for="field in editableFields" :key="field.prop" :label="field.label">
          <ElCheckbox v-model="checked[field.prop]" :disabled="submitting" />
          <template v-if="checked[field.prop]">
            <ElSelect v-if="field.type === 'select'" v-model="data[field.prop]" :style="{ width: '100%' }" :disabled="submitting">
              <ElOption v-for="opt in field.options || []" :key="opt.value" :label="opt.label" :value="opt.value" />
            </ElSelect>
            <ElInputNumber v-else-if="field.type === 'number'" v-model="data[field.prop]" :min="field.min" :max="field.max" :step="field.step || 1" :disabled="submitting" />
            <ElInput v-else v-model="data[field.prop]" :placeholder="field.placeholder || ''" :disabled="submitting" />
          </template>
        </ElFormItem>
      </ElForm>
      <div class="batch-edit__progress" v-if="progress.visible">
        <ElProgress :percentage="progress.total ? Math.round((progress.current / progress.total) * 100) : 0" :status="progressStatus" />
        <p class="batch-edit__progress-text">正在更新 {{ progress.current }} / {{ progress.total }} 条</p>
        <p class="batch-edit__failed-text" v-if="failedCount > 0">失败 {{ failedCount }} 条，可点击"重试失败项"重新更新</p>
      </div>
    </div>
    <template #footer>
      <ElButton @click="visibleModel = false" :disabled="submitting">取消</ElButton>
      <ElButton type="warning" v-if="failedCount > 0" :loading="submitting" @click="onRetry">重试失败项</ElButton>
      <ElButton type="primary" :loading="submitting" @click="onSubmit">批量保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElDialog, ElForm, ElFormItem, ElCheckbox, ElSelect, ElOption, ElInputNumber, ElInput, ElButton, ElProgress } from 'element-plus'
import type { FormField } from './AdminEditDialog.vue'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  rows: any[]
  fields: FormField[]
  submitting: boolean
  progress: { current: number; total: number; visible: boolean; failedIds: (string | number)[] }
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'submit', data: Record<string, any>): void
  (e: 'retry', data: Record<string, any>): void
}>()

const visibleModel = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

// 可编辑字段列表（排除富文本等不适合批量编辑的字段）
const editableFields = computed(() => props.fields.filter((f: FormField) => f.type !== 'richtext'))

// 字段勾选状态
const checked = reactive<Record<string, boolean>>({})

// 编辑数据
const data = reactive<Record<string, any>>({})

// 失败项数量
const failedCount = computed(() => props.progress.failedIds?.length || 0)

// 进度条状态：有失败项显示警告色，全部完成显示成功色
const progressStatus = computed(() => {
  if (props.progress.current < props.progress.total) return ''
  return failedCount.value > 0 ? 'warning' : 'success'
})

// 监听弹窗打开，初始化勾选状态和数据
watch(() => props.visible, (v) => {
  if (v) {
    for (const f of editableFields.value) {
      checked[f.prop] = false
      data[f.prop] = f.type === 'number' ? 0 : ''
    }
  }
})

const onSubmit = () => {
  // 只提交勾选的字段
  const updateData: Record<string, any> = {}
  for (const f of editableFields.value) {
    if (checked[f.prop]) {
      updateData[f.prop] = data[f.prop]
    }
  }
  emit('submit', updateData)
}

const onRetry = () => {
  // 重试时使用与提交时相同的字段数据
  const updateData: Record<string, any> = {}
  for (const f of editableFields.value) {
    if (checked[f.prop]) {
      updateData[f.prop] = data[f.prop]
    }
  }
  emit('retry', updateData)
}
</script>

<style scoped>
.batch-edit__tip {
  margin: 0 0 16px;
  padding: 8px 12px;
  background: var(--el-color-warning-light-9);
  border-radius: var(--global-border-radius);
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.batch-edit :where(.el-form-item__content) {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-edit__progress {
  margin-top: 16px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.batch-edit__progress-text {
  margin: 8px 0 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.batch-edit__failed-text {
  margin: 4px 0 0;
  text-align: center;
  color: var(--el-color-danger);
  font-size: 13px;
}
</style>
