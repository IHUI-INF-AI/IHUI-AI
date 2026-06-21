<template>
  <div class="learn-play-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="breadcrumbItems" />

    <div class="play-content">
      <div class="player-wrap">
        <LearnVideo
          v-if="currentVideo.src"
          :src="currentVideo.src"
          :poster="currentVideo.cover"
          @timeupdate="handleTimeUpdate"
          @ended="handleEnded"
        />
        <el-empty v-else :description="t('learnPlay.selectChapter')" />
      </div>
      <div class="side">
        <h3 class="side-title">{{ t('learnPlay.chapters') }}</h3>
        <div class="chapter-list">
          <div
            v-for="ch in chapters"
            :key="ch.id"
            class="chapter-block"
          >
            <div class="chapter-name">{{ ch.name }}</div>
            <div
              v-for="v in ch.videoList || []"
              :key="v.id"
              class="video-item"
              :class="{ active: currentVideo.id === v.id }"
              @click="selectVideo(v)"
            >
              <el-icon><VideoPlay /></el-icon>
              <span class="title">{{ v.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRoute } from 'vue-router'
import { VideoPlay } from '@element-plus/icons-vue'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import LearnVideo from '@/components/learn/Video.vue'
import { learnApi } from '@/api/learn'

const route = useRoute()
const lessonId = String(route.params.id || route.query.lessonId || '')
const videoId = String(route.query.videoId || '')

const chapters = ref<any[]>([])
const currentVideo = ref<any>({})

const breadcrumbItems = computed(() => [
  { title: '课程', path: '/learn' },
  { title: '学习', path: `/learn/detail/${lessonId}` },
  { title: currentVideo.value.name || '播放' },
])

async function loadChapters() {
  try {
    const res: any = await learnApi.chapterList(lessonId)
    chapters.value = res.data || []
    if (videoId) {
      for (const ch of chapters.value) {
        const v = (ch.videoList || []).find((x: any) => String(x.id) === videoId)
        if (v) {
          currentVideo.value = v
          return
        }
      }
    }
    const first = chapters.value[0]?.videoList?.[0]
    if (first) currentVideo.value = first
  } catch (e) { console.error(e) }
}

function selectVideo(v: any) {
  currentVideo.value = v
}

let lastSaved = 0
function handleTimeUpdate(t: number) {
  if (t - lastSaved > 30) {
    learnApi.recordUpdate({ lessonId, progress: Math.min(100, t), lastTime: new Date().toISOString() })
    lastSaved = t
  }
}

function handleEnded() {
  learnApi.recordUpdate({ lessonId, progress: 100, lastTime: new Date().toISOString() })
}

onMounted(loadChapters)
</script>

<style lang="scss" scoped>
:where(.learn-play-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.play-content) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 12px;
  display: flex;
  gap: 24px;

  @media (width <= 768px) {
    flex-direction: column;
  }
}

:where(.player-wrap) {
  flex: 1;
  background: var(--color-video-bg);
  border-radius: var(--global-border-radius);
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:where(.side) {
  width: 280px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 16px;
  max-height: 70vh;
  overflow-y: auto;
}

:where(.side-title) {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

:where(.chapter-block) {
  margin-bottom: 12px;
}

:where(.chapter-name) {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--el-text-color-regular);
}

:where(.video-item) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--global-border-radius);

  &:hover {
    background: var(--el-fill-color-lighter);
  }

  &.active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }

  .title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
