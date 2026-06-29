<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="560px"
    append-to-body
    class="ask-edit-dialog"
    @update:model-value="handleVisibleChange"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-position="top"
      class="ask-edit-dialog__form"
    >
      <el-form-item :label="t('askEdit.questionTitle')" prop="title">
        <el-input
          v-model="formData.title"
          :placeholder="t('askEdit.titlePlaceholder')"
          maxlength="100"
          show-word-limit
          clearable
        />
      </el-form-item>

      <el-form-item :label="t('askEdit.content')" prop="content">
        <el-input
          v-model="formData.content"
          type="textarea"
          :rows="6"
          :placeholder="t('askEdit.contentPlaceholder')"
          maxlength="2000"
          show-word-limit
          resize="vertical"
        />
      </el-form-item>

      <el-form-item :label="t('askEdit.category')" prop="cid">
        <el-select
          v-model="formData.cid"
          :placeholder="t('askEdit.selectCategory')"
          clearable
          filterable
          class="ask-edit-dialog__select"
        >
          <el-option
            v-for="category in categories"
            :key="category.id"
            :label="category.name"
            :value="category.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('askEdit.tags')">
        <div class="ask-edit-dialog__tags">
          <el-tag
            v-for="(tag, index) in formData.tags"
            :key="`${tag}-${index}`"
            closable
            class="ask-edit-dialog__tag"
            @close="removeTag(index)"
          >
            {{ tag }}
          </el-tag>
          <el-input
            v-if="formData.tags.length < maxTags"
            v-model="tagInput"
            class="ask-edit-dialog__tag-input"
            size="small"
            :placeholder="t('askEdit.tagsPlaceholder')"
            @keydown.enter.prevent="addTag"
            @keydown.delete="handleBackspace"
          />
        </div>
        <div class="ask-edit-dialog__tags-tip">
          {{ t('askEdit.tagMax', { max: maxTags }) }}
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">{{ t('common.cancel') }}</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        @click="handleSubmit"
      >
        {{ t('common.submit') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

interface AskCategory {
  id: number
  name: string
}

interface QuestionData {
  id?: number
  title: string
  content: string
  cid: number | ''
  tags: string[]
}

interface SubmitPayload {
  title: string
  content: string
  cid_list: number[]
  tags: string[]
  id?: number
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    question?: QuestionData | null
    categories?: AskCategory[]
    loading?: boolean
  }>(),
  {
    visible: false,
    question: null,
    categories: () => [],
    loading: false,
  }
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit', payload: SubmitPayload): void
}>()

const { t } = useI18n()

const maxTags = 5
const formRef = ref<FormInstance>()
const submitting = ref(props.loading)
const tagInput = ref('')

const formData = reactive<QuestionData>({
  title: '',
  content: '',
  cid: '',
  tags: [],
})

const dialogTitle = computed(() => {
  return formData.id
    ? t('askEdit.editTitle')
    : t('askEdit.createTitle')
})

const formRules = computed<FormRules>(() => ({
  title: [
    {
      required: true,
      message: t('askEdit.titleRequired'),
      trigger: 'blur',
    },
    {
      min: 5,
      max: 100,
      message: t('askEdit.titleLength'),
      trigger: 'blur',
    },
  ],
  content: [
    {
      required: true,
      message: t('askEdit.contentRequired'),
      trigger: 'blur',
    },
    {
      min: 10,
      max: 2000,
      message: t('askEdit.contentLength'),
      trigger: 'blur',
    },
  ],
}))

const resetForm = (): void => {
  formData.title = ''
  formData.content = ''
  formData.cid = ''
  formData.tags = []
  formData.id = undefined
  tagInput.value = ''
  formRef.value?.clearValidate()
}

const fillForm = (question: QuestionData): void => {
  formData.title = question.title || ''
  formData.content = question.content || ''
  formData.cid = question.cid ?? ''
  formData.tags = [...(question.tags || [])]
  formData.id = question.id
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      if (props.question) {
        fillForm(props.question)
      } else {
        resetForm()
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.question,
  (question) => {
    if (props.visible && question) {
      fillForm(question)
    }
  }
)

watch(
  () => props.loading,
  (loading) => {
    submitting.value = loading
  }
)

const handleVisibleChange = (value: boolean): void => {
  emit('update:visible', value)
  if (!value) {
    resetForm()
  }
}

const handleCancel = (): void => {
  handleVisibleChange(false)
}

const addTag = (): void => {
  const value = tagInput.value.trim()
  if (!value) return
  if (formData.tags.includes(value)) {
    tagInput.value = ''
    return
  }
  if (formData.tags.length >= maxTags) {
    ElMessage.warning(t('askEdit.tagMax', { max: maxTags }))
    return
  }
  formData.tags.push(value)
  tagInput.value = ''
}

const removeTag = (index: number): void => {
  formData.tags.splice(index, 1)
}

const handleBackspace = (): void => {
  if (!tagInput.value && formData.tags.length > 0) {
    formData.tags.pop()
  }
}

const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  const payload: SubmitPayload = {
    title: formData.title.trim(),
    content: formData.content.trim(),
    cid_list: formData.cid ? [Number(formData.cid)] : [],
    tags: [...formData.tags],
  }
  if (formData.id) {
    payload.id = formData.id
  }

  submitting.value = true
  emit('submit', payload)
}
</script>

<style scoped lang="scss">
// 扁平化设计：仅使用边框和颜色对比，不使用 text-shadow / box-shadow / !important

.ask-edit-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ask-edit-dialog__select {
  width: 100%;
}

.ask-edit-dialog__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  min-height: 44px;
}

.ask-edit-dialog__tag {
  margin: 0;
}

.ask-edit-dialog__tag-input {
  flex: 1;
  min-width: 120px;
}

:deep(.ask-edit-dialog__tag-input .el-input__wrapper) {
  background: transparent;
  border: none;
  box-shadow: none;
}

.ask-edit-dialog__tags-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
