<template>
  <!--
    CourseDetail.vue — 课程详情页
    展示课程封面、信息、章节列表（el-collapse + sections）
    报名按钮 / 已报名显示继续学习
    路由: EduLearnDetail (/edu/learn/detail/:courseId)
  -->
  <div class="course-detail">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.learn.detailTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.learn.detailSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Back" @click="goBack">
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

    <div v-loading="loading" class="detail-body">
      <!-- 课程信息卡 -->
      <el-card v-if="course" class="info-card" shadow="never">
        <div class="info-row">
          <div class="info-cover">
            <el-image v-if="course.cover" :src="course.cover" fit="cover" class="cover-img" />
            <div v-else class="cover-placeholder">
              <el-icon :size="48"><Reading /></el-icon>
            </div>
          </div>
          <div class="info-main">
            <h2 class="info-title">{{ course.title }}</h2>
            <p v-if="course.subtitle" class="info-subtitle">{{ course.subtitle }}</p>
            <div class="info-meta">
              <span class="meta-item">
                <el-icon><User /></el-icon>
                {{ t('edu.learn.teacher') }}: #{{ course.teacher_id }}
              </span>
              <span class="meta-item">
                <el-icon><Clock /></el-icon>
                {{ t('edu.learn.duration') }}: {{ Math.round(course.duration_minutes / 60) }}h
              </span>
              <span class="meta-item">
                <el-icon><Notebook /></el-icon>
                {{ t('edu.learn.lessonCount', { n: course.lesson_count }) }}
              </span>
            </div>
            <div class="info-price-row">
              <span class="info-price">
                <template v-if="course.is_free">{{ t('edu.learn.free') }}</template>
                <template v-else>¥{{ course.price }}</template>
              </span>
              <span v-if="!course.is_free && course.original_price" class="info-original">
                {{ t('edu.learn.originalPrice') }}: ¥{{ course.original_price }}
              </span>
            </div>
            <p v-if="course.description" class="info-desc">{{ course.description }}</p>

            <!-- 学习进度（已报名） -->
            <div v-if="completion" class="info-progress">
              <span class="progress-label">{{ t('edu.learn.progress') }}</span>
              <el-progress
                :percentage="completion.completion_percent"
                :stroke-width="8"
                class="progress-bar"
              />
              <span class="progress-text">
                {{ completion.completed_sections }} / {{ completion.total_sections }}
              </span>
            </div>

            <div class="info-actions">
              <el-button v-if="!isEnrolled" type="primary" :loading="enrolling" @click="handleEnroll">
                {{ t('edu.learn.enroll') }}
              </el-button>
              <template v-else>
                <el-button type="primary" @click="goLearnFirstSection">
                  {{ t('edu.learn.continue') }}
                </el-button>
                <el-button :icon="Medal" @click="goCertificates">
                  {{ t('edu.learn.myCerts') }}
                </el-button>
              </template>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 章节列表 -->
      <el-card class="chapters-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span class="card-title">{{ t('edu.learn.chapters') }}</span>
          </div>
        </template>
        <el-empty v-if="!chapters.length" :description="t('edu.learn.noChapters')" />
        <el-collapse v-else v-model="activeChapters">
          <el-collapse-item
            v-for="chapter in chapters"
            :key="chapter.id"
            :name="chapter.id"
          >
            <template #title>
              <div class="chapter-title-row">
                <span class="chapter-order">{{ chapter.sort_order }}</span>
                <span class="chapter-title">{{ chapter.title }}</span>
                <span v-if="chapter.description" class="chapter-desc">{{ chapter.description }}</span>
              </div>
            </template>
            <div v-loading="sectionLoading[chapter.id]" class="section-list">
              <el-empty
                v-if="!sectionsMap[chapter.id]?.length"
                :description="t('edu.learn.noChapters')"
                :image-size="60"
              />
              <div
                v-for="section in sectionsMap[chapter.id]"
                :key="section.id"
                class="section-item"
                @click="goLearnSection(chapter.id, section.id)"
              >
                <el-icon class="section-icon"><VideoPlay /></el-icon>
                <div class="section-info">
                  <span class="section-title">{{ section.title }}</span>
                  <span class="section-duration">
                    {{ Math.ceil(section.duration_seconds / 60) }} min
                  </span>
                </div>
                <el-tag v-if="section.is_free_preview" size="small" type="success">
                  {{ t('edu.learn.free') }}
                </el-tag>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  Back, Reading, User, Clock, Notebook, VideoPlay, Medal,
} from '@element-plus/icons-vue'
import {
  learnApi,
  type EduCourse,
  type EduCourseChapter,
  type EduCourseSection,
} from '@/api/edu'

