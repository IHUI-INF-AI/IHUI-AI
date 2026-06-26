<template>
  <ElDialog v-model="visibleModel" :title="dialogTitle" width="560px" :close-on-click-modal="false" @closed="onClosed">
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="100px" v-loading="submitting">
      <ElFormItem label="试卷名称" prop="title">
        <ElInput v-model="formData.title" placeholder="请输入试卷名称" />
      </ElFormItem>
      <ElFormItem label="分类" prop="category_id">
        <ElSelect v-model="formData.category_id" placeholder="请选择分类" filterable class="full-width">
          <ElOption v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="试卷描述" prop="description">
        <ElInput v-model="formData.description" type="textarea" :rows="3" placeholder="请输入试卷描述" />
      </ElFormItem>
      <ElFormItem label="封面链接" prop="cover">
        <ElInput v-model="formData.cover" placeholder="https://" />
      </ElFormItem>
      <ElFormItem label="总分" prop="total_score">
        <ElInputNumber v-model="formData.total_score" :min="0" />
      </ElFormItem>
      <ElFormItem label="及格分" prop="pass_score">
        <ElInputNumber v-model="formData.pass_score" :min="0" />
      </ElFormItem>
      <ElFormItem label="时长(分)" prop="duration">
        <ElInputNumber v-model="formData.duration" :min="0" />
      </ElFormItem>
      <ElFormItem label="试卷类型" prop="type">
        <ElSelect v-model="formData.type" placeholder="请选择试卷类型" class="full-width">
          <ElOption label="固定试卷" :value="1" />
          <ElOption label="随机试卷" :value="2" />
          <ElOption label="模拟试卷" :value="3" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="难度" prop="difficulty">
        <ElSelect v-model="formData.difficulty" placeholder="请选择难度" class="full-width">
          <ElOption label="简单" :value="1" />
          <ElOption label="中等" :value="2" />
          <ElOption label="困难" :value="3" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="是否免费" prop="is_free">
        <ElSwitch v-model="formData.is_free" />
      </ElFormItem>
      <ElFormItem label="价格" prop="price">
        <ElInputNumber v-model="formData.price" :min="0" :step="0.5" />
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
import { ElDialog, ElForm, ElFormItem, ElInput, ElInputNumber, ElSelect, ElOption, ElSwitch, ElButton, type FormInstance, type FormRules } from 'element-plus'

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
  title: '',
  description: '',
  category_id: '',
  cover: '',
  total_score: 100,
  pass_score: 60,
  duration: 60,
  type: 1,
  difficulty: 1,
  is_free: true,
  price: 0,
  sort_order: 0,
})

const dialogTitle = computed(() => (props.mode === 'edit' ? t('common.edit') : t('common.add')) + '试卷')
const submitLabel = computed(() => t('common.save'))
const cancelLabel = computed(() => t('common.cancel'))

const rules: FormRules = {
  title: [{ required: true, message: '请输入试卷名称', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择分类', trigger: 'change' }],
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
      title: data.title ?? data.name ?? '',
      description: data.description ?? '',
      category_id: data.category_id ?? data.categoryId ?? props.categories[0]?.id ?? '',
      cover: data.cover ?? '',
      total_score: data.total_score ?? data.totalScore ?? 100,
      pass_score: data.pass_score ?? data.passScore ?? 60,
      duration: data.duration ?? 60,
      type: data.type ?? 1,
      difficulty: data.difficulty ?? 1,
      is_free: data.is_free ?? data.isFree ?? true,
      price: data.price ?? 0,
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