<template>
  <!--
    AskCreate.vue — 提问页
    路由: EduAskCreate (/edu/ask/create)
    功能: el-form 表单(标题/内容/标签/关联课程) + 校验 + 提交后跳转回列表
  -->
  <div class="ask-create">
    <!-- ① 页头 -->
    <header class="page-header">
      <div class="header-text">
        <el-button :icon="ArrowLeft" text @click="goBack">
          {{ t('edu.ask.title') }}
        </el-button>
        <h1 class="page-title">{{ t('edu.ask.askQuestion') }}</h1>
        <p class="page-subtitle">{{ t('edu.ask.subtitle') }}</p>
      </div>
    </header>

    <!-- ② 错误提示 -->
    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.common.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- ③ 表单 -->
    <div class="form-wrap">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="ask-form"
        @submit.prevent
      >
        <el-form-item :label="t('edu.ask.questionTitle')" prop="title">
          <el-input
            v-model="form.title"
            :placeholder="t('edu.ask.questionTitlePlaceholder')"
            maxlength="100"
            show-word-limit
            clearable
          />
        </el-form-item>

        <el-form-item :label="t('edu.ask.questionContent')" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            :placeholder="t('edu.ask.questionContentPlaceholder')"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>

        <el-form-item :label="t('edu.ask.tags')" prop="tags">
          <el-input
            v-model="form.tags"
            :placeholder="t('edu.ask.tagsPlaceholder')"
            clearable
          />
        </el-form-item>

        <el-form-item :label="t('edu.ask.courseOptional')" prop="course_id">
          <el-input-number
            v-model="form.course_id"
            :min="1"
            :placeholder="t('edu.ask.courseOptional')"
            controls-position="right"
            class="course-input"
          />
        </el-form-item>

        <el-form-item class="form-actions">
          <el-button @click="goBack">{{ t('edu.common.cancel') }}</el-button>
          <el-button
            type="primary"
            :loading="submitting"
            :icon="Promotion"
            @click="handleSubmit"
          >
            {{ t('edu.common.submit') }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { ArrowLeft, Promotion } from '@element-plus/icons-vue'
import { askApi } from '@/api/edu'

const { t } = useI18n()
const router = useRouter()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const error = ref(false)

const form = reactive({
  title: '',
  content: '',
  tags: '',
  course_id: undefined as number | undefined,
})

const rules = computed<FormRules>(() => ({
  title: [
    { required: true, message: t('edu.ask.questionTitlePlaceholder'), trigger: 'blur' },
    { min: 5, max: 100, message: t('edu.ask.questionTitlePlaceholder'), trigger: 'blur' },
  ],
  content: [
    { required: true, message: t('edu.ask.questionContentPlaceholder'), trigger: 'blur' },
    { min: 10, message: t('edu.ask.questionContentPlaceholder'), trigger: 'blur' },
  ],
}))

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  error.value = false
  try {
    await askApi.createQuestion({
      title: form.title.trim(),
      content: form.content.trim(),
      tags: form.tags.trim() || undefined,
      course_id: form.course_id,
    })
    ElMessage.success(t('edu.ask.submitSuccess'))
    router.push({ name: 'EduAsk' })
  } catch {
    error.value = true
    ElMessage.error(t('edu.common.loadFailed'))
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push({ name: 'EduAsk' })
}
</script>

<style scoped lang="scss">
.ask-create {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.error-alert {
  margin: 0;
}

.form-wrap {
  padding: 24px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.ask-form {
  max-width: 720px;
}

.course-input {
  width: 100%;
}

.form-actions {
  margin-bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
