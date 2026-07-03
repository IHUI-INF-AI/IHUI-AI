<template>
  <!--
    MyExams.vue — 我的考试列表页
    上方：可参加的试卷卡片网格（开始考试）；下方：考试记录 el-table（查看记录）
    路由: EduExam (/edu/exam)
  -->
  <div class="my-exams">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.exam.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.exam.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="reload">
          {{ t('edu.common.retry') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.common.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- 可参加的试卷 -->
    <section class="section-block">
      <h2 class="section-title">{{ t('edu.exam.filterPublished') }}</h2>
      <div v-loading="loading" class="papers-body">
        <el-empty
          v-if="!loading && !papers.length"
          :description="t('edu.exam.empty')"
        />
        <div v-else class="paper-grid">
          <el-card
            v-for="paper in papers"
            :key="paper.id"
            class="paper-card"
            shadow="hover"
          >
            <div class="paper-info">
              <h3 class="paper-title" :title="paper.title">{{ paper.title }}</h3>
              <p v-if="paper.description" class="paper-desc">{{ paper.description }}</p>
              <div class="paper-meta">
                <span>{{ t('edu.exam.duration') }}: {{ paper.duration_minutes }}min</span>
                <span>{{ t('edu.exam.totalScore') }}: {{ paper.total_score }}</span>
                <span>{{ t('edu.exam.passScore') }}: {{ paper.pass_score }}</span>
                <span>{{ t('edu.exam.questionCount') }}: {{ paper.question_count }}</span>
              </div>
            </div>
            <div class="paper-actions">
              <el-button type="primary" size="small" @click="startExam(paper.id)">
                {{ t('edu.exam.startExam') }}
              </el-button>
            </div>
          </el-card>
        </div>
      </div>
    </section>

    <!-- 考试记录 -->
    <section class="section-block">
      <div class="section-head">
        <h2 class="section-title">{{ t('edu.exam.recordTitle') }}</h2>
        <el-radio-group v-model="statusFilter" size="small" @change="handleStatusChange">
          <el-radio-button value="">{{ t('edu.exam.filterAll') }}</el-radio-button>
          <el-radio-button value="in_progress">{{ t('edu.exam.statusProgress') }}</el-radio-button>
          <el-radio-button value="submitted">{{ t('edu.exam.statusSubmitted') }}</el-radio-button>
          <el-radio-button value="graded">{{ t('edu.exam.statusGraded') }}</el-radio-button>
        </el-radio-group>
      </div>
      <div v-loading="recordLoading" class="records-body">
        <el-empty
          v-if="!recordLoading && !records.length"
          :description="t('edu.exam.empty')"
        />
        <el-table
          v-else
          :data="records"
          stripe
          class="records-table"
        >
          <el-table-column type="index" width="60" label="#" />
          <el-table-column prop="paper_id" :label="t('edu.profile.paperName')" min-width="160">
            <template #default="{ row }">
              {{ paperTitleMap[row.paper_id] ?? `#${row.paper_id}` }}
            </template>
          </el-table-column>
          <el-table-column prop="start_at" :label="t('edu.exam.startAt')" min-width="160" />
          <el-table-column prop="submit_at" :label="t('edu.exam.submitAt')" min-width="160">
            <template #default="{ row }">
              {{ row.submit_at || '—' }}
            </template>
          </el-table-column>
          <el-table-column :label="t('edu.profile.score')" width="100" align="center">
            <template #default="{ row }">
              <span v-if="row.score !== undefined && row.score !== null" class="score-cell">
                {{ row.score }}
              </span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('edu.profile.status')" width="120" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'graded' && row.is_passed" type="success">
                {{ t('edu.exam.passed') }}
              </el-tag>
              <el-tag v-else-if="row.status === 'graded' && !row.is_passed" type="danger">
                {{ t('edu.exam.failed') }}
              </el-tag>
              <el-tag v-else-if="row.status === 'submitted'" type="warning">
                {{ t('edu.exam.pending') }}
              </el-tag>
              <el-tag v-else type="info">
                {{ t('edu.exam.statusProgress') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('edu.exam.viewDetail')" width="140" align="center" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'in_progress'"
                type="primary"
                size="small"
                @click="continueExam(row.paper_id)"
              >
                {{ t('edu.exam.continueExam') }}
              </el-button>
              <el-button
                v-else
                size="small"
                @click="viewRecord(row.id)"
              >
                {{ t('edu.exam.viewDetail') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div v-if="recordTotal > 0" class="pagination-wrap">
          <el-pagination
            v-model:current-page="recordPage.page"
            v-model:page-size="recordPage.size"
            :total="recordTotal"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="loadRecords"
            @current-change="loadRecords"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Refresh } from '@element-plus/icons-vue'
import {
  examApi,
  type EduPaper,
  type EduExamRecord,
} from '@/api/edu'

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const recordLoading = ref(false)
const error = ref(false)

const papers = ref<EduPaper[]>([])
const records = ref<EduExamRecord[]>([])
const paperTitleMap = reactive<Record<number, string>>({})

const recordTotal = ref(0)
const recordPage = reactive({ page: 1, size: 10 })
const statusFilter = ref('')

async function loadPapers() {
  loading.value = true
  try {
    const res = await examApi.listPapers({ is_published: true, page: 1, size: 50 })
    papers.value = res.data?.data?.items ?? []
    // 缓存 paper title 给记录表格用
    papers.value.forEach((p) => {
      paperTitleMap[p.id] = p.title
    })
  } catch {
    // 试卷加载失败不阻断考试记录展示
  } finally {
    loading.value = false
  }
}

async function loadRecords() {
  recordLoading.value = true
  error.value = false
  try {
    const params: Parameters<typeof examApi.myExams>[0] = {
      page: recordPage.page,
      size: recordPage.size,
    }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await examApi.myExams(params)
    records.value = res.data?.data?.items ?? []
    recordTotal.value = res.data?.data?.total ?? 0
  } catch {
    error.value = true
  } finally {
    recordLoading.value = false
  }
}

function handleStatusChange() {
  recordPage.page = 1
  loadRecords()
}

function startExam(paperId: number) {
  router.push({ name: 'EduExamPaper', params: { paperId: String(paperId) } })
}

function continueExam(paperId: number) {
  router.push({ name: 'EduExamPaper', params: { paperId: String(paperId) } })
}

function viewRecord(recordId: number) {
  router.push({ name: 'EduExamRecord', params: { recordId: String(recordId) } })
}

function reload() {
  loadPapers()
  loadRecords()
}

onMounted(() => {
  loadPapers()
  loadRecords()
})
</script>

<style scoped lang="scss">
.my-exams {
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

.section-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.papers-body,
.records-body {
  width: 100%;
  min-height: 120px;
}

.paper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.paper-card {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  transition: border-color 0.2s ease;
}

.paper-card:hover {
  border-color: var(--border-unified-color-hover);
}

.paper-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.paper-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.paper-desc {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.paper-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.paper-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.records-table {
  border-radius: 8px;
  overflow: hidden;
}

.score-cell {
  font-weight: 700;
  color: var(--el-color-primary);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
