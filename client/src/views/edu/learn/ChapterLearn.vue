<template>
  <!--
    ChapterLearn.vue — 章节学习页
    左侧小节列表 + 中间视频播放区 + 上一节/下一节按钮 + 进度上报
    路由: EduLearnChapter (/edu/learn/chapter/:chapterId)
  -->
  <div class="chapter-learn">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.learn.chapterTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.learn.chapterSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Back" @click="goBack">
          {{ t('edu.learn.viewDetail') }}
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

    <div v-loading="loading" class="learn-body">
      <div class="learn-layout">
        <!-- 左侧小节列表 -->
        <aside class="section-aside">
          <div class="aside-header">
            <span class="aside-title">{{ t('edu.learn.chapters') }}</span>
            <span class="aside-count">{{ sections.length }}</span>
          </div>
          <div class="aside-list">
            <div
              v-for="(section, idx) in sections"
              :key="section.id"
              class="aside-item"
              :class="{ active: currentSectionId === section.id }"
              @click="selectSection(section)"
            >
              <span class="aside-index">{{ Number(idx) + 1 }}</span>
              <div class="aside-info">
                <span class="aside-name">{{ section.title }}</span>
                <span class="aside-duration">{{ formatDuration(section.duration_seconds) }}</span>
              </div>
              <el-icon v-if="completedSet.has(section.id)" class="aside-done">
                <CircleCheck />
              </el-icon>
            </div>
          </div>
        </aside>

        <!-- 中间视频播放区 -->
        <main class="learn-main">
          <div v-if="currentSection" class="player-wrap">
            <video
              v-if="currentSection.video_url"
              ref="videoEl"
              class="video-player"
              :src="currentSection.video_url"
              :poster="course?.cover"
              controls
              @timeupdate="onTimeUpdate"
              @ended="onVideoEnded"
            />
            <div v-else class="player-empty">
              <el-icon :size="56"><VideoPlay /></el-icon>
              <p>{{ t('edu.learn.noChapters') }}</p>
            </div>
          </div>

          <!-- 小节信息 + 进度 -->
          <div v-if="currentSection" class="section-meta">
            <div class="meta-left">
              <h2 class="section-title">{{ currentSection.title }}</h2>
              <p v-if="currentSection.resource_url" class="section-resource">
                <el-link :href="currentSection.resource_url" target="_blank" type="primary">
                  {{ t('edu.learn.viewDetail') }}
                </el-link>
              </p>
            </div>
            <div class="meta-right">
              <span class="meta-progress-label">{{ t('edu.learn.progress') }}</span>
              <el-progress
                type="circle"
                :width="56"
                :stroke-width="6"
                :percentage="currentPercent"
              />
            </div>
          </div>

          <!-- 上一节 / 下一节 -->
          <div class="nav-buttons">
            <el-button
              :icon="ArrowLeft"
              :disabled="!hasPrev"
              @click="goPrev"
            >
              {{ t('edu.learn.prevSection') }}
            </el-button>
            <el-button
              type="primary"
              :disabled="!hasNext"
              @click="goNext"
            >
              {{ t('edu.learn.nextSection') }}
              <el-icon class="el-icon--right"><ArrowRight /></el-icon>
            </el-button>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Back, ArrowLeft, ArrowRight, VideoPlay, CircleCheck,
} from '@element-plus/icons-vue'
import {
  learnApi,
  type EduCourse,
  type EduCourseSection,
} from '@/api/edu'

const props = defineProps<{ chapterId?: string }>()

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const error = ref(false)

const sections = ref<EduCourseSection[]>([])
const course = ref<EduCourse | null>(null)
const currentSectionId = ref<number | null>(null)
const completedSet = ref<Set<number>>(new Set())
const currentPercent = ref(0)

const videoEl = ref<HTMLVideoElement | null>(null)

const currentIndex = computed(() =>
  sections.value.findIndex((s) => s.id === currentSectionId.value)
)

const currentSection = computed(() =>
  currentSectionId.value
    ? sections.value.find((s) => s.id === currentSectionId.value) ?? null
    : null
)

const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < sections.value.length - 1)

