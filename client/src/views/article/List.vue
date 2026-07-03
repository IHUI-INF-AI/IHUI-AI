<template>
  <div class="article-list-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">{{ t('articleList.featuredArticles') }}</h2>
      <p class="page-desc">{{ t('articleList.pageDesc') }}</p>
    </div>
    <div class="filter-bar">
      <el-input v-model="keyword" :placeholder="t('articleList.searchArticle')" clearable class="search-input" @keyup.enter="reload" />
      <el-select v-model="sortBy" class="sort-select" @change="reload">
        <el-option label="最新" value="new" />
        <el-option label="最热" value="hot" />
        <el-option label="精华" value="essence" />
      </el-select>
    </div>
    <div class="article-list" v-if="list.length">
      <article v-for="a in list" :key="a.id" class="article-item" @click="goDetail(a)">
        <div class="item-cover" v-if="a.cover">
          <img :src="a.cover" :alt="a.title" loading="lazy" />
        </div>
        <div class="item-info">
          <h3 class="item-title">
            <span v-if="a.top" class="badge top">{{ t('articleList.top') }}</span>
            <span v-else-if="a.essence" class="badge essence">{{ t('articleList.essence') }}</span>
            {{ a.title }}
          </h3>
          <p class="item-summary" v-if="a.summary">{{ a.summary }}</p>
          <div class="item-meta">
            <span class="author">{{ a.authorName || t('articleList.anonymous') }}</span>
            <span class="time">{{ a.publishTime }}</span>
            <span v-if="a.viewNum !== undefined">{{ t('articleList.read') }} {{ a.viewNum }}</span>
            <span v-if="a.likeNum !== undefined">{{ t('articleList.like') }} {{ a.likeNum }}</span>
            <span v-if="a.commentNum !== undefined">{{ t('articleList.comment') }} {{ a.commentNum }}</span>
          </div>
        </div>
      </article>
    </div>
    <el-empty v-else :description="t('articleList.noArticle')" />
    <Pagination v-if="total > size" :current="current" :size="size" :total="total" @change="onPage" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRouter } from 'vue-router'
import { articleApi, type ArticleItem, type ArticleListParams } from '@/api/article'
import Pagination from '@/components/learn/Page.vue'

const router = useRouter()
const loading = ref(false)
const list = ref<ArticleItem[]>([])
const keyword = ref('')
const sortBy = ref<'new' | 'hot' | 'essence'>('new')
const current = ref(1)
const size = ref(10)
const total = ref(0)
let reqSeq = 0

async function reload() {
  loading.value = true
  const seq = ++reqSeq
  try {
    const params: ArticleListParams = { current: current.value, size: size.value, keyword: keyword.value || undefined }
    if (sortBy.value === 'essence') params.essence = true
    const res = await articleApi.list(params)
    if (seq !== reqSeq) return
    list.value = res.data?.data?.list || []
    total.value = res.data?.data?.total || 0
  } catch (e) { console.error(e) } finally { if (seq === reqSeq) loading.value = false }
}
function onPage(p: { current: number; size: number }) { current.value = p.current; size.value = p.size; reload() }
function goDetail(a: ArticleItem) { router.push(`/article/${a.id}`) }
watch([keyword, sortBy], () => { current.value = 1; reload() })
onMounted(reload)
</script>

<style scoped lang="scss">
:where(.article-list-page) {
  max-width: 1000px; margin: 0 auto; padding: 24px 16px;
  .page-header { margin-bottom: 16px; }
  .page-title { margin: 0 0 4px; font-size: 24px; color: var(--el-text-color-primary); }
  .page-desc { margin: 0; color: var(--el-text-color-secondary); font-size: 14px; }
  .filter-bar { display: flex; gap: 12px; margin-bottom: 16px; }
  .search-input { flex: 1; }
  .sort-select { width: 140px; }
  .article-item { display: flex; gap: 16px; background: var(--el-bg-color); padding: 16px; border-radius: var(--global-border-radius); margin-bottom: 12px; cursor: pointer; transition: all 0.2s; border: var(--unified-border); &:hover { border-color: var(--border-unified-color-hover); transform: translateX(4px); } }
  .item-cover { width: 180px; height: 120px; flex-shrink: 0; border-radius: var(--global-border-radius); overflow: hidden; background: var(--el-fill-color-light); img { width: 100%; height: 100%; object-fit: cover; display: block; } }
  .item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .item-title { margin: 0 0 8px; font-size: 16px; color: var(--el-text-color-primary); display: flex; align-items: center; gap: 6px; }
  .badge { padding: 2px 6px; border-radius: var(--global-border-radius); font-size: 12px; &.top { background: var(--el-color-danger); color: var(--app-button-text-on-primary); } &.essence { background: var(--el-color-warning); /* stylelint-disable color-no-hex -- 警告色背景深色文字 */ color: #1a1a1a; /* stylelint-enable color-no-hex */ } }
  .item-summary { margin: 0 0 auto; font-size: 13px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .item-meta { display: flex; gap: 12px; font-size: 12px; color: var(--el-text-color-placeholder); margin-top: 8px; }
}
</style>
