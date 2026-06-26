<template>
  <ElDialog v-model="visibleModel" :title="dialogTitle" width="520px" :close-on-click-modal="false" @closed="onClosed">
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="110px" v-loading="submitting">
      <ElFormItem label="所属试卷" prop="paper_id">
        <ElSelect v-model="formData.paper_id" placeholder="请选择试卷" filterable class="full-width">
          <ElOption v-for="item in papers" :key="item.id" :label="item.name" :value="item.id" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="章节标题" prop="title">
        <ElInput v-model="formData.title" placeholder="请输入章节标题" />
      </ElFormItem>
      <ElFormItem label="章节描述" prop="description">
        <ElInput v-model="formData.description" type="textarea" :rows="3" placeholder="请输入章节描述" />
      </ElFormItem>
      <ElFormItem label="封面链接" prop="cover">
        <ElInput v-model="formData.cover" placeholder="https://" />
      </ElFormItem>
      <ElFormItem label="题目数" prop="question_num">
        <ElInputNumber v-model="formData.question_num" :min="0" />
      </ElFormItem>
      <ElFormItem label="总分" prop="total_score">
        <ElInputNumber v-model="formData.total_score" :min="0" :step="0.5" />
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
    papers: Array<{ id: number; name: string }>
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
  paper_id: '',
  title: '',
  description: '',
  cover: '',
  question_num: 0,
  total_score: 0,
  sort_order: 0,
})

const dialogTitle = computed(() => (props.mode === 'edit' ? t('common.edit') : t('common.add')) + '章节')
const submitLabel = computed(() => t('common.save'))
const cancelLabel = computed(() => t('common.cancel'))

const rules: FormRules = {
  paper_id: [{ required: true, message: '请选择试卷', trigger: 'change' }],
  title: [{ required: true, message: '请输入章节标题', trigger: 'blur' }],
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
    Object.assign(formData, {
      paper_id: data.paper_id ?? data.paperId ?? '',
      title: data.title ?? '',
      description: data.description ?? '',
      cover: data.cover ?? '',
      question_num: data.question_num ?? data.questionNum ?? 0,
      total_score: data.total_score ?? data.totalScore ?? 0,
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

<style scoped>
.full-width {
  width: 100%;
}
</style>
