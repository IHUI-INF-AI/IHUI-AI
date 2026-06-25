<template>
  <div class="learn-topic-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="[{ title: t('learnTopic.breadcrumbCourse'), path: '/learn' }, { title: t('learnTopic.breadcrumbTopic') }]" />

    <div v-loading="loading" class="topic-wrap">
      <el-empty v-if="!list.length" :description="t('learnTopic.noTopics')" />
      <div v-else class="topic-grid">
        <div v-for="t in list" :key="t.id" class="topic-card" @click="goDetail(t)">
          <div class="topic-cover">
            <img :src="t.cover || t.image" :alt="t.name" loading="lazy" />
          </div>
          <div class="topic-info">
            <h3 class="topic-name">{{ t.name }}</h3>
            <p v-if="t.description" class="topic-desc">{{ t.description }}</p>
            <div class="topic-meta">
              <span>{{ t.learnNum || 0 }} {{ t('learnTopic.learnCount') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <LearnPage
      :total="total"
      v-model:page="page"
      v-model:size="size"
      @change="load"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRouter } from 'vue-router'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import LearnPage from '@/components/learn/Page.vue'
import { learnApi } from '@/api/learn/learn'

const router = useRouter()
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const size = ref(12)

async function load() {
  loading.value = true
  try {
    const res: any = await learnApi.topicList({ page: page.value, pageSize: size.value } as any)
    list.value = res.data?.items || res.data?.list || []
    total.value = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

function goDetail(t: any) {
  router.push({ path: `/learn/topic/${t.id}` })
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.learn-topic-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.topic-wrap) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 12px;
}

:where(.topic-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

:where(.topic-card) {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }
}

:where(.topic-cover) {
  aspect-ratio: 16 / 9;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

:where(.topic-info) {
  padding: 16px;
}

:where(.topic-name) {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

:where(.topic-desc) {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.topic-meta) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