async function loadSections() {
  if (!props.chapterId) return
  loading.value = true
  error.value = false
  try {
    const chId = Number(props.chapterId)
    const res = await learnApi.listSections(chId)
    sections.value = res.data?.data ?? []
    if (sections.value.length) {
      // 默认选中第一节
      selectSection(sections.value[0])
      // 加载课程信息（用于视频 poster）
      try {
        const firstSection = sections.value[0]
        if (firstSection.course_id) {
          const cRes = await learnApi.getCourse(firstSection.course_id)
          course.value = cRes.data?.data ?? null
        }
      } catch {
        // 课程信息加载失败不影响学习
      }
    }
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function selectSection(section: EduCourseSection) {
  currentSectionId.value = section.id
  currentPercent.value = 0
  // 切换小节后重置视频
  nextTick(() => {
    if (videoEl.value) {
      videoEl.value.currentTime = 0
    }
  })
}

function onTimeUpdate() {
  if (!videoEl.value || !currentSection.value) return
  const duration = videoEl.value.duration || currentSection.value.duration_seconds
  if (!duration) return
  const percent = Math.min(100, Math.round((videoEl.value.currentTime / duration) * 100))
  currentPercent.value = percent
  // 上报进度（节流：每 10% 上报一次）
  if (percent > 0 && percent % 10 === 0) {
    reportProgress(percent)
  }
}

async function onVideoEnded() {
  if (!currentSection.value) return
  completedSet.value.add(currentSection.value.id)
  currentPercent.value = 100
  await reportProgress(100)
}

// 进度上报（节流，避免重复提交相同进度）
let lastReportedPercent = 0
async function reportProgress(percent: number) {
  if (!currentSection.value) return
  if (percent === lastReportedPercent) return
  lastReportedPercent = percent
  try {
    await learnApi.updateProgress({
      course_id: currentSection.value.course_id,
      section_id: currentSection.value.id,
      progress_seconds: Math.round((percent / 100) * currentSection.value.duration_seconds),
      total_seconds: currentSection.value.duration_seconds,
      last_position: videoEl.value?.currentTime ?? 0,
    })
  } catch {
    // 进度上报失败不影响学习体验
  }
}

function goPrev() {
  if (!hasPrev.value) return
  selectSection(sections.value[currentIndex.value - 1])
}

function goNext() {
  if (!hasNext.value) return
  selectSection(sections.value[currentIndex.value + 1])
}

function formatDuration(seconds: number) {
  const m = Math.ceil(seconds / 60)
  return `${m} min`
}

function goBack() {
  router.back()
}

onMounted(loadSections)
</script>

<style scoped lang="scss">
.chapter-learn {
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

.learn-body {
  width: 100%;
  min-height: 400px;
}

.learn-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
}

/* 左侧小节列表 */
.section-aside {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.aside-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
}

.aside-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.aside-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.aside-list {
  display: flex;
  flex-direction: column;
  max-height: 520px;
  overflow-y: auto;
}

.aside-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-lighter);
  transition: background 0.2s ease;
}

.aside-item:hover {
  background: var(--el-fill-color-light);
}

.aside-item.active {
  background: var(--el-color-primary-light-9);
  border-left: 3px solid var(--el-color-primary);
  padding-left: 13px;
}

.aside-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
  border-radius: 8px;
  flex-shrink: 0;
}

.aside-item.active .aside-index {
  /* stylelint-disable color-no-hex -- 主色激活项白字 */
  color: #fff;
  /* stylelint-enable color-no-hex */
  background: var(--el-color-primary);
}

.aside-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aside-name {
  font-size: 13px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aside-duration {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.aside-done {
  color: var(--el-color-success);
}

/* 中间视频播放区 */
.learn-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.player-wrap {
  width: 100%;
  /* stylelint-disable color-no-hex -- 视频播放器底色必须黑 */
  background: #000;
  /* stylelint-enable color-no-hex */
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.video-player {
  width: 100%;
  height: 100%;
  display: block;
}

.player-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-secondary);
}

.player-empty p {
  margin: 0;
  font-size: 13px;
}

.section-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.meta-left {
  flex: 1;
}

.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.section-resource {
  margin: 8px 0 0;
  font-size: 13px;
}

.meta-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.meta-progress-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.nav-buttons {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

@media (width <= 768px) {
  .learn-layout {
    grid-template-columns: 1fr;
  }
}
</style>
