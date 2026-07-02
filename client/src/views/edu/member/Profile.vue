<template>
  <div class="member-profile">
    <!-- ① 学员信息头 -->
    <header class="profile-hero">
      <div class="hero-avatar">
        <el-avatar :size="64" :src="avatarUrl">
          <el-icon :size="28"><User /></el-icon>
        </el-avatar>
      </div>
      <div class="hero-info">
        <h1 class="hero-name">{{ displayName }}</h1>
        <div class="hero-meta">
          <span class="meta-item">
            <span class="meta-label">{{ t('edu.profile.memberNo') }}:</span>
            <span class="meta-value">{{ profile?.member_no || profile?.student_no || '-' }}</span>
          </span>
          <span class="meta-item">
            <span class="meta-label">{{ t('edu.profile.memberLevel') }}:</span>
            <span class="meta-value">Lv.{{ profile?.level ?? 0 }}</span>
          </span>
        </div>
      </div>
      <!-- ② 快速操作栏 -->
      <div class="hero-actions">
        <el-button type="primary" :icon="Document" @click="goReport">
          {{ t('edu.profile.generateReport') }}
        </el-button>
        <el-button :icon="Download" :loading="exporting" @click="handleExportPdf">
          {{ t('edu.profile.exportPdf') }}
        </el-button>
        <el-button :icon="Printer" :loading="exporting" @click="handlePrint">
          {{ t('edu.profile.printReport') }}
        </el-button>
        <el-button :icon="Refresh" :loading="loading" @click="loadAll">
          {{ t('edu.profile.retry') }}
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

    <div ref="reportRef" v-loading="loading" class="profile-body">
      <!-- ③ 统计卡 -->
      <section class="stat-row">
        <StatCard
          :title="t('edu.profile.statTotalLearnHours')"
          :value="totalLearnHours"
          icon="Clock"
          :trend="learnTrend"
        />
        <StatCard
          :title="t('edu.profile.statAverageExamScore')"
          :value="averageExamScore"
          icon="TrendCharts"
          :trend="examTrend"
        />
        <StatCard
          :title="t('edu.profile.statCompletionRate')"
          :value="`${completionRate}%`"
          icon="CircleCheck"
          :trend="completionTrend"
        />
        <StatCard
          :title="t('edu.profile.statExamPassRate')"
          :value="`${examPassRate}%`"
          icon="Select"
          :trend="passTrend"
        />
      </section>

      <!-- ④ 薄弱科目条 -->
      <section v-if="weakSubjects.length" class="weak-subjects-bar">
        <span class="weak-label">{{ t('edu.profile.weakSubjects') }}:</span>
        <el-tag
          v-for="subject in weakSubjects"
          :key="subject"
          type="danger"
          effect="plain"
          size="small"
          class="weak-tag"
        >
          {{ subject }}
        </el-tag>
      </section>

      <!-- ⑤ 图表行 -->
      <section class="chart-row">
        <LearningHeatmap :data="dailyStats" />
        <LearningTrendChart :data="dailyStats" />
      </section>

      <!-- ⑥ 课程/考试/证书/错题 -->
      <section class="list-row">
        <CourseProgressList :courses="courses" />
      </section>
      <section class="list-row">
        <ExamRecordList :records="examRecords" />
      </section>
      <section class="list-row">
        <CertificateList :certs="certificates" :uploaded="uploadedCerts" />
      </section>
      <section class="list-row">
        <WrongBookSummary :wrong-book="wrongBook" />
      </section>

      <!-- ⑦ 笔记预览 -->
      <section class="list-row">
        <NotesList :notes="notes" :limit="5" @view-all="goNotes" />
      </section>

      <!-- ⑧ 线下记录预览 -->
      <section class="list-row">
        <OfflineRecordsList :records="offlineRecords" :limit="5" @view-all="goOffline" />
      </section>

      <!-- ⑨ AI 报告占位（PR-D 替换为 <AiReportSection>） -->
      <section class="ai-report-placeholder">
        <el-card shadow="never" class="placeholder-card">
          <div class="placeholder-content">
            <el-icon :size="32" class="placeholder-icon"><MagicStick /></el-icon>
            <h3 class="placeholder-title">{{ t('edu.profile.aiReportTitle') }}</h3>
            <p class="placeholder-desc">{{ t('edu.profile.aiReportComingSoon') }}</p>
          </div>
        </el-card>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Refresh, Document, Download, Printer, MagicStick, User,
} from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useDarkModeStore } from '@/stores/darkMode'
import { THEME_TOKENS } from '@/styles/_theme-tokens'
import { exportElementToPDF, printElement } from '@/utils/exportService'
import { useStudentProfile } from '@/composables/useStudentProfile'
import StatCard from '@/components/edu/StatCard.vue'
import LearningHeatmap from '@/components/edu/LearningHeatmap.vue'
import LearningTrendChart from '@/components/edu/LearningTrendChart.vue'
import CourseProgressList from '@/components/edu/CourseProgressList.vue'
import ExamRecordList from '@/components/edu/ExamRecordList.vue'
import CertificateList from '@/components/edu/CertificateList.vue'
import WrongBookSummary from '@/components/edu/WrongBookSummary.vue'
import NotesList from '@/components/edu/NotesList.vue'
import OfflineRecordsList from '@/components/edu/OfflineRecordsList.vue'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const darkModeStore = useDarkModeStore()
const { user: authUser } = storeToRefs(authStore)

