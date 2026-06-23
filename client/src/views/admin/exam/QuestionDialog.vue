<template>
  <ElDialog v-model="visibleModel" :title="dialogTitle" width="560px" :close-on-click-modal="false" @closed="onClosed">
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="100px" v-loading="submitting">
      <ElFormItem label="题目内容" prop="content">
        <ElInput v-model="formData.content" type="textarea" :rows="3" placeholder="请输入题目内容" />
      </ElFormItem>
      <ElFormItem label="试卷ID" prop="paper_id">
        <ElInputNumber v-model="formData.paper_id" :min="1" />
      </ElFormItem>
      <ElFormItem label="题型" prop="type">
        <ElSelect v-model="formData.type" placeholder="请选择题型" style="width: 100%">
          <ElOption :label="typeLabels[1]" :value="1" />
          <ElOption :label="typeLabels[2]" :value="2" />
          <ElOption :label="typeLabels[3]" :value="3" />
          <ElOption :label="typeLabels[4]" :value="4" />
          <ElOption :label="typeLabels[5]" :value="5" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="选项" prop="options">
        <ElInput v-model="formData.options" type="textarea" :rows="4" placeholder='JSON 数组，例如 ["A","B","C","D"]' />
      </ElFormItem>
      <ElFormItem label="答案" prop="answer">
        <ElInput v-model="formData.answer" placeholder="请输入参考答案" />
      </ElFormItem>
      <ElFormItem label="解析" prop="analysis">
        <ElInput v-model="formData.analysis" type="textarea" :rows="3" placeholder="请输入解析" />
      </ElFormItem>
      <ElFormItem label="分值" prop="score">
        <ElInputNumber v-model="formData.score" :min="0" :max="9999" :step="0.5" />
      </ElFormItem>
      <ElFormItem label="难度" prop="difficulty">
        <ElSelect v-model="formData.difficulty" placeholder="请选择难度" style="width: 100%">
          <ElOption :label="difficultyLabels[1]" :value="1" />
          <ElOption :label="difficultyLabels[2]" :value="2" />
          <ElOption :label="difficultyLabels[3]" :value="3" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="排序" prop="sort_order">
        <ElInputNumber v-model="formData.sort_order" :min="0" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="visibleModel = false">{{ cancelLabel }}</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">{{ submitLabel }}</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElDialog, ElForm, ElFormItem, ElInput, ElInputNumber, ElSelect, ElOption, ElButton, type FormInstance, type FormRules } from 'element-plus'

const props = withDefaults(
  defineProps<{
    visible: boolean
    mode: 'add' | 'edit'
    initialData: Record<string, any>
    categories: Array<{ id: number; name: string }>
    submitting?: boolean
  }>(),
  { submitting: false },
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', data: Record<string, any>): void
}>()

const { t } = useI18n()
const formRef = ref<FormInstance>()
const formData = reactive<Record<string, any>>({
  paper_id: 1,
  type: 1,
  content: '',
  options: '[]',
  answer: '',
  analysis: '',
  score: 0,
  difficulty: 1,
  sort_order: 0,
})

const dialogTitle = computed(() => (props.mode === 'edit' ? t('common.edit') : t('common.add')) + '题目')
const submitLabel = computed(() => t('common.save'))
const cancelLabel = computed(() => t('common.cancel'))
const typeLabels: Record<number, string> = { 1: '单选题', 2: '多选题', 3: '判断题', 4: '填空题', 5: '主观题' }
const difficultyLabels: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' }

const rules: FormRules = {
  content: [{ required: true, message: '请输入题目内容', trigger: 'blur' }],
  paper_id: [{ required: true, message: '请输入试卷ID', trigger: 'blur' }],
  type: [{ required: true, message: '请选择题型', trigger: 'change' }],
  answer: [{ required: true, message: '请输入答案', trigger: 'blur' }],
  score: [{ required: true, message: '请输入分值', trigger: 'blur' }],
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      nextTick(() => formRef.value?.clearValidate())
    }
  },
)

watch(
  () => props.initialData,
  (data) => {
    const options = data.options
    Object.assign(formData, {
      paper_id: data.paper_id ?? data.paperId ?? 1,
      type: data.type ?? 1,
      content: data.content ?? '',
      options: Array.isArray(options) ? JSON.stringify(options, null, 2) : String(options ?? '[]'),
      answer: data.answer ?? '',
      analysis: data.analysis ?? '',
      score: data.score ?? 0,
      difficulty: data.difficulty ?? 1,
      sort_order: data.sort_order ?? data.sortOrder ?? 0,
    })
  },
  { immediate: true },
)

const visibleModel = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  emit('submit', { ...formData })
}

function onClosed() {
  emit('update:visible', false)
}
</script>
