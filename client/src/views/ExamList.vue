<template>
  <div class="exam-list-page page-container">
    <div class="page-header">
      <h1 class="page-title">{{ t('examList.title') }}</h1>
      <p class="page-subtitle">{{ t('examList.subtitle') }}</p>
    </div>

    <div class="tabs-row">
      <button v-for="tab in tabs" :key="tab.key" :class="['tab-btn', { active: activeTab === tab.key }]" @click="activeTab = tab.key">
        {{ tab.label }}
      </button>
    </div>

    <div v-if="activeTab === 'papers'" v-loading="loading" class="list-wrap">
      <div class="filter-bar">
        <input v-model="keyword" class="search-input" :placeholder="t('examList.searchPlaceholder')" @keydown.enter="loadPapers" />
        <select v-model="difficulty" class="filter-select" @change="loadPapers">
          <option value="">{{ t('examList.difficultyAll') }}</option>
          <option value="easy">{{ t('examList.difficultyEasy') }}</option>
          <option value="medium">{{ t('examList.difficultyMedium') }}</option>
          <option value="hard">{{ t('examList.difficultyHard') }}</option>
        </select>
      </div>

      <div v-if="papers.length === 0" class="empty-state">
        <div class="empty-icon">📝</div>
        <p>{{ t('examList.emptyPapers') }}</p>
      </div>

      <div v-else class="paper-grid">
        <div v-for="p in papers" :key="p.id" class="paper-card">
          <h3 class="p-title">{{ p.title }}</h3>
          <p class="p-desc">{{ p.description || t('examList.noDesc') }}</p>
          <div class="p-stats">
            <span>📋 {{ p.question_num }} {{ t('examList.questionUnit') }}</span>
            <span>⏱ {{ p.duration }} {{ t('examList.minuteUnit') }}</span>
            <span :class="['difficulty', `diff-${p.difficulty}`]">{{ getDifficultyLabel(p.difficulty) }}</span>
          </div>
          <div class="p-foot">
            <span class="p-score">{{ t('examList.passPrefix') }} {{ p.pass_score }}/{{ p.total_score }}</span>
            <span class="p-attempt">{{ t('examList.attemptPrefix') }} {{ p.attempt_num }} {{ t('examList.attemptSuffix') }}</span>
          </div>
          <div class="p-actions">
            <button class="action-btn" @click="goWrong">{{ t('examList.wrongBook') }}</button>
            <button class="action-btn primary" @click="goDo(p.id)">{{ t('examList.startExam') }}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'records'" v-loading="loading" class="list-wrap">
      <div v-if="records.length === 0" class="empty-state">
        <div class="empty-icon">📊</div>
        <p>{{ t('examList.emptyRecords') }}</p>
      </div>
      <ul v-else class="record-list">
        <li v-for="r in records" :key="r.id" :class="['record-item', { passed: r.passed }]">
          <div class="r-main">
            <span class="r-title">{{ t('examList.paperPrefix') }} #{{ r.paper_id }}</span>
            <span :class="['r-status', { passed: r.passed }]">{{ r.passed ? t('examList.passed') : t('examList.notPassed') }}</span>
          </div>
          <div class="r-meta">
            <span>{{ t('examList.scorePrefix') }} {{ r.score }} / {{ r.total_score }}</span>
            <span>{{ t('examList.usedTimePrefix') }} {{ r.duration }} {{ t('examList.minuteUnit') }}</span>
            <span>{{ formatTime(r.create_time) }}</span>
          </div>
        </li>
      </ul>
    </div>

    <div v-else-if="activeTab === 'wrong'" v-loading="loading" class="list-wrap">
      <div v-if="wrongs.length === 0" class="empty-state">
        <div class="empty-icon">✅</div>
        <p>{{ t('examList.emptyWrong') }}</p>
      </div>
      <ul v-else class="wrong-list">
        <li v-for="w in wrongs" :key="w.id" class="wrong-item">
          <div class="w-q">{{ w.question?.content || w.content || t('examList.questionContent') }}</div>
          <div class="w-a">{{ t('examList.correctAnswer') }} {{ w.question?.answer || w.answer || '***' }}</div>
          <button class="remove-btn" @click="handleRemoveWrong(w.id)">{{ t('examList.remove') }}</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { examApi } from '@/api/exam'

const router = useRouter()
const toast = useToast()
const { t } = useI18n()
const activeTab = ref<string>('papers')
const loading = ref(false)
interface ExamWrong {
  id?: number
  content?: string
  answer?: string
  question?: { content?: string; answer?: string }
}
const papers = ref<unknown[]>([])
const records = ref<unknown[]>([])
const wrongs = ref<ExamWrong[]>([])
const keyword = ref('')
const difficulty = ref('')

