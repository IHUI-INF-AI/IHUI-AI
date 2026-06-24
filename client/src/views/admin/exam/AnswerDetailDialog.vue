<template>
  <ElDialog v-model="visibleModel" :title="dialogTitle" width="960px" :close-on-click-modal="false" @closed="onClosed">
    <div v-loading="loading">
      <el-descriptions :column="2" border class="desc-wrap">
        <el-descriptions-item label="用户">{{ detail.userName }}</el-descriptions-item>
        <el-descriptions-item label="试卷">{{ detail.paperTitle }}</el-descriptions-item>
        <el-descriptions-item label="得分">{{ detail.score }} / {{ detail.totalScore }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ detail.submitTime }}</el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <div class="question-list">
        <div v-for="(q, i) in detail.questions" :key="q.id" class="question-block">
          <div class="question-header">
            <span class="question-index">{{ Number(i) + 1 }}.</span>
            <span class="question-title">{{ q.title }}</span>
            <el-tag size="small">{{ q.score }}分</el-tag>
          </div>
          <div class="answer-row">
            <span class="label">{{ t('answerDetail.studentAnswer') }}</span>
            <span class="value">{{ q.userAnswer || '未作答' }}</span>
          </div>
          <div class="answer-row">
            <span class="label">{{ t('answerDetail.correctAnswer') }}</span>
            <span class="value right">{{ q.correctAnswer }}</span>
          </div>
          <div class="mark-row">
            <span class="label">{{ t('answerDetail.score') }}</span>
            <el-input-number v-model="markScores[q.id]" :min="0" :max="Number(q.score) || 100" :step="0.5" :precision="1" size="small" />
            <span class="max-score">/ {{ q.score }}</span>
          </div>
          <div class="mark-row">
            <span class="label">{{ t('answerDetail.comment') }}</span>
            <el-input v-model="markComments[q.id]" type="textarea" :rows="2" placeholder="请输入评分评语" />
          </div>
        </div>
        <el-empty v-if="!detail.questions?.length" description="暂无答题明细" :image-size="80" />
      </div>
    </div>
    <template #footer>
      <ElButton @click="visibleModel = false">{{ cancelLabel }}</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSave">{{ submitLabel }}</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElDialog, ElDescriptions, ElDescriptionsItem, ElDivider, ElTag, ElInput, ElInputNumber, ElButton } from 'element-plus'
import { adminApi } from '@/api/admin'

const props = withDefaults(
  defineProps<{
    visible: boolean
    initialData: Record<string, any>
    submitting?: boolean
  }>(),
  { submitting: false },
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'submit'): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const detail = reactive<Record<string, any>>({ questions: [] })
const markScores = reactive<Record<string, number>>({})
const markComments = reactive<Record<string, string>>({})

const dialogTitle = computed(() => `答题详情 #${props.initialData.id ?? ''}`)
const submitLabel = computed(() => t('common.save'))
const cancelLabel = computed(() => t('common.cancel'))

const visibleModel = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

watch(
  () => props.visible,
  async (visible) => {
    if (!visible) return
    loading.value = true
    try {
      const id = props.initialData.id
      const res = await adminApi.examAnswerDetail(id)
      const payload = ((res?.data as any)?.data || (res?.data as any) || {}) as Record<string, unknown>
      Object.assign(detail, {
        id: payload.id,
        userName: payload.userName,
        paperTitle: payload.paperTitle,
        score: payload.score,
        totalScore: payload.totalScore,
        submitTime: payload.submitTime,
        questions: (payload.questions || []) as Array<Record<string, unknown>>,
      })
      detail.questions.forEach((q: Record<string, unknown>) => {
        markScores[q.id as string | number] = Number((q.markScore as number) ?? (q.score as number) ?? 0)
        markComments[q.id as string | number] = String((q.markComment as string) ?? '')
      })
    } catch (error) {
      console.error(error)
      ElMessage.error(t('common.errors.loadFailed', '加载答题详情失败'))
    } finally {
      loading.value = false
    }
  },
)

async function handleSave() {
  if (!props.initialData.id) return
  saving.value = true
  try {
    const marks = detail.questions.map((q: Record<string, unknown>) => ({
      questionId: q.id,
      score: markScores[q.id as string | number] ?? 0,
      comment: markComments[q.id as string | number] || '',
    }))
    await adminApi.examAnswerMarkSave(props.initialData.id, { marks })
    ElMessage.success(t('common.messages.saveSuccess'))
    emit('submit')
    emit('update:visible', false)
  } catch (error) {
    console.error(error)
    ElMessage.error(t('common.errors.saveFailed'))
  } finally {
    saving.value = false
  }
}

function onClosed() {
  emit('close')
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.desc-wrap {
  margin-bottom: 16px;
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
  width: 70px;
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
  width: 70px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.max-score {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
