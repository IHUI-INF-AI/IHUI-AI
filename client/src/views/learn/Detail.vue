<template>
  <div class="learn-detail-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="breadcrumbItems" />

    <div v-loading="loading" class="detail-content">
      <div v-if="!lesson.id" class="empty">
        <el-empty :description="t('learnDetail.notExist')" />
      </div>
      <template v-else>
        <div class="hero">
          <div class="cover">
            <img :src="lesson.cover || lesson.image" :alt="lesson.name" loading="lazy" />
          </div>
          <div class="info">
            <h1 class="title">{{ lesson.name || lesson.title }}</h1>
            <p v-if="lesson.description" class="desc">{{ lesson.description }}</p>
            <div class="meta">
              <span class="teacher">{{ t('learnDetail.teacher') }}:{{ lesson.teacherName || lesson.lecturer || '—' }}</span>
              <span class="learn-num">{{ lesson.learnNum || 0 }} {{ t('learnDetail.learnCount') }}</span>
            </div>
            <div class="price-row">
              <span class="price">{{ formatPrice(lesson.price) }}</span>
              <span v-if="lesson.originalPrice" class="original-price">
                ¥{{ lesson.originalPrice.toFixed(2) }}
              </span>
            </div>
            <div class="actions">
              <el-button v-if="!isSigned" type="primary" size="large" @click="handleSignUp">
                {{ lesson.price > 0 ? t('learnDetail.buyNow') : t('learnDetail.learnNow') }}
              </el-button>
              <el-button v-else type="primary" size="large" @click="handleStartLearn">
                {{ t('learnDetail.continueLearn') }}
              </el-button>
              <el-button size="large" @click="toggleFavorite">
                {{ isFavorite ? t('learnDetail.favorited') : t('learnDetail.favorite') }}
              </el-button>
            </div>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">{{ t('learnDetail.chapters') }}</h3>
          <el-empty v-if="!chapters.length" :description="t('learnDetail.noChapters')" />
          <div v-else class="chapters">
            <div v-for="ch in chapters" :key="ch.id" class="chapter">
              <div class="chapter-name">{{ ch.name }}</div>
              <div class="chapter-videos">
                <div
                  v-for="v in ch.videoList || []"
                  :key="v.id"
                  class="video-item"
                  @click="playVideo(v)"
                >
                  <el-icon><VideoPlay /></el-icon>
                  <span class="video-title">{{ v.name }}</span>
                  <span class="video-duration">{{ formatDuration(v.duration) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">{{ t('learnDetail.reviews') }}</h3>
          <Rate :lesson-id="id" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { VideoPlay } from '@element-plus/icons-vue'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import Rate from './Rate.vue'
import { learnApi } from '@/api/learn'
import type { Lesson } from '@/api/learn'
import { formatMoney } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const id = String(route.params.id || '')

const loading = ref(false)
const lesson = ref<Partial<Lesson>>({})
const chapters = ref<unknown[]>([])
const isFavorite = ref(false)
const isSigned = computed(() => {
  const s = lesson.value?.signUp?.status
  return s === 'signing_up' || s === 'completed'
})

const breadcrumbItems = computed(() => [
  { title: '课程', path: '/learn' },
  { title: lesson.value.name || '详情' },
])

function formatPrice(p: number | undefined): string {
  const v = p || 0
  return v === 0 ? '免费' : `¥${formatMoney(v)}`
}

function formatDuration(s: number | undefined): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

async function loadLesson() {
  loading.value = true
  try {
    const res = await learnApi.detail(id)
    lesson.value = res.data?.data || {}
  } finally {
    loading.value = false
  }
}

async function loadChapters() {
  const res = await learnApi.chapterList(id)
  chapters.value = res.data?.data || []
}

async function handleSignUp() {
  if ((lesson.value.price ?? 0) > 0) {
    router.push({ path: '/learn/buyconfirm', query: { id } })
  } else {
    try {
      await learnApi.signUp(id)
      await loadLesson()
    } catch {
      ElMessage.error(t('common.errors.signUpFailed'))
    }
  }
}

function handleStartLearn() {
  router.push({ path: `/learn/detail/${id}/play`, query: { lessonId: id } })
}

function playVideo(v: Record<string, unknown>) {
  router.push({ path: `/learn/detail/${id}/play`, query: { lessonId: id, videoId: String(v.id) } })
}

async function toggleFavorite() {
  const res = await learnApi.toggleFavorite(id)
  isFavorite.value = res.data?.data?.isFavorite || false
}

onMounted(() => {
  loadLesson()
  loadChapters()
})
</script>

<style lang="scss" scoped>
:where(.learn-detail-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.detail-content) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 24px 12px;
}

:where(.hero) {
  display: flex;
  gap: 32px;
  background: var(--el-bg-color);
  padding: 24px;
  border-radius: var(--global-border-radius);
  margin-bottom: 24px;

  @media (width <= 768px) {
    flex-direction: column;
  }
}

:where(.cover) {
  width: 360px;
  flex-shrink: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--global-border-radius);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (width <= 768px) {
    width: 100%;
  }
}

:where(.info) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

:where(.title) {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:where(.desc) {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

:where(.meta) {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 16px;
}

:where(.price-row) {
  margin-bottom: 20px;
}

:where(.price) {
  font-size: 28px;
  color: var(--el-color-danger);
  font-weight: 600;
}

:where(.original-price) {
  margin-left: 12px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  text-decoration: line-through;
}

:where(.actions) {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

:where(.section) {
  background: var(--el-bg-color);
  padding: 24px;
  border-radius: var(--global-border-radius);
  margin-bottom: 24px;
}

:where(.section-title) {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

:where(.chapter) {
  border-bottom: var(--unified-border-bottom);
  padding: 12px 0;
}

:where(.chapter-name) {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 8px;
}

:where(.video-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  border-radius: var(--global-border-radius);

  &:hover {
    background: var(--el-fill-color-lighter);
  }
}

:where(.video-title) {
  flex: 1;
}

:where(.video-duration) {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
