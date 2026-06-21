<template>
  <div class="exam-do-page page-container">
    <div v-if="!started" class="intro-card">
      <h1 class="p-title">{{ paper?.title }}</h1>
      <p class="p-desc">{{ paper?.description }}</p>
      <div class="p-info">
        <span>{{ t('examDo.questionCount') }}: {{ paper?.question_num }}</span>
        <span>{{ t('examDo.duration') }}: {{ paper?.duration }} {{ t('examDo.minutes') }}</span>
        <span>{{ t('examDo.passScore') }}: {{ paper?.pass_score }} / {{ paper?.total_score }}</span>
      </div>
      <button class="start-btn" @click="handleStart">{{ t('examDo.startExam') }}</button>
    </div>

    <template v-else>
      <div class="exam-header">
        <span class="e-title">{{ paper?.title }}</span>
        <span class="e-timer">⏱ {{ t('examDo.remaining') }} {{ remaining }} {{ t('examDo.minutes') }}</span>
      </div>

      <div v-loading="loading" class="q-list">
        <div v-for="(q, idx) in questions" :key="q.id" class="q-item">
          <h3 class="q-title">
            <span class="q-num">{{ Number(idx) + 1 }}.</span>
            <span class="q-type">{{ getTypeLabel(q.type) }}</span>
            <span class="q-score">({{ q.score }} {{ t('examDo.score') }})</span>
          </h3>
          <div class="q-content">{{ q.content }}</div>

          <div v-if="q.type === 'single' || q.type === 'judge'" class="options">
            <label v-for="(opt, i) in getOptions(q)" :key="i" class="opt">
              <input type="radio" :name="`q_${q.id}`" :value="opt" v-model="answers[q.id]" />
              <span>{{ opt }}</span>
            </label>
          </div>

          <div v-else-if="q.type === 'multiple'" class="options">
            <label v-for="(opt, i) in getOptions(q)" :key="i" class="opt">
              <input type="checkbox" :value="opt" :checked="(multipleAnswers[q.id] || []).includes(opt)" @change="(e) => toggleMultiple(q.id, opt, (e.target as HTMLInputElement).checked)" />
              <span>{{ opt }}</span>
            </label>
          </div>

          <div v-else-if="q.type === 'fill'" class="options">
            <input v-model="answers[q.id]" class="fill-input" placeholder="请输入答案" />
          </div>

          <div v-else-if="q.type === 'essay'" class="options">
            <textarea v-model="answers[q.id]" class="essay-input" rows="4" placeholder="请作答..." />
          </div>
        </div>
      </div>

      <div class="submit-bar">
        <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('examDo.submit') }}</el-button>
      </div>
    </template>

    <el-dialog v-model="resultVisible" title="考试结果" width="420px">
      <div v-if="result" class="result-body">
        <div class="r-score">
          <span class="r-score-num">{{ result.score }}</span>
          <span class="r-score-total">/ {{ result.total_score }}</span>
        </div>
        <div :class="['r-passed', { passed: result.passed }]">
          {{ result.passed ? '🎉 恭喜通过' : '😢 未及格' }}
        </div>
      </div>
      <template #footer>
        <el-button @click="goBack">返回列表</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useCleanup } from '@/composables/useCleanup'
import { examApi } from '@/api/exam'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const cleanup = useCleanup()
const loading = ref(false)
const paper = ref<any>(null)
const questions = ref<any[]>([])
const started = ref(false)
const answers = ref<Record<string, any>>({})
const multipleAnswers = ref<Record<string, string[]>>({})
const startTime = ref(0)
const remaining = ref(0)
const timerId = ref<any>(null)
const submitting = ref(false)
const resultVisible = ref(false)
const result = ref<any>(null)

function getTypeLabel(type: string) {
  return { single: '单选', multiple: '多选', judge: '判断', fill: '填空', essay: '简答' }[type] || type
}

function getOptions(q: any) {
  if (Array.isArray(q.options)) return q.options
  if (typeof q.options === 'string') {
    try {
      return JSON.parse(q.options)
    } catch {
      return []
    }
  }
  return []
}

function toggleMultiple(qid: string, opt: string, checked: boolean) {
  const cur = multipleAnswers.value[qid] || []
  if (checked) {
    if (!cur.includes(opt)) multipleAnswers.value[qid] = [...cur, opt]
  } else {
    multipleAnswers.value[qid] = cur.filter((x) => x !== opt)
  }
}

