<template>
  <div class="news-list-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">{{ t('newsList.title') }}</h2>
      <p class="page-desc">{{ t('newsList.desc') }}</p>
    </div>
    <div class="filter-bar">
      <el-tabs v-model="activeCid" @tab-change="reload">
        <el-tab-pane label="全部" name="" />
        <el-tab-pane v-for="c in categories" :key="c.id" :label="c.name" :name="String(c.id)" />
      </el-tabs>
      <div class="filter-right">
        <span class="hot-news-link" @click="goHot">{{ t('newsList.viewHot') }}</span>
      </div>
    </div>
    <div class="news-grid" v-if="list.length">
      <article v-for="n in list" :key="n.id" class="news-card" @click="goDetail(n)">
        <div class="news-cover" v-if="n.cover">
          <img :src="n.cover" :alt="n.title" loading="lazy" />
          <span v-if="n.top" class="badge top">{{ t('newsList.top') }}</span>
          <span v-else-if="n.hot" class="badge hot">{{ t('newsList.hot') }}</span>
        </div>
        <div class="news-info">
          <h3 class="news-title">{{ n.title }}</h3>
          <p class="news-summary" v-if="n.summary">{{ n.summary }}</p>
          <div class="news-meta">
            <span class="news-source">{{ n.source || t('newsList.official') }}</span>
            <span class="news-time">{{ n.publishTime || '' }}</span>
            <span class="news-view" v-if="n.viewNum !== undefined">{{ t('newsList.read') }} {{ n.viewNum }}</span>
          </div>
        </div>
      </article>
    </div>
    <el-empty v-else description="暂无资讯" />
    <Pagination v-if="total > size" :current="current" :size="size" :total="total" @change="onPage" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { newsApi, type NewsItem } from '@/api/news'
import Pagination from '@/components/learn/Page.vue'

const { t } = useI18n()
const router = useRouter()
const loading = ref(false)
const list = ref<NewsItem[]>([])
const categories = ref<Array<{ id: string | number; name: string; count?: number }>>([])
const activeCid = ref('')
const current = ref(1)
const size = ref(12)
const total = ref(0)

async function reload() {
  loading.value = true
  try {
    const res = await newsApi.list({ current: current.value, size: size.value, categoryId: activeCid.value || undefined })
    list.value = res.data?.data?.list || []
    total.value = res.data?.data?.total || 0
  } finally { loading.value = false }
}
async function loadCats() {
  try { categories.value = (await newsApi.categories())?.data?.data || [] } catch { categories.value = [] }
}
function onPage(p: { current: number; size: number }) { current.value = p.current; size.value = p.size; reload() }
function goDetail(n: NewsItem) { router.push(`/news/${n.id}`) }
function goHot() { router.push('/news?hot=1') }
onMounted(() => { loadCats(); reload() })
</script>

<style scoped lang="scss">
:where(.news-list-page) {
  max-width: 1200px; margin: 0 auto; padding: 24px 16px;
  .page-header { margin-bottom: 16px; }
  .page-title { margin: 0 0 4px; font-size: 24px; color: var(--el-text-color-primary); }
  .page-desc { margin: 0; color: var(--el-text-color-secondary); font-size: 14px; }
  .filter-bar { display: flex; justify-content: space-between; align-items: center; background: var(--el-bg-color); padding: 8px 16px; border-radius: var(--global-border-radius); margin-bottom: 16px; }
  .filter-right { font-size: 13px; color: var(--el-color-primary); cursor: pointer; }
  .news-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .news-card { background: var(--el-bg-color); border-radius: var(--global-border-radius); overflow: hidden; cursor: pointer; transition: all 0.2s; border: var(--unified-border); &:hover { transform: translateY(-2px); box-shadow: var(--global-box-shadow); border-color: var(--border-unified-color-hover); } }
  .news-cover { position: relative; aspect-ratio: 16 / 9; background: var(--el-fill-color-light); overflow: hidden; img { width: 100%; height: 100%; object-fit: cover; display: block; } }
  .badge { position: absolute; top: 8px; right: 8px; padding: 2px 8px; border-radius: var(--global-border-radius); font-size: 12px; &.top { background: var(--el-color-danger); color: var(--app-button-text-on-primary); } &.hot { background: var(--el-color-warning); /* stylelint-disable color-no-hex -- 警告色背景深色文字 */ color: #1a1a1a; /* stylelint-enable color-no-hex */ } }
  .news-info { padding: 12px; }
  .news-title { margin: 0 0 6px; font-size: 15px; color: var(--el-text-color-primary); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .news-summary { margin: 0 0 8px; font-size: 13px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .news-meta { display: flex; gap: 8px; font-size: 12px; color: var(--el-text-color-placeholder); }
}
</style>
