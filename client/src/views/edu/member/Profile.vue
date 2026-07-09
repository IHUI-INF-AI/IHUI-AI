<template>
  <div class="member-profile" role="region" :aria-label="t('edu.profile.pageTitle')">
    <!-- ① 学员信息头 -->
    <header class="profile-hero">
      <div class="hero-avatar">
        <Avatar :size="64" :src="avatarUrl" />
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
        <el-button type="primary" :icon="Document" :aria-label="t('edu.profile.generateReport')" @click="goReport">
          {{ t('edu.profile.generateReport') }}
        </el-button>
        <el-button :icon="Download" :loading="exporting" :aria-label="t('edu.profile.exportPdf')" @click="handleExportPdf">
          {{ t('edu.profile.exportPdf') }}
        </el-button>
        <el-button :icon="Printer" :loading="exporting" :aria-label="t('edu.profile.printReport')" @click="handlePrint">
          {{ t('edu.profile.printReport') }}
        </el-button>
        <el-button :icon="Refresh" :loading="loading" :aria-label="t('edu.common.retry')" @click="loadAll">
          {{ t('edu.common.retry') }}
        </el-button>
      </div>
    </header>

    <Alert
      v-if="error"
      variant="destructive"
      :title="t('edu.common.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- PR-F F6：骨架屏替换 v-loading（首次加载体验更佳） -->
    <div v-if="loading && !profile" class="profile-skeleton">
      <div class="skeleton-row">
        <el-skeleton :rows="0" animated>
          <template #template>
            <el-skeleton-item variant="rect" style="width: 100%; height: 96px; border-radius: 8px" />
          </template>
        </el-skeleton>
        <el-skeleton :rows="0" animated>
          <template #template>
            <el-skeleton-item variant="rect" style="width: 100%; height: 96px; border-radius: 8px" />
          </template>
        </el-skeleton>
        <el-skeleton :rows="0" animated>
          <template #template>
            <el-skeleton-item variant="rect" style="width: 100%; height: 96px; border-radius: 8px" />
          </template>
        </el-skeleton>
        <el-skeleton :rows="0" animated>
          <template #template>
            <el-skeleton-item variant="rect" style="width: 100%; height: 96px; border-radius: 8px" />
          </template>
        </el-skeleton>
      </div>
      <el-skeleton :rows="8" animated style="margin-top: 24px" />
    </div>

    <div v-else ref="reportRef" v-loading="loading" class="profile-body">
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
        <NotesList
          :notes="notes"
          :limit="5"
          @view-all="goNotes"
          @edit="handleEditNote"
          @delete="handleDeleteNote"
        />
      </section>

      <!-- ⑧ 线下记录预览 -->
      <section class="list-row">
        <OfflineRecordsList
          :records="offlineRecords"
          :limit="5"
          @view-all="goOffline"
          @edit="handleEditRecord"
          @delete="handleDeleteRecord"
        />
      </section>

      <!-- ⑨ 试卷预览（PR-E E7） -->
      <section class="list-row">
        <UploadedPapersList
          :papers="uploadedPapers"
          :show-header="true"
          :show-delete="false"
          :limit="5"
          @view-all="goPapers"
          @delete="handleDeletePaper"
        />
      </section>

      <!-- ⑩ AI 报告（PR-D：前端规则引擎 + AIChat 深度咨询 + 后端 LLM 契约） -->
      <section class="ai-report-section-wrap">
        <h3 class="section-title">
          <MagicStick class="h-4 w-4" />
          {{ t('edu.profile.aiReportTitle') }}
        </h3>
        <AiReportSection />
      </section>
    </div>

    <!-- PR-B B5：预览区块 Dialog（放在 .profile-body 外，避免被 PDF 导出） -->
    <NoteDialog
      v-model:visible="noteDialogVisible"
      :note="editingNote"
      @success="refresh('notes')"
    />
    <OfflineRecordDialog
      v-model:visible="offlineDialogVisible"
      :record="editingRecord"
      @success="refresh('offline')"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Alert } from '@/components/ui/alert'
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
import UploadedPapersList from '@/components/edu/UploadedPapersList.vue'
import NoteDialog from '@/components/edu/NoteDialog.vue'
import OfflineRecordDialog from '@/components/edu/OfflineRecordDialog.vue'
import AiReportSection from '@/components/edu/AiReportSection.vue'
import { notesApi } from '@/api/edu/notes'
import { uploadedPapersApi } from '@/api/edu/uploaded-papers'
import type { UploadedPaper } from '@/api/edu/uploaded-papers'
import { offlineRecordsApi } from '@/api/edu/offline-records'
import type { LearningNote } from '@/api/edu/notes'
import type { OfflineRecord } from '@/api/edu/offline-records'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Avatar } from '@/components/ui/avatar'

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
  uploadedPapers,
  notes,
  offlineRecords,
  dailyStats,
  loadAll,
  refresh,
  totalLearnHours,
  averageExamScore,
  completionRate,
  examPassRate,
  weakSubjects,
} = useStudentProfile()

