<template>
  <div class="learn-topic-detail-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="breadcrumbItems" />

    <div v-loading="loading" class="detail-wrap">
      <el-empty v-if="!topic.id" :description="t('learnTopicDetail.topicNotFound')" />
      <template v-else>
        <div class="hero">
          <div class="cover">
            <img :src="topic.cover || topic.image" :alt="topic.name" loading="lazy" />
          </div>
          <div class="info">
            <h1 class="title">{{ topic.name }}</h1>
            <p v-if="topic.description" class="desc">{{ topic.description }}</p>
            <el-button type="primary" size="large" @click="handleEnroll">{{ t('learnTopicDetail.joinTopic') }}</el-button>
          </div>
        </div>
        <div class="section">
          <h3 class="section-title">{{ t('learnTopicDetail.topicCourses') }}</h3>
          <el-empty v-if="!lessons.length" description="暂无课程" />
          <div v-else class="lesson-grid">
            <Rectangle
              v-for="l in lessons"
              :key="l.id"
              :item="l"
              link="/learn/detail"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import Rectangle from '@/components/module/Rectangle.vue'
import { learnApi } from '@/api/learn'

const { t } = useI18n()
const route = useRoute()
const id = String(route.params.id || '')

const topic = ref<Record<string, unknown>>({})
const lessons = ref<unknown[]>([])
const loading = ref(false)

const breadcrumbItems = computed(() => [
  { title: '课程', path: '/learn' },
  { title: '专题', path: '/learn/topic' },
  { title: (topic.value.name as string) || '详情' },
])

async function load() {
  loading.value = true
  try {
    const res = await learnApi.topicDetail(id) as unknown as { data?: Record<string, unknown> }
    topic.value = res.data || {}
  } finally {
    loading.value = false
  }
}

async function loadLessons() {
  const res = await learnApi.list({ categoryId: id, pageSize: 20 }) as unknown as { data?: { items?: unknown[]; list?: unknown[] } }
  lessons.value = res.data?.items || res.data?.list || []
}

function handleEnroll() {
  // 简化:直接报名第一课
  if (lessons.value[0]) {
    const first = lessons.value[0] as Record<string, unknown>
    learnApi.signUp(String(first.id))
  }
}

onMounted(() => {
  load()
  loadLessons()
})
</script>

<style lang="scss" scoped>
:where(.learn-topic-detail-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.detail-wrap) {
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
  width: 320px;
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
}

:where(.title) {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 600;
}

:where(.desc) {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

:where(.section) {
  background: var(--el-bg-color);
  padding: 24px;
  border-radius: var(--global-border-radius);
}

:where(.section-title) {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

:where(.lesson-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
</style>
