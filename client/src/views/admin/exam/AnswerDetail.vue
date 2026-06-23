<template>
  <div class="admin-list-page" v-loading="loading">
    <div class="toolbar">
      <el-button @click="goBack" text>
        <el-icon><ArrowLeft /></el-icon>
        {{ t('common.back') }}
      </el-button>
      <h2 class="page-title">{{ t('adminExamAnswerDetail.title') }} #{{ route.params.id }}</h2>
    </div>
    <template v-if="data.id">
      <el-descriptions :column="2" border class="desc-wrap">
        <el-descriptions-item :label="t('exam.label.user')">{{ data.userName }}</el-descriptions-item>
        <el-descriptions-item :label="t('exam.label.paper')">{{ data.paperTitle }}</el-descriptions-item>
        <el-descriptions-item :label="t('exam.label.score')">{{ data.score }} / {{ data.totalScore }}</el-descriptions-item>
        <el-descriptions-item :label="t('exam.label.submitTime')" :span="2">{{ data.submitTime }}</el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <div class="question-list">
        <div v-for="(q, i) in (data.questions || [])" :key="q.id" class="question-block">
          <div class="question-header">
            <span class="question-index">{{ Number(i) + 1 }}.</span>
            <span class="question-title">{{ q.title }}</span>
            <el-tag size="small">{{ q.score }} {{ t('adminExamAnswerDetail.points') }}</el-tag>
          </div>
          <div class="answer-row">
            <span class="label">{{ t('adminExamAnswerDetail.userAnswer') }}</span>
            <span class="value">{{ q.userAnswer || t('adminExamAnswerDetail.notAnswered') }}</span>
          </div>
          <div class="answer-row">
            <span class="label">{{ t('adminExamAnswerDetail.correctAnswer') }}</span>
            <span class="value right">{{ q.correctAnswer }}</span>
          </div>
          <div class="mark-row">
            <span class="label">{{ t('adminExamAnswerDetail.markScore', '评分') }}</span>
            <el-input-number v-model="markScores[q.id]" :min="0" :max="Number(q.score) || 100" :step="0.5" :precision="1" size="small" />
            <span class="max-score">/ {{ q.score }}</span>
          </div>
          <div class="mark-row">
            <span class="label">{{ t('adminExamAnswerDetail.markComment', '评语') }}</span>
            <el-input v-model="markComments[q.id]" type="textarea" :rows="2" placeholder="请输入评分评语" />
          </div>
        </div>
        <el-empty v-if="!data.questions?.length" :description="t('adminExamAnswerDetail.notExist')" />
      </div>
      <div class="action-bar" v-if="data.id && data.questions?.length">
        <el-button type="primary" :loading="saving" @click="handleSave">{{ t('common.save') }}</el-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { adminApi } from '@/api/admin'

const route = useRoute()
const loading = ref(false)
const saving = ref(false)
const data = reactive<Record<string, any>>({ questions: [] })
const markScores = reactive<Record<string, number>>({})
const markComments = reactive<Record<string, string>>({})

async function load() {
  loading.value = true
  try {
    const res = await adminApi.examAnswerDetail(route.params.id as string)
    const payload = ((res?.data as any)?.data || (res?.data as any) || {}) as Record<string, unknown>
    Object.assign(data, {
      id: payload.id,
      userName: payload.userName,
      paperTitle: payload.paperTitle,
      score: payload.score,
      totalScore: payload.totalScore,
      submitTime: payload.submitTime,
      questions: (payload.questions || []) as Array<Record<string, unknown>>,
    })
    ;(data.questions || []).forEach((q: Record<string, unknown>) => {
      markScores[q.id as string | number] = Number((q.markScore as number) ?? (q.score as number) ?? 0)
      markComments[q.id as string | number] = String((q.markComment as string) ?? '')
    })
  } catch (error) {
    console.error(error)
    ElMessage.error(t('common.errors.loadFailed', '加载答题详情失败'))
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (!data.id) return
  saving.value = true
  try {
    const marks = (data.questions || []).map((q: Record<string, unknown>) => ({
      questionId: q.id,
      score: markScores[q.id as string | number] ?? 0,
      comment: markComments[q.id as string | number] || '',
    }))
    await adminApi.examAnswerMarkSave(data.id, { marks })
    ElMessage.success(t('common.messages.saveSuccess'))
  } catch (error) {
    console.error(error)
    ElMessage.error(t('common.errors.saveFailed'))
  } finally {
    saving.value = false
  }
}

function goBack() {
  history.back()
}

onMounted(load)
</script>

<style scoped lang="scss">
:where(.admin-list-page) {
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .page-title {
    margin: 0;
    font-size: 22px;
    color: var(--el-text-color-primary);
  }
  .desc-wrap {
    background: var(--el-bg-color);
    padding: 16px;
    border-radius: var(--global-border-radius);
  }
}
.question-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.question-block {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 14px;
}
.question-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.question-index {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.question-title {
  flex: 1;
  font-size: 14px;
  color: var(--el-text-color-primary);
}
.answer-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 8px;
}
.answer-row .label {
  width: 80px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.answer-row .value {
  color: var(--el-text-color-primary);
}
.answer-row .right {
  color: var(--el-color-success);
}
.mark-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.mark-row .label {
  width: 80px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.max-score {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.action-bar {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
