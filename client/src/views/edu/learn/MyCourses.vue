<template>
  <!--
    MyCourses.vue — 我的课程列表页
    展示已报名的课程卡片网格，支持搜索、免费/付费筛选、排序、分页
    路由: EduLearn (/edu/learn)
  -->
  <div class="learn-courses">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.learn.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.learn.subtitle') }}</p>
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

    <!-- 筛选条 -->
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        class="filter-search"
        :placeholder="t('edu.learn.searchPlaceholder')"
        :prefix-icon="Search"
        clearable
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-radio-group v-model="filterFree" @change="handleSearch">
        <el-radio-button :value="''">{{ t('edu.learn.filterAll') }}</el-radio-button>
        <el-radio-button :value="'free'">{{ t('edu.learn.filterFree') }}</el-radio-button>
        <el-radio-button :value="'paid'">{{ t('edu.learn.filterPaid') }}</el-radio-button>
      </el-radio-group>
      <el-select v-model="orderBy" class="filter-sort" @change="handleSearch">
        <el-option :value="'latest'" :label="t('edu.learn.sortLatest')" />
        <el-option :value="'hot'" :label="t('edu.learn.sortHot')" />
        <el-option :value="'rating'" :label="t('edu.learn.sortRating')" />
      </el-select>
    </div>

    <!-- 课程列表 -->
    <div v-loading="loading" class="courses-body">
      <el-empty
        v-if="!loading && !courses.length"
        :description="t('edu.learn.empty')"
      />
      <div v-else class="course-grid">
        <el-card
          v-for="course in courses"
          :key="course.id"
          class="course-card"
          shadow="hover"
          @click="goDetail(course.id)"
        >
          <div class="course-cover">
            <el-image v-if="course.cover" :src="course.cover" fit="cover" class="cover-img" />
            <div v-else class="cover-placeholder">
              <el-icon :size="32"><Reading /></el-icon>
            </div>
            <el-tag v-if="course.is_free" class="cover-tag" type="success" effect="dark">
              {{ t('edu.learn.free') }}
            </el-tag>
          </div>
          <div class="course-info">
            <h3 class="course-title" :title="course.title">{{ course.title }}</h3>
            <p v-if="course.subtitle" class="course-subtitle">{{ course.subtitle }}</p>
            <div class="course-meta">
              <span>{{ t('edu.learn.lessonCount', { n: course.lesson_count }) }}</span>
              <span>{{ t('edu.learn.studentCount', { n: course.student_count }) }}</span>
            </div>
            <!-- 学习进度条 -->
            <el-progress
              v-if="progressMap[course.id] !== undefined"
              :percentage="progressMap[course.id]"
              :stroke-width="6"
              class="course-progress"
            />
            <div class="course-footer">
              <span class="course-price">
                <template v-if="course.is_free">{{ t('edu.learn.free') }}</template>
                <template v-else>¥{{ course.price }}</template>
              </span>
              <el-button type="primary" size="small" link>
                {{ progressMap[course.id] > 0 ? t('edu.learn.continue') : t('edu.learn.startLearn') }}
              </el-button>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > 0" class="pagination-wrap">
      <el-pagination
        v-model:current-page="page.page"
        v-model:page-size="page.size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="loadCourses"
        @current-change="loadCourses"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Refresh, Search, Reading } from '@element-plus/icons-vue'
import { learnApi, type EduCourse } from '@/api/edu'

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const error = ref(false)
const courses = ref<EduCourse[]>([])
const total = ref(0)
const page = reactive({ page: 1, size: 10 })

const keyword = ref('')
const filterFree = ref<'' | 'free' | 'paid'>('')
const orderBy = ref<'latest' | 'hot' | 'rating'>('latest')

// 课程进度映射 courseId -> percent
const progressMap = ref<Record<number, number>>({})

async function loadCourses() {
  loading.value = true
  error.value = false
  try {
    const params: Parameters<typeof learnApi.listCourses>[0] = {
      page: page.page,
      size: page.size,
      order_by: orderBy.value,
      is_published: true,
    }
    if (keyword.value) params.keyword = keyword.value
    if (filterFree.value === 'free') params.is_free = true
    if (filterFree.value === 'paid') params.is_free = false

    const res = await learnApi.listCourses(params)
    courses.value = res.data?.data?.items ?? []
    total.value = res.data?.data?.total ?? 0

    // 并行加载每个课程的进度
    await Promise.all(
      courses.value.map(async (c) => {
        try {
          const cmp = await learnApi.getCompletion(c.id)
          progressMap.value[c.id] = cmp.data?.data?.completion_percent ?? 0
        } catch {
          // 进度加载失败不阻断列表展示
        }
      })
    )
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.page = 1
  loadCourses()
}

function reload() {
  loadCourses()
}

function goDetail(courseId: number) {
  router.push({ name: 'EduLearnDetail', params: { courseId: String(courseId) } })
}

onMounted(loadCourses)
</script>

<style scoped lang="scss">
.learn-courses {
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

.header-actions {
  display: flex;
  gap: 8px;
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

/* 筛选条 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.filter-search {
  width: 240px;
}

.filter-sort {
  width: 140px;
}

/* 课程卡片网格 */
.courses-body {
  width: 100%;
  min-height: 200px;
}

.course-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.course-card {
  cursor: pointer;
  border-radius: 8px;
  transition: border-color 0.2s ease;
}

.course-card:hover {
  border-color: var(--border-unified-color-hover);
}

:deep(.course-card .el-card__body) {
  padding: 0;
}

.course-cover {
  position: relative;
  width: 100%;
  height: 140px;
  background: var(--el-fill-color-light);
  overflow: hidden;
}

.cover-img {
  width: 100%;
  height: 100%;
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-secondary);
}

.cover-tag {
  position: absolute;
  top: 8px;
  left: 8px;
  border-radius: 8px;
}

.course-info {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.course-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.course-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.course-progress {
  margin-top: 4px;
}

.course-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.course-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-danger);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
}
</style>