const isDark = computed(
  () => darkModeStore.isDarkMode ?? darkModeStore.themeMode === 'dark'
)

const {
  loading,
  error,
  profile,
  courses,
  examRecords,
  certificates,
  wrongBook,
  uploadedCerts,
  notes,
  offlineRecords,
  dailyStats,
  loadAll,
  totalLearnHours,
  averageExamScore,
  completionRate,
  examPassRate,
  weakSubjects,
} = useStudentProfile()

const reportRef = ref<HTMLElement | null>(null)
const exporting = ref(false)

const avatarUrl = computed(() => {
  const u = authUser as { avatar?: string } | null
  return u?.avatar || ''
})

const displayName = computed(() => {
  return (
    profile.value?.real_name ||
    (authUser as { nickname?: string; username?: string } | null)?.nickname ||
    (authUser as { username?: string } | null)?.username ||
    t('edu.profile.pageTitle')
  )
})

const learnTrend = computed(() => {
  if (!dailyStats.value || dailyStats.value.length < 14) return undefined
  const recent = dailyStats.value.slice(-7).reduce((s, d) => s + d.minutes, 0)
  const previous = dailyStats.value.slice(-14, -7).reduce((s, d) => s + d.minutes, 0)
  if (previous === 0) return recent > 0 ? 100 : 0
  return Math.round(((recent - previous) / previous) * 100)
})

const examTrend = computed(() => undefined)
const completionTrend = computed(() => undefined)
const passTrend = computed(() => undefined)

function goReport() {
  router.push('/edu/member/report')
}
function goNotes() {
  router.push('/edu/member/notes')
}
function goOffline() {
  router.push('/edu/member/offline-records')
}

async function handleExportPdf() {
  if (!reportRef.value || exporting.value) return
  exporting.value = true
  try {
    await exportElementToPDF(reportRef.value, {
      filename: `学员档案_${new Date().toISOString().slice(0, 10)}.pdf`,
      backgroundColor: isDark.value ? THEME_TOKENS.darkSurface : THEME_TOKENS.lightSurface,
    })
  } finally {
    exporting.value = false
  }
}

async function handlePrint() {
  if (!reportRef.value || exporting.value) return
  exporting.value = true
  try {
    await printElement(reportRef.value, {
      backgroundColor: isDark.value ? THEME_TOKENS.darkSurface : THEME_TOKENS.lightSurface,
    })
  } finally {
    exporting.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped lang="scss">
.member-profile {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 24px;
  border: 1px solid var(--color-white-30);
  border-radius: 12px;
  background: var(--el-bg-color);
  flex-wrap: wrap;
}

.hero-avatar {
  flex-shrink: 0;
}

.hero-info {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-name {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.meta-item {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: 13px;
}

.meta-label {
  color: var(--el-text-color-secondary);
}

.meta-value {
  color: var(--el-text-color-primary);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.error-alert {
  margin: 0;
}

.profile-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.weak-subjects-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.weak-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.weak-tag {
  margin-right: 4px;
}

.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.list-row {
  width: 100%;
}

.ai-report-placeholder {
  width: 100%;
}

.placeholder-card {
  border: 1px dashed var(--color-white-50);
  background: var(--el-fill-color-light);
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  text-align: center;
}

.placeholder-icon {
  color: var(--el-color-primary);
}

.placeholder-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.placeholder-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 1024px) {
  .chart-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stat-row {
    grid-template-columns: 1fr;
  }

  .profile-hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
  }

  .hero-actions {
    width: 100%;
  }
}
</style>