const reportRef = ref<HTMLElement | null>(null)
const exporting = ref(false)

// PR-B B5：预览区块 Dialog 集成（edit/delete 支持，不增加"新建"按钮）
const noteDialogVisible = ref(false)
const editingNote = ref<LearningNote | null>(null)
const offlineDialogVisible = ref(false)
const editingRecord = ref<OfflineRecord | null>(null)

function handleEditNote(note: LearningNote) {
  editingNote.value = note
  noteDialogVisible.value = true
}

async function handleDeleteNote(note: LearningNote) {
  try {
    await ElMessageBox.confirm(t('edu.profile.deleteConfirm'), t('edu.common.cancel'), {
      type: 'warning',
      confirmButtonText: t('edu.common.submit'),
      cancelButtonText: t('edu.common.cancel'),
    })
    await notesApi.delete(note.id)
    ElMessage.success(t('edu.profile.deleteSuccess'))
    await refresh('notes')
  } catch {
    // 用户取消删除，无需处理
  }
}

function handleEditRecord(record: OfflineRecord) {
  editingRecord.value = record
  offlineDialogVisible.value = true
}

async function handleDeleteRecord(record: OfflineRecord) {
  try {
    await ElMessageBox.confirm(t('edu.profile.deleteConfirm'), t('edu.common.cancel'), {
      type: 'warning',
      confirmButtonText: t('edu.common.submit'),
      cancelButtonText: t('edu.common.cancel'),
    })
    await offlineRecordsApi.delete(record.id)
    ElMessage.success(t('edu.profile.deleteSuccess'))
    await refresh('offline')
  } catch {
    // 用户取消删除，无需处理
  }
}

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

// PR-E E7：试卷预览跳转 + 删除
function goPapers() {
  router.push('/edu/member/papers')
}

async function handleDeletePaper(paper: UploadedPaper) {
  try {
    await ElMessageBox.confirm(t('edu.profile.deleteConfirm'), t('edu.profile.paperDelete'), {
      type: 'warning',
      confirmButtonText: t('edu.common.submit'),
      cancelButtonText: t('edu.common.cancel'),
    })
    await uploadedPapersApi.delete(paper.id)
    ElMessage.success(t('edu.profile.deleteSuccess'))
    await refresh('papers')
  } catch {
    // 用户取消删除，无需处理
  }
}

async function handleExportPdf() {
  if (!reportRef.value || exporting.value) return
  exporting.value = true
  try {
    await exportElementToPDF(reportRef.value, {
      filename: `${t('edu.profile.profileExportFilename')}_${new Date().toISOString().slice(0, 10)}.pdf`,
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

/* PR-F F6：骨架屏样式 */
.profile-skeleton {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  background: var(--el-bg-color);
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
}

.skeleton-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
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

.ai-report-section-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section-title .el-icon {
  color: var(--el-color-primary);
}

@media (width <= 1024px) {
  .chart-row {
    grid-template-columns: 1fr;
  }
}

@media (width <= 640px) {
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
