<template>
  <div class="resource-list-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">{{ t('resourceList.title') }}</h2>
      <p class="page-desc">{{ t('resourceList.desc') }}</p>
    </div>
    <div class="filter-bar">
      <el-input v-model="keyword" :placeholder="t('resourceList.searchPlaceholder')" clearable class="search-input" @keyup.enter="reload" />
      <el-select v-model="type" :placeholder="t('resourceList.typePlaceholder')" clearable class="type-select" @change="reload">
        <el-option :label="t('resourceList.typeDoc')" value="doc" />
        <el-option :label="t('resourceList.typeVideo')" value="video" />
        <el-option :label="t('resourceList.typeAudio')" value="audio" />
        <el-option :label="t('resourceList.typeImage')" value="image" />
        <el-option :label="t('resourceList.typeArchive')" value="archive" />
      </el-select>
      <el-select v-model="sort" class="sort-select" @change="reload">
        <el-option :label="t('resourceList.sortNew')" value="new" />
        <el-option :label="t('resourceList.sortHot')" value="hot" />
        <el-option :label="t('resourceList.sortDownload')" value="download" />
      </el-select>
    </div>
    <div class="resource-grid" v-if="list.length">
      <div v-for="r in list" :key="r.id" class="resource-card" @click="goDetail(r)">
        <div class="card-cover" :class="`type-${r.type || 'other'}`">
          <el-icon :size="36"><component :is="iconForType(r.type)" /></el-icon>
          <span v-if="r.top" class="badge top">{{ t('resourceList.top') }}</span>
        </div>
        <div class="card-info">
          <h3 class="card-title" :title="r.title">{{ r.title }}</h3>
          <p class="card-desc" v-if="r.description">{{ r.description }}</p>
          <div class="card-meta">
            <span class="size" v-if="r.size">{{ formatSize(r.size) }}</span>
            <span class="download">↓ {{ r.downloadNum || 0 }}</span>
            <span class="free" v-if="r.free">{{ t('resourceList.free') }}</span>
            <span class="points" v-else-if="r.points">{{ r.points }} {{ t('resourceList.points') }}</span>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-else :description="t('resourceList.empty')" />
    <Pagination v-if="total > size" :current="current" :size="size" :total="total" @change="onPage" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Document, VideoCamera, Headset, Picture, Folder, Files } from '@element-plus/icons-vue'
import { resourceApi } from '@/api/resource'
import Pagination from '@/components/learn/Page.vue'

const { t } = useI18n()
const router = useRouter()
const loading = ref(false)
const list = ref<any[]>([])
const keyword = ref('')
const type = ref('')
const sort = ref<'new' | 'hot' | 'download'>('new')
const current = ref(1)
const size = ref(12)
const total = ref(0)
let reqSeq = 0

const ICONS: Record<string, any> = { doc: Document, video: VideoCamera, audio: Headset, image: Picture, archive: Folder, other: Files }
function iconForType(t?: string) { return ICONS[t || 'other'] || Files }
function formatSize(b: number) {
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB'
  return (b / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

async function reload() {
  loading.value = true
  const seq = ++reqSeq
  try {
    const res = await resourceApi.list({ current: current.value, size: size.value, keyword: keyword.value || undefined, type: type.value || undefined, sort: sort.value })
    if (seq !== reqSeq) return
    list.value = (res.data as any)?.list || (res.data as any)?.data?.list || []
    total.value = (res.data as any)?.total || (res.data as any)?.data?.total || 0
  } finally { if (seq === reqSeq) loading.value = false }
}
function onPage(p: { current: number; size: number }) { current.value = p.current; size.value = p.size; reload() }
function goDetail(r: any) { router.push(`/resource/${r.id}`) }
watch([keyword, type, sort], () => { current.value = 1; reload() })
onMounted(reload)
</script>

<style scoped lang="scss">
:where(.resource-list-page) {
  max-width: 1200px; margin: 0 auto; padding: 24px 16px;
  .page-header { margin-bottom: 16px; }
  .page-title { margin: 0 0 4px; font-size: 24px; color: var(--el-text-color-primary); }
  .page-desc { margin: 0; color: var(--el-text-color-secondary); font-size: 14px; }
  .filter-bar { display: flex; gap: 12px; margin-bottom: 16px; }
  .search-input { flex: 1; }
  .type-select { width: 130px; }
  .sort-select { width: 130px; }
  .resource-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .resource-card { background: var(--el-bg-color); border-radius: var(--global-border-radius); overflow: hidden; cursor: pointer; transition: transform 0.2s, border-color 0.2s; border: var(--unified-border); &:hover {  border-color: var(--el-color-primary); } }
  .card-cover { position: relative; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; background: var(--el-fill-color-light); color: var(--el-color-primary); &.type-doc { background: var(--el-color-primary-light-9); } &.type-video { background: var(--el-color-success-light-9); color: var(--el-color-success); } &.type-audio { background: var(--el-color-warning-light-9); color: var(--el-color-warning); } &.type-image { background: var(--el-color-info-light-9); color: var(--el-color-info); } &.type-archive { background: var(--el-color-danger-light-9); color: var(--el-color-danger); } }
  .badge { position: absolute; top: 8px; right: 8px; padding: 2px 8px; border-radius: var(--global-border-radius); font-size: 12px; color: var(--el-bg-color); &.top { background: var(--el-color-danger); } }
  .card-info { padding: 12px; }
  .card-title { margin: 0 0 6px; font-size: 14px; color: var(--el-text-color-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card-desc { margin: 0 0 8px; font-size: 12px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .card-meta { display: flex; gap: 8px; font-size: 12px; color: var(--el-text-color-placeholder); .free { color: var(--el-color-success); } .points { color: var(--el-color-warning); } }
}
</style>
