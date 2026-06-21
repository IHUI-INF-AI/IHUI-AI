<template>
  <div class="learn-home-page page-container">
    <LearnNavMenu />
    <Banner :carousel="carousel" :loading="bannerLoading" />
    <Hot :list="hotList" :loading="hotLoading" title="热门推荐" type="learn" @refresh="loadHot" />
    <RowTabs
      v-for="cat in categoryLessons"
      :key="cat.id"
      :item="cat"
      :list="cat.list"
      :sub-categories="cat.subCategories"
      :loading="false"
    />
    <el-empty v-if="!categoryLessons.length && !hotLoading" description="暂无课程" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import Banner from '@/components/module/Banner.vue'
import Hot from '@/components/module/Hot.vue'
import RowTabs from '@/components/module/RowTabs.vue'
import { learnApi } from '@/api/learn'

// 轮播图项
interface CarouselItem {
  title: string
  image: string
  link: string
}

// 分类课程项（兼容树形结构）
interface CategoryLessonItem {
  id: string | number
  name: string
  list: unknown[]
  subCategories: unknown[]
  [key: string]: unknown
}

// 简化的响应类型
interface ApiResponseData {
  data: unknown
}

const carousel = ref<CarouselItem[]>([])
const hotList = ref<unknown[]>([])
const categoryLessons = ref<CategoryLessonItem[]>([])
const bannerLoading = ref(false)
const hotLoading = ref(false)

async function loadBanner() {
  bannerLoading.value = true
  try {
    const res = await learnApi.recommend({ limit: 5 }) as ApiResponseData
    const items = (res.data || []) as Array<{ id: string; name: string; image?: string; cover?: string }>
    carousel.value = items.map(it => ({
      title: it.name,
      image: it.image || it.cover || '',
      link: `/learn/detail/${it.id}`,
    }))
  } finally {
    bannerLoading.value = false
  }
}

async function loadHot() {
  hotLoading.value = true
  try {
    const res = await learnApi.recommend({ limit: 10 }) as ApiResponseData
    hotList.value = (res.data || []) as unknown[]
  } finally {
    hotLoading.value = false
  }
}

async function loadCategoryLessons() {
  const catRes = await learnApi.categoryTree() as ApiResponseData
  const cats = ((catRes.data || []) as Array<{ id: string | number; name: string; children?: unknown[]; [key: string]: unknown }>).slice(0, 4)
  const results: CategoryLessonItem[] = []
  for (const c of cats) {
    const r = await learnApi.list({ categoryId: c.id as string, pageSize: 6 }) as ApiResponseData
    const rData = (r.data || {}) as { items?: unknown[]; list?: unknown[] }
    results.push({
      ...c,
      list: rData.items || rData.list || [],
      subCategories: c.children || [],
    })
  }
  categoryLessons.value = results
}

onMounted(() => {
  loadBanner()
  loadHot()
  loadCategoryLessons()
})
</script>

<style lang="scss" scoped>
:where(.learn-home-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}
</style>
