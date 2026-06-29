<template>
  <div class="resource-detail-page" v-loading="loading">
    <Breadcrumb :items="[{ label: t('resourceDetail.breadcrumbResource'), to: '/resource' }, { label: data.title }]" />
    <div v-if="data.id" class="detail-wrap">
      <div class="main-content">
        <h1 class="resource-title">{{ data.title }}</h1>
        <p class="resource-desc" v-if="data.description">{{ data.description }}</p>
        <div class="resource-stats">
          <span><el-icon><Download /></el-icon> {{ data.downloadNum || 0 }} {{ t('resourceDetail.downloadTimes') }}</span>
          <span><el-icon><View /></el-icon> {{ data.viewNum || 0 }} {{ t('resourceDetail.views') }}</span>
          <span><el-icon><Star /></el-icon> {{ data.score || 0 }} {{ t('resourceDetail.rating') }}</span>
          <span v-if="data.size">{{ t('resourceDetail.size') }} {{ formatSize(data.size) }}</span>
        </div>
        <div class="resource-tags" v-if="data.tagList && data.tagList.length">
          <el-tag v-for="tag in data.tagList" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
        </div>
        <div class="resource-uploader">
          {{ t('resourceDetail.uploader') }} {{ data.uploaderName || t('resourceDetail.anonymous') }} · {{ data.publishTime }}
        </div>
      </div>
      <aside class="side-actions">
        <el-button type="primary" size="large" :icon="Download" @click="onDownload" :loading="downloading" class="dl-btn">
          {{ data.free ? t('resourceDetail.freeDownload') : (data.points ? data.points + ' ' + t('resourceDetail.pointsDownload') : t('resourceDetail.downloadResource')) }}
        </el-button>
        <el-button size="large" @click="onLike" :type="liked ? 'primary' : 'default'">
          <el-icon><Star /></el-icon> {{ t('resourceDetail.like') }}
        </el-button>
        <el-button size="large" @click="onFavorite" :type="favorited ? 'primary' : 'default'">
          <el-icon><Collection /></el-icon> {{ t('resourceDetail.favorite') }}
        </el-button>
        <el-divider />
        <p class="rate-title">{{ t('resourceDetail.rateResource') }}</p>
        <el-rate v-model="rate" :max="5" @change="onRate" />
        <p class="rate-current" v-if="data.score">{{ t('resourceDetail.current') }} {{ data.score.toFixed(1) }} {{ t('resourceDetail.scoreUnit') }}</p>
      </aside>
    </div>
    <el-empty v-else :description="t('resourceDetail.notExist')" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download, View, Star, Collection } from '@element-plus/icons-vue'
import { resourceApi } from '@/api/resource'
import Breadcrumb from '@/components/learn/Breadcrumb.vue'

const { t } = useI18n()
const route = useRoute()
const loading = ref(false)
const downloading = ref(false)
const data = ref<Record<string, unknown>>({})
const liked = ref(false)
const favorited = ref(false)
const rate = ref(0)

function formatSize(b: number) {
  if (!b) return '-'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB'
  return (b / 1024 / 1024 / 1024).toFixed(1) + ' GB'
}

async function load() {
  loading.value = true
  try { data.value = (((await resourceApi.detail(route.params.id as string))?.data as unknown) as Record<string, unknown>) || {} } finally { loading.value = false }
}
async function onDownload() {
  downloading.value = true
  try {
    const res = await resourceApi.download(data.value.id as string | number) as unknown as { url?: string }
    if (res?.url) window.open(res.url, '_blank')
  } finally { downloading.value = false }
}
async function onLike() { try { await resourceApi.like(data.value.id as string | number); liked.value = !liked.value } catch { ElMessage.error(t('resourceDetail.operateFailed')) } }
async function onFavorite() { try { await resourceApi.favorite(data.value.id as string | number); favorited.value = !favorited.value } catch { ElMessage.error(t('resourceDetail.operateFailed')) } }
async function onRate(v: number) { try { await resourceApi.rate(data.value.id as string | number, v); data.value.score = v } catch { ElMessage.error(t('resourceDetail.operateFailed')) } }
onMounted(load)
</script>

<style scoped lang="scss">
:where(.resource-detail-page) {
  max-width: 1000px; margin: 0 auto; padding: 24px 16px;
  .detail-wrap { display: grid; grid-template-columns: 1fr 280px; gap: 24px; }
  .main-content { background: var(--el-bg-color); border-radius: var(--global-border-radius); padding: 24px; }
  .resource-title { margin: 0 0 12px; font-size: 24px; color: var(--el-text-color-primary); }
  .resource-desc { margin: 0 0 16px; font-size: 14px; color: var(--el-text-color-secondary); line-height: 1.6; }
  .resource-stats { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: var(--el-text-color-regular); margin-bottom: 16px; .el-icon { vertical-align: middle; margin-right: 4px; } }
  .resource-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
  .resource-uploader { font-size: 12px; color: var(--el-text-color-placeholder); padding-top: 16px; border-top: var(--unified-border); }
  .side-actions { background: var(--el-bg-color); border-radius: var(--global-border-radius); padding: 20px; display: flex; flex-direction: column; gap: 8px; position: sticky; top: 16px; align-self: start; .dl-btn { font-size: 16px; } }
  .rate-title { margin: 0 0 8px; font-size: 14px; color: var(--el-text-color-primary); }
  .rate-current { margin: 8px 0 0; font-size: 12px; color: var(--el-text-color-secondary); }

  @media (width <= 768px) { .detail-wrap { grid-template-columns: 1fr; } }
}
</style>
