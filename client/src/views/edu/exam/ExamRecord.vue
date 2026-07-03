<template>
  <!--
    ExamRecord.vue — 考试记录详情页
    展示成绩 + 每题作答情况（你的答案 / 正确答案 / 解析）
    路由: EduExamRecord (/edu/exam/record/:recordId)
  -->
  <div class="exam-record">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.exam.recordTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.exam.recordSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Back" @click="goBack">
          {{ t('edu.profile.retry') }}
        </el-button>
        <el-button type="primary" :icon="Document" @click="goWrongBook">
          {{ t('edu.exam.wrongBookTitle') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.profile.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <div v-loading="loading" class="record-body">
      <!-- 成绩卡 -->
      <el-card v-if="record" class="score-card" shadow="never">
        <div class="score-row">
          <div class="score-block">
            <span class="score-label">{{ t('edu.exam.yourScore') }}</span>
            <span class="score-value" :class="scoreClass">
              {{ record.score ?? '—' }}
            </span>
          </div>
          <div class="score-divider" />
          <div class="score-meta">
            <div class="meta-item">
              <span class="meta-label">{{ t('edu.exam.startAt') }}</span>
              <span class="meta-value">{{ record.start_at }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ t('edu.exam.submitAt') }}</span>
              <span class="meta-value">{{ record.submit_at || '—' }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">{{ t('edu.profile.status') }}</span>
              <el-tag v-if="record.status === 'graded' && record.is_passed" type="success">
                {{ t('edu.exam.passed') }}
              </el-tag>
              <el-tag v-else-if="record.status === 'graded' && !record.is_passed" type="danger">
                {{ t('edu.exam.failed') }}
              </el-tag>
              <el-tag v-else-if="record.status === 'submitted'" type="warning">
                {{ t('edu.exam.pending') }}
              </el-tag>
              <el-tag v-else type="info">
                {{ t('edu.exam.statusProgress') }}
              </el-tag>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 题目作答明细 -->
      <el-card v-if="questions.length" class="questions-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">{{ t('edu.exam.questionCount') }}: {{ questions.length }}</span>
          </div>
        </template>
        <div class="question-list">
          <div
            v-for="(q, idx) in questions"
            :key="q.id"
            class="question-item"
            :class="answerClass(q)"
          >
            <div class="question-head">
              <span class="question-no">{{ idx + 1 }}</span>
              <el-tag size="small" class="question-type-tag">
                {{ questionTypeLabel(q.question_type) }}
              </el-tag>
              <span class="question-score">{{ q.score }} {{ t('edu.profile.score') }}</span>
              <el-tag
                v-if="record && isGraded"
                :type="isCorrect(q) ? 'success' : 'danger'"
                size="small"
                class="question-result"
              >
                {{ isCorrect(q) ? '✓' : '✗' }}
              </el-tag>
            </div>
            <div class="question-stem">{{ q.stem }}</div>

            <!-- 选项展示 -->
            <div v-if="q.options?.length" class="option-list">
              <div
                v-for="opt in q.options"
                :key="opt"
                class="option-row"
                :class="optionClass(q, opt)"
              >
                <span class="option-text">{{ opt }}</span>
              </div>
            </div>

            <!-- 你的答案 / 正确答案 / 解析 -->
            <div class="answer-block">
              <div class="answer-row">
                <span class="answer-label">{{ t('edu.exam.yourAnswer') }}:</span>
                <span class="answer-value" :class="{ wrong: !isCorrect(q) }">
                  {{ userAnswer(q.id) || '—' }}
                </span>
              </div>
              <div v-if="q.correct_answer" class="answer-row">
                <span class="answer-label">{{ t('edu.exam.correctAnswer') }}:</span>
                <span class="answer-value correct">{{ q.correct_answer }}</span>
              </div>
              <div v-if="q.analysis" class="answer-row analysis-row">
                <span class="answer-label">{{ t('edu.exam.analysis') }}:</span>
                <span class="answer-value">{{ q.analysis }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <el-empty v-else-if="!loading" :description="t('edu.exam.noQuestions')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Back, Document } from '@element-plus/icons-vue'
import {
  examApi,
  type EduQuestion,
  type EduExamRecord,
} from '@/api/edu'

const props = defineProps<{ recordId?: string }>()

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const error = ref(false)

const record = ref<EduExamRecord | null>(null)
const questions = ref<EduQuestion[]>([])
const userAnswers = ref<Record<number, string>>({})

const isGraded = computed(() => record.value?.status === 'graded')

const scoreClass = computed(() => {
  if (!record.value || record.value.score === undefined || record.value.score === null) return ''
  return record.value.is_passed ? 'pass' : 'fail'
})

function questionTypeLabel(type: string) {
  switch (type) {
    case 'single': return '单选'
    case 'multi': return '多选'
    case 'judgment': return '判断'
    case 'subjective':
    case 'fill': return '简答'
    default: return type
  }
}

function userAnswer(qid: number): string {
  return userAnswers.value[qid] ?? ''
}

// 判断答案是否正确
function isCorrect(q: EduQuestion): boolean {
  if (!q.correct_answer) return false
  const ua = userAnswer(q.id)
  if (!ua) return false
  // 多选：比较排序后的集合
  if (q.question_type === 'multi') {
    const uaSet = ua.split(',').map((s) => s.trim()).filter(Boolean).sort()
    const caSet = q.correct_answer.split(',').map((s) => s.trim()).filter(Boolean).sort()
    return uaSet.join(',') === caSet.join(',')
  }
  return ua.trim() === q.correct_answer.trim()
}

function answerClass(q: EduQuestion) {
  if (!isGraded.value || !q.correct_answer) return ''
  return isCorrect(q) ? 'correct' : 'wrong'
}

function optionClass(q: EduQuestion, opt: string) {
  if (!isGraded.value) return ''
  const isUserAnswer = userAnswer(q.id)
    .split(',')
    .map((s) => s.trim())
    .includes(opt)
  const isCorrectAnswer = q.correct_answer
    ?.split(',')
    .map((s) => s.trim())
    .includes(opt) ?? false
  if (isCorrectAnswer) return 'option-correct'
  if (isUserAnswer && !isCorrectAnswer) return 'option-wrong'
  return ''
}

async function loadRecord() {
  if (!props.recordId) return
  loading.value = true
  error.value = false
  try {
    const rid = Number(props.recordId)
    const recordRes = await examApi.getExamRecord(rid)
    record.value = recordRes.data?.data ?? null

    if (record.value?.paper_id) {
      const questionsRes = await examApi.listQuestions(record.value.paper_id)
      questions.value = questionsRes.data?.data ?? []
    }

    // 用户答案通常来自 record 的扩展字段；类型 EduExamRecord 没有标准字段，从任意字段读取
    // 这里通过类型断言兼容后端可能返回的 answers 字段
    const recAny = record.value as EduExamRecord & { answers?: Record<number, string> }
    if (recAny.answers && typeof recAny.answers === 'object') {
      userAnswers.value = { ...recAny.answers }
    }
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function goWrongBook() {
  router.push({ name: 'EduExamWrongBook' })
}

function goBack() {
  router.back()
}

onMounted(loadRecord)
</script>

<style scoped lang="scss">
.exam-record {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.error-alert {
  margin: 0;
}

.record-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-height: 200px;
}

.score-card,
.questions-card {
  border-radius: 8px;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.score-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 120px;
}

.score-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.score-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.score-value.pass {
  color: var(--el-color-success);
}

.score-value.fail {
  color: var(--el-color-danger);
}

.score-divider {
  width: 1px;
  height: 56px;
  background: var(--el-border-color-lighter);
}

.score-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.meta-label {
  color: var(--el-text-color-secondary);
  min-width: 80px;
}

.meta-value {
  color: var(--el-text-color-primary);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-item {
  padding: 16px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.question-item.correct {
  border-left: 3px solid var(--el-color-success);
}

.question-item.wrong {
  border-left: 3px solid var(--el-color-danger);
}

.question-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.question-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
}

.question-type-tag {
  border-radius: 8px;
}

.question-score {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.question-result {
  margin-left: auto;
  border-radius: 8px;
  font-weight: 700;
}

.question-stem {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
  white-space: pre-wrap;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.option-row {
  padding: 8px 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.option-row.option-correct {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success-light-7);
  color: var(--el-color-success);
}

.option-row.option-wrong {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
  color: var(--el-color-danger);
}

.option-text {
  white-space: pre-wrap;
}

.answer-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.answer-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 1.6;
}

.answer-label {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  min-width: 80px;
}

.answer-value {
  color: var(--el-text-color-primary);
  flex: 1;
  white-space: pre-wrap;
}

.answer-value.correct {
  color: var(--el-color-success);
  font-weight: 600;
}

.answer-value.wrong {
  color: var(--el-color-danger);
}

.analysis-row {
  padding-top: 6px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
</style>