async function loadDetail() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    const [pRes, qRes] = await Promise.all([
      examApi.paperDetail(id),
      examApi.questions(id),
    ])
    const pData = pRes?.data
    paper.value = pData?.data || pData || null
    const qData = qRes?.data
    questions.value = qData?.data || qData?.list || qData || []
  } catch {
    /* 静默 */
  } finally {
    loading.value = false
  }
}

function handleStart() {
  started.value = true
  startTime.value = Date.now()
  remaining.value = paper.value?.duration || 60
  timerId.value = cleanup.addInterval(() => {
    remaining.value = Math.max(0, remaining.value - 1)
    if (remaining.value === 0) {
      clearInterval(timerId.value)
      handleSubmit()
    }
  }, 60000)
}

async function handleSubmit() {
  if (submitting.value) return
  const id = Number(route.params.id)
  const allAnswers: Record<string, any> = {}
  for (const q of questions.value) {
    if (q.type === 'multiple') {
      allAnswers[q.id] = (multipleAnswers.value[q.id] || []).join(',')
    } else {
      allAnswers[q.id] = answers.value[q.id] || ''
    }
  }
  const duration = Math.max(1, Math.round((Date.now() - startTime.value) / 60000))
  submitting.value = true
  try {
    const res = await examApi.submit({ paper_id: id, answers: allAnswers, duration })
    const data = res?.data
    result.value = data?.data || data || null
    resultVisible.value = true
    if (timerId.value) clearInterval(timerId.value)
  } catch {
    toast.error('提交失败')
  } finally {
    submitting.value = false
  }
}

function goBack() {
  resultVisible.value = false
  router.push('/exam')
}

watch(() => route.params.id, loadDetail, { immediate: true })
onMounted(loadDetail)
</script>

<style scoped>
.page-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px;
}

.intro-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 40px 32px;
  text-align: center;
}

.p-title {
  font-size: 24px;
  font-weight: 600;
  color: $text-main;
  margin: 0 0 12px;
}

.p-desc {
  font-size: 15px;
  color: $text-sec;
  margin: 0 0 16px;
  line-height: 1.6;
}

.p-info {
  display: flex;
  justify-content: center;
  gap: 20px;
  font-size: 14px;
  color: $text-main;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.start-btn {
  background: $brand-primary;
  color: var(--el-bg-color);
  border: none;
  border-radius: var(--global-border-radius);
  padding: 10px 32px;
  font-size: 16px;
  cursor: pointer;
}

.exam-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 12px 16px;
  margin-bottom: 12px;
}

.e-title {
  font-size: 16px;
  font-weight: 500;
  color: $text-main;
}

.e-timer {
  font-size: 14px;
  color: $brand-primary;
  font-weight: 500;
}

.q-list {
  min-height: 200px;
}

.q-item {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px;
  margin-bottom: 8px;
}

.q-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  color: $text-main;
  margin: 0 0 8px;
}

.q-num {
  font-weight: 600;
  color: $brand-primary;
}

.q-type {
  font-size: 12px;
  padding: 1px 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  border-radius: var(--global-border-radius);
}

.q-score {
  font-size: 12px;
  color: $text-sec;
}

.q-content {
  font-size: 15px;
  line-height: 1.6;
  color: $text-main;
  margin-bottom: 12px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opt {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: $text-main;
  cursor: pointer;
  padding: 6px 0;
}

.fill-input,
.essay-input {
  width: 100%;
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  background: var(--el-bg-color);
  color: $text-main;
  outline: none;
  font-family: inherit;
  resize: vertical;
}

.fill-input:focus,
.essay-input:focus {
  border-color: $brand-primary;
}

.submit-bar {
  margin-top: 16px;
  text-align: center;
}

.result-body {
  text-align: center;
  padding: 20px 0;
}

.r-score {
  font-size: 32px;
  font-weight: 600;
  color: $text-main;
  margin-bottom: 8px;
}

.r-score-total {
  font-size: 18px;
  color: $text-sec;
  font-weight: 400;
}

.r-passed {
  font-size: 18px;
  color: var(--el-color-danger);
  font-weight: 500;
}

.r-passed.passed {
  color: var(--el-color-success);
}
</style>
