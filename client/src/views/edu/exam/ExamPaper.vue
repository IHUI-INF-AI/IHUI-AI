<template>
  <!--
    ExamPaper.vue — 答题页
    展示试卷题目（单选/多选/判断）、倒计时、提交按钮
    路由: EduExamPaper (/edu/exam/paper/:paperId)
  -->
  <div class="exam-paper">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ paper?.title ?? t('edu.exam.paperTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.exam.paperSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <!-- 倒计时 -->
        <div class="countdown-box" :class="{ 'time-up': remainingSeconds <= 0 }">
          <el-icon><Clock /></el-icon>
          <span class="countdown-label">{{ t('edu.exam.remainingTime') }}</span>
          <span class="countdown-value">{{ formattedRemaining }}</span>
        </div>
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

    <el-alert
      v-if="timeUp"
      type="warning"
      :title="t('edu.exam.timeUp')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <div v-loading="loading" class="paper-body">
      <!-- 试卷信息条 -->
      <div v-if="paper" class="paper-meta-bar">
        <span>{{ t('edu.exam.duration') }}: {{ paper.duration_minutes }}min</span>
        <span>{{ t('edu.exam.totalScore') }}: {{ paper.total_score }}</span>
        <span>{{ t('edu.exam.passScore') }}: {{ paper.pass_score }}</span>
        <span>{{ t('edu.exam.questionCount') }}: {{ questions.length }}</span>
        <span class="answered-count">
          {{ answeredCount }} / {{ questions.length }}
        </span>
      </div>

      <el-empty v-if="!loading && !questions.length" :description="t('edu.exam.noQuestions')" />

      <!-- 题目列表 -->
      <div v-else class="question-list">
        <el-card
          v-for="(q, idx) in questions"
          :key="q.id"
          class="question-card"
          shadow="never"
        >
          <div class="question-head">
            <span class="question-no">{{ idx + 1 }}</span>
            <el-tag size="small" class="question-type-tag">
              {{ questionTypeLabel(q.question_type) }}
            </el-tag>
            <span class="question-score">{{ q.score }} {{ t('edu.profile.score') }}</span>
          </div>
          <div class="question-stem">{{ q.stem }}</div>

          <!-- 单选 / 判断 -->
          <el-radio-group
            v-if="q.question_type === 'single' || q.question_type === 'judgment'"
            v-model="answers[q.id]"
            class="question-options"
          >
            <el-radio
              v-for="opt in q.options ?? []"
              :key="opt"
              :value="opt"
              class="option-item"
            >
              {{ opt }}
            </el-radio>
          </el-radio-group>

          <!-- 多选 -->
          <el-checkbox-group
            v-else-if="q.question_type === 'multi'"
            :model-value="parseMultiAnswer(answers[q.id])"
            class="question-options"
            @update:model-value="(val: string[]) => (answers[q.id] = val.join(','))"
          >
            <el-checkbox
              v-for="opt in q.options ?? []"
              :key="opt"
              :value="opt"
              class="option-item"
            >
              {{ opt }}
            </el-checkbox>
          </el-checkbox-group>

          <!-- 简答 / 填空 -->
          <el-input
            v-else
            v-model="answers[q.id]"
            type="textarea"
            :rows="4"
            class="question-textarea"
            :placeholder="t('edu.exam.yourAnswer')"
          />
        </el-card>
      </div>

      <!-- 提交栏 -->
      <div v-if="questions.length" class="submit-bar">
        <span class="submit-tip">
          {{ t('edu.exam.submitConfirm') }}
        </span>
        <div class="submit-actions">
          <el-button :icon="Back" @click="goBack">
            {{ t('edu.exam.viewDetail') }}
          </el-button>
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="timeUp"
            @click="confirmSubmit"
          >
            {{ t('edu.exam.submitExam') }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, Back } from '@element-plus/icons-vue'
import {
  examApi,
  type EduPaper,
  type EduQuestion,
  type EduExamRecord,
} from '@/api/edu'

const props = defineProps<{ paperId?: string }>()

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const submitting = ref(false)
const error = ref(false)

const paper = ref<EduPaper | null>(null)
const questions = ref<EduQuestion[]>([])
const record = ref<EduExamRecord | null>(null)

// 答案：questionId -> 答案字符串（多选以逗号分隔）
const answers = ref<Record<number, string>>({})

// 倒计时
const remainingSeconds = ref(0)
const timeUp = ref(false)
let timerId: ReturnType<typeof setInterval> | null = null

const answeredCount = computed(() => {
  return questions.value.filter((q) => {
    const a = answers.value[q.id]
    return a !== undefined && a !== null && a !== ''
  }).length
})

const formattedRemaining = computed(() => {
  const s = Math.max(0, remainingSeconds.value)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
})

function questionTypeLabel(type: string) {
  switch (type) {
    case 'single': return t('edu.exam.questionType') + ' · 单选'
    case 'multi': return t('edu.exam.questionType') + ' · 多选'
    case 'judgment': return t('edu.exam.questionType') + ' · 判断'
    case 'subjective':
    case 'fill': return t('edu.exam.questionType') + ' · 简答'
    default: return t('edu.exam.questionType')
  }
}

function parseMultiAnswer(ans: string | undefined): string[] {
  if (!ans) return []
  return ans.split(',').filter(Boolean)
}

async function startExam() {
  if (!props.paperId) return
  loading.value = true
  error.value = false
  try {
    const pid = Number(props.paperId)
    const [paperRes, recordRes, questionsRes] = await Promise.all([
      examApi.getPaper(pid),
      examApi.startExam(pid),
      examApi.listQuestions(pid),
    ])
    paper.value = paperRes.data?.data ?? null
    record.value = recordRes.data?.data ?? null
    questions.value = questionsRes.data?.data ?? []

    // 启动倒计时（基于 duration_minutes）
    if (paper.value) {
      remainingSeconds.value = paper.value.duration_minutes * 60
      startTimer()
    }
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function startTimer() {
  if (timerId) clearInterval(timerId)
  timerId = setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value -= 1
    } else {
      timeUp.value = true
      stopTimer()
      // 时间到自动提交
      ElMessage.warning(t('edu.exam.timeUp'))
      doSubmit()
    }
  }, 1000)
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

async function confirmSubmit() {
  try {
    await ElMessageBox.confirm(t('edu.exam.submitConfirm'), t('edu.exam.submitExam'), {
      type: 'warning',
      confirmButtonText: t('edu.exam.submitExam'),
      cancelButtonText: t('edu.profile.cancel'),
    })
    await doSubmit()
  } catch {
    // 用户取消提交
  }
}

async function doSubmit() {
  if (!record.value) return
  submitting.value = true
  stopTimer()
  try {
    const res = await examApi.submitExam(record.value.id, answers.value)
    ElMessage.success(t('edu.exam.submitSuccess'))
    const newRecord = res.data?.data
    if (newRecord) {
      router.replace({
        name: 'EduExamRecord',
        params: { recordId: String(newRecord.id) },
      })
    } else {
      router.back()
    }
  } catch {
    // 提交失败，恢复计时器（除非时间已到）
    if (!timeUp.value && remainingSeconds.value > 0) {
      startTimer()
    }
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.back()
}

onMounted(startExam)
onBeforeUnmount(stopTimer)
</script>

<style scoped lang="scss">
.exam-paper {
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
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 倒计时 */
.countdown-box {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  border: 1px solid var(--el-color-warning-light-7);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
}

.countdown-box.time-up {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  border-color: var(--el-color-danger-light-7);
}

.countdown-label {
  font-size: 12px;
  font-weight: 400;
}

.countdown-value {
  font-family: 'Courier New', monospace;
  font-size: 16px;
}

.error-alert {
  margin: 0;
}

.paper-body {
  width: 100%;
  min-height: 200px;
}

.paper-meta-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 16px;
}

.answered-count {
  margin-left: auto;
  color: var(--el-color-primary);
  font-weight: 600;
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-card {
  border-radius: 8px;
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
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.question-stem {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
  white-space: pre-wrap;
}

.question-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.option-item {
  display: flex;
  align-items: flex-start;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  margin-right: 0;
  height: auto;
  transition: background 0.2s ease;
}

.option-item:hover {
  background: var(--el-fill-color);
}

:deep(.option-item .el-radio__label),
:deep(.option-item .el-checkbox__label) {
  white-space: normal;
  line-height: 1.5;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.question-textarea {
  width: 100%;
}

.submit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  margin-top: 16px;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.submit-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex: 1;
}

.submit-actions {
  display: flex;
  gap: 8px;
}
</style>
