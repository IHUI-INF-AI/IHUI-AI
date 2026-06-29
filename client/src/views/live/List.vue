<template>
  <div class="live-list-page page-container" v-loading="loading">
    <div class="page-header">
      <h1 class="page-title">{{ t('liveList.title') }}</h1>
      <p class="page-subtitle">{{ t('liveList.subtitle') }}</p>
    </div>

    <div class="filter-bar">
      <div class="cat-row">
        <span
          class="cat-tag"
          :class="{ active: status === '' }"
          @click="changeStatus('')"
        >{{ t('liveList.all') }}</span>
        <span
          class="cat-tag"
          :class="{ active: status === 1 }"
          @click="changeStatus(1)"
        >{{ t('liveList.living') }}</span>
        <span
          class="cat-tag"
          :class="{ active: status === 0 }"
          @click="changeStatus(0)"
        >{{ t('liveList.preview') }}</span>
        <span
          class="cat-tag"
          :class="{ active: status === 2 }"
          @click="changeStatus(2)"
        >{{ t('liveList.replay') }}</span>
      </div>
    </div>

    <el-empty v-if="!list.length" :description="t('liveList.empty')" />
    <div v-else class="live-grid">
      <div
        v-for="live in list"
        :key="live.id"
        class="live-card"
        @click="goDetail(live)"
      >
        <div class="cover">
          <img :src="live.cover" :alt="live.title" loading="lazy" />
          <span v-if="live.status === 1" class="status-badge live">● {{ t('liveList.badgeLiving') }}</span>
          <span v-else-if="live.status === 0" class="status-badge plan">{{ t('liveList.badgePreview') }}</span>
          <span v-else class="status-badge record">{{ t('liveList.badgeReplay') }}</span>
          <span v-if="live.price > 0" class="price-badge">¥{{ live.price }}</span>
        </div>
        <div class="info">
          <h3 class="title">{{ live.title }}</h3>
          <p v-if="live.hostName" class="host">{{ t('liveList.host') }}{{ live.hostName }}</p>
          <div class="meta">
            <span>👁 {{ live.viewNum || 0 }}</span>
            <span>♥ {{ live.likeNum || 0 }}</span>
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
import { useRouter } from 'vue-router'
import LearnPage from '@/components/learn/Page.vue'
import { liveApi } from '@/api/live'

const { t } = useI18n()
const router = useRouter()
const list = ref<unknown[]>([])
const total = ref(0)
const loading = ref(false)
const status = ref<number | ''>('')
const page = ref(1)
const size = ref(12)

async function load() {
  loading.value = true
  try {
    const res = await liveApi.list({
      page: page.value,
      pageSize: size.value,
      status: status.value === '' ? undefined : status.value,
    }) as unknown as { data?: { items?: unknown[]; list?: unknown[]; total?: number } }
    list.value = res.data?.items || res.data?.list || []
    total.value = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

function changeStatus(v: number | '') {
  status.value = v
  page.value = 1
  load()
}

function goDetail(live: unknown) {
  const item = live as Record<string, unknown>
  router.push({ path: `/live/${item.id}` })
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.live-list-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.page-header) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 24px 12px 16px;
}

:where(.page-title) {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 600;
}

:where(.page-subtitle) {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

:where(.filter-bar) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 12px 16px;
}

:where(.cat-row) {
  display: flex;
  gap: 8px;
}

:where(.cat-tag) {
  padding: 6px 16px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  border: var(--unified-border);

  &:hover {
    color: var(--el-color-primary);
  }

  &.active {
    color: var(--el-color-white);
    background: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }
}

:where(.live-grid) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

:where(.live-card) {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }
}

:where(.cover) {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--color-video-bg);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

:where(.status-badge) {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: var(--global-border-radius);
  color: var(--el-color-white);
}

:where(.status-badge.live) {
  background: var(--el-color-danger);
}

:where(.status-badge.plan) {
  background: var(--el-color-warning);
}

:where(.status-badge.record) {
  background: var(--el-color-info);
}

:where(.price-badge) {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: var(--global-border-radius);
  background: var(--el-color-warning);
  color: var(--el-color-white);
}

:where(.info) {
  padding: 12px;
}

:where(.title) {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.host) {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.meta) {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