const props = defineProps<{ courseId?: string }>()

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const error = ref(false)
const enrolling = ref(false)

const course = ref<EduCourse | null>(null)
const chapters = ref<EduCourseChapter[]>([])
const sectionsMap = reactive<Record<number, EduCourseSection[]>>({})
const sectionLoading = reactive<Record<number, boolean>>({})
const activeChapters = ref<number[]>([])

const completion = ref<{
  total_sections: number
  completed_sections: number
  completion_percent: number
} | null>(null)

// 是否已报名：有完成度数据即视为已报名
const isEnrolled = computed(() => completion.value !== null)

async function loadDetail() {
  if (!props.courseId) return
  loading.value = true
  error.value = false
  try {
    const cid = Number(props.courseId)
    const [courseRes, chaptersRes] = await Promise.all([
      learnApi.getCourse(cid),
      learnApi.listChapters(cid),
    ])
    course.value = courseRes.data?.data ?? null
    chapters.value = chaptersRes.data?.data ?? []
    // 默认展开第一个章节
    if (chapters.value.length) {
      activeChapters.value = [chapters.value[0].id]
      // 自动加载第一个章节的小节
      loadSections(chapters.value[0].id)
    }
    // 加载报名状态/进度（容错：未报名接口可能报错）
    try {
      const cmp = await learnApi.getCompletion(cid)
      completion.value = cmp.data?.data ?? null
    } catch {
      completion.value = null
    }
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function loadSections(chapterId: number) {
  if (sectionsMap[chapterId]) return
  sectionLoading[chapterId] = true
  try {
    const res = await learnApi.listSections(chapterId)
    sectionsMap[chapterId] = res.data?.data ?? []
  } catch {
    sectionsMap[chapterId] = []
  } finally {
    sectionLoading[chapterId] = false
  }
}

async function handleEnroll() {
  if (!props.courseId) return
  enrolling.value = true
  try {
    await learnApi.enrollCourse(Number(props.courseId))
    ElMessage.success(t('edu.learn.enrollSuccess'))
    // 重新拉取进度
    const cmp = await learnApi.getCompletion(Number(props.courseId))
    completion.value = cmp.data?.data ?? null
  } catch {
    // 报名失败由 axios 拦截器统一提示
  } finally {
    enrolling.value = false
  }
}

function goLearnFirstSection() {
  // 找到第一个有 section 的章节，跳转到章节学习页
  const firstChapter = chapters.value[0]
  if (firstChapter) {
    router.push({
      name: 'EduLearnChapter',
      params: { chapterId: String(firstChapter.id) },
    })
  }
}

function goLearnSection(chapterId: number, _sectionId: number) {
  router.push({
    name: 'EduLearnChapter',
    params: { chapterId: String(chapterId) },
  })
}

function goCertificates() {
  router.push({ name: 'EduLearnCertificate' })
}

function goBack() {
  router.back()
}

onMounted(loadDetail)
</script>

<style scoped lang="scss">
.course-detail {
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

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  min-height: 200px;
}

.info-card,
.chapters-card {
  border-radius: 8px;
}

.info-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.info-cover {
  flex: 0 0 240px;
  height: 160px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-fill-color-light);
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

.info-main {
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.info-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.info-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.info-price-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 4px;
}

.info-price {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-color-danger);
}

.info-original {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-decoration: line-through;
}

.info-desc {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.info-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.progress-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.progress-bar {
  flex: 1;
  max-width: 320px;
}

.progress-text {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.info-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
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

.chapter-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.chapter-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  font-size: 12px;
  border-radius: 8px;
}

.chapter-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.chapter-desc {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.section-item:hover {
  background: var(--el-fill-color-light);
}

.section-icon {
  color: var(--el-text-color-secondary);
}

.section-info {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.section-duration {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
