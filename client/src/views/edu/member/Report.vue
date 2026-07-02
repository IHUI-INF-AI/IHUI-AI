<template>
  <div class="member-report">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.profile.reportTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.profile.reportSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Download" :loading="exporting" type="primary" @click="handleDownload">
          PDF
        </el-button>
        <el-button :icon="Printer" :loading="exporting" @click="handlePrint">
          {{ t('edu.profile.print') }}
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

    <div ref="reportRef" class="report-paper">
      <div v-loading="loading" class="report-body">
        <section class="report-section">
          <h2 class="section-heading">{{ t('edu.profile.pageTitle') }}</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">{{ t('edu.profile.certIssuerLabel') }}</span>
              <span class="info-value">{{ profile?.real_name || profile?.nickname || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('edu.profile.statTotalLearnHours') }}</span>
              <span class="info-value">{{ totalLearnHours }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('edu.profile.statAverageExamScore') }}</span>
              <span class="info-value">{{ averageExamScore }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('edu.profile.statCompletionRate') }}</span>
              <span class="info-value">{{ completionRate }}%</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ t('edu.profile.statExamPassRate') }}</span>
              <span class="info-value">{{ examPassRate }}%</span>
            </div>
          </div>
        </section>

        <section v-if="weakSubjects.length" class="report-section">
          <h2 class="section-heading">{{ t('edu.profile.weakSubjects') }}</h2>
          <div class="weak-tags">
            <el-tag
              v-for="subject in weakSubjects"
              :key="subject"
              type="danger"
              effect="plain"
              size="small"
            >
              {{ subject }}
            </el-tag>
          </div>
        </section>

        <section class="report-section">
          <h2 class="section-heading">{{ t('edu.profile.learningTrend') }}</h2>
          <LearningTrendChart :data="dailyStats" />
        </section>

        <section class="report-section">
          <h2 class="section-heading">{{ t('edu.profile.courseProgress') }}</h2>
          <CourseProgressList :courses="courses" />
        </section>

        <section class="report-section">
          <h2 class="section-heading">{{ t('edu.profile.examRecords') }}</h2>
          <ExamRecordList :records="examRecords" />
        </section>

        <section class="report-section">
          <h2 class="section-heading">{{ t('edu.profile.certificates') }}</h2>
          <CertificateList :certs="certificates" :uploaded="uploadedCerts" />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, Printer } from '@element-plus/icons-vue'
import { useStudentProfile } from '@/composables/useStudentProfile'
import { exportElementToPDF, printElement } from '@/utils/exportService'
import { useDarkModeStore } from '@/stores/darkMode'
import { THEME_TOKENS } from '@/styles/_theme-tokens'
import LearningTrendChart from '@/components/edu/LearningTrendChart.vue'
import CourseProgressList from '@/components/edu/CourseProgressList.vue'
import ExamRecordList from '@/components/edu/ExamRecordList.vue'
import CertificateList from '@/components/edu/CertificateList.vue'

const { t } = useI18n()
const darkModeStore = useDarkModeStore()
const isDark = computed(
  () => darkModeStore.isDarkMode ?? darkModeStore.themeMode === 'dark'
)

const reportRef = ref<HTMLElement | null>(null)
const exporting = ref(false)

const {
  loading,
  error,
  profile,
  courses,
  examRecords,
  certificates,
  uploadedCerts,
  dailyStats,
  loadAll,
  totalLearnHours,
  averageExamScore,
  completionRate,
  examPassRate,
  weakSubjects,
} = useStudentProfile()

async function handleDownload() {
  if (!reportRef.value || exporting.value) return
  exporting.value = true
  try {
    await exportElementToPDF(reportRef.value, {
      filename: `学习档案报告_${new Date().toISOString().slice(0, 10)}.pdf`,
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
.member-report {
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

.report-paper {
  background: var(--el-bg-color);
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  padding: 32px;
}

.report-body {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.report-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-heading {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-bottom: 8px;
  border-bottom: 2px solid var(--el-color-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.info-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.info-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.weak-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 640px) {
  .report-paper {
    padding: 16px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