const tabs = [
  { key: 'papers', label: t('examList.tabs.papers') },
  { key: 'records', label: t('examList.tabs.records') },
  { key: 'wrong', label: t('examList.tabs.wrong') },
]

function getDifficultyLabel(d: string) {
  return { easy: t('examList.difficultyEasy'), medium: t('examList.difficultyMedium'), hard: t('examList.difficultyHard') }[d] || t('examList.difficultyUnknown')
}

function formatTime(time: string) {
  if (!time) return ''
  return time.slice(0, 16).replace('T', ' ')
}

function goWrong() {
  activeTab.value = 'wrong'
}

function goDo(id: number) {
  router.push(`/exam/${id}`)
}

async function loadPapers() {
  loading.value = true
  try {
    const params: { page: number; limit: number; keyword?: string; difficulty?: string } = { page: 1, limit: 30 }
    if (keyword.value) params.keyword = keyword.value
    if (difficulty.value) params.difficulty = difficulty.value
    const res = await examApi.listPapers(params)
    const data = (res as { data?: { data?: unknown[]; list?: unknown[] } })?.data
    papers.value = (data?.data || data?.list || data || []) as unknown[]
  } catch {
    /* 静默 */
  } finally {
    loading.value = false
  }
}

async function loadRecords() {
  loading.value = true
  try {
    const res = await examApi.records({ page: 1, limit: 30 })
    const data = (res as { data?: { data?: unknown[]; list?: unknown[] } })?.data
    records.value = (data?.data || data?.list || data || []) as unknown[]
  } catch {
    /* 静默 */
  } finally {
    loading.value = false
  }
}

async function loadWrongs() {
  loading.value = true
  try {
    const res = await examApi.wrongList({ page: 1, limit: 50 })
    const data = (res as { data?: { data?: unknown[]; list?: unknown[] } })?.data
    wrongs.value = (data?.data || data?.list || data || []) as ExamWrong[]
  } catch {
    /* 静默 */
  } finally {
    loading.value = false
  }
}

async function handleRemoveWrong(id: number) {
  try {
    await examApi.removeWrong(id)
    wrongs.value = wrongs.value.filter((w) => w.id !== id)
    toast.success('已移除')
  } catch {
    toast.error('移除失败')
  }
}

watch(activeTab, (val) => {
  const v = String(val)
  if (v === 'papers') loadPapers()
  else if (v === 'records') loadRecords()
  else if (v === 'wrong') loadWrongs()
})

onMounted(loadPapers)
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: $text-main;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: $text-sec;
  margin: 4px 0 0;
}

.tabs-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tab-btn {
  padding: 6px 14px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 14px;
  color: $text-main;
}

.tab-btn.active {
  background: $brand-primary;
  color: var(--el-bg-color);
  border-color: $brand-primary;
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  background: var(--el-bg-color);
  color: $text-main;
}

.filter-select {
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  font-size: 14px;
  color: $text-main;
}

.list-wrap {
  min-height: 300px;
}

.paper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.paper-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.p-title {
  font-size: 15px;
  font-weight: 500;
  color: $text-main;
  margin: 0;
}

.p-desc {
  font-size: 13px;
  color: $text-sec;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.p-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: $text-sec;
  flex-wrap: wrap;
}

.difficulty {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: var(--global-border-radius);
}

.difficulty.diff-easy {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.difficulty.diff-medium {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}

.difficulty.diff-hard {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.p-foot {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: $text-sec;
}

.p-score {
  color: $brand-primary;
  font-weight: 500;
}

.p-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

.action-btn {
  flex: 1;
  padding: 6px 12px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  color: $text-main;
  border-radius: var(--global-border-radius);
  font-size: 13px;
  cursor: pointer;
}

.action-btn:hover {
  border-color: $brand-primary;
  color: $brand-primary;
}

.action-btn.primary {
  background: $brand-primary;
  color: var(--el-bg-color);
  border-color: $brand-primary;
}

.action-btn.primary:hover {
  opacity: 0.9;
}

.record-list,
.wrong-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.record-item {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 12px 16px;
  margin-bottom: 8px;
}

.record-item.passed {
  border-left: 3px solid var(--el-color-success);
}

.r-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.r-title {
  font-size: 14px;
  font-weight: 500;
  color: $text-main;
}

.r-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.r-status.passed {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.r-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: $text-sec;
}

.wrong-item {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 12px 16px;
  margin-bottom: 8px;
  position: relative;
}

.w-q {
  font-size: 14px;
  color: $text-main;
  margin-bottom: 6px;
  line-height: 1.5;
  padding-right: 60px;
}

.w-a {
  font-size: 13px;
  color: var(--el-color-success);
}

.remove-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: var(--unified-border);
  color: $text-sec;
  border-radius: var(--global-border-radius);
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}

.remove-btn:hover {
  border-color: var(--el-color-danger);
  color: var(--el-color-danger);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: $text-sec;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}
</style>
