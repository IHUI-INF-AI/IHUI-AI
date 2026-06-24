<template>
  <div class="article-detail-page" v-loading="loading">
    <Breadcrumb :items="[{ label: t('articleDetail.article'), to: '/article' }, { label: data.title }]" />
    <article v-if="data.id" class="article-wrap">
      <header class="article-head">
        <h1 class="article-title">{{ data.title }}</h1>
        <div class="article-author">
          <el-avatar :src="data.authorAvatar" :size="40" />
          <div class="author-info">
            <p class="author-name">{{ data.authorName || t('articleDetail.anonymousAuthor') }}</p>
            <p class="article-time">{{ data.publishTime }} · {{ t('articleDetail.read') }} {{ data.viewNum || 0 }}</p>
          </div>
        </div>
      </header>
      <div v-if="data.cover" class="article-cover">
        <img :src="data.cover" :alt="data.title" loading="lazy" />
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="article-content" v-html="sanitizeHtml(data.content || data.summary || '')" />
      <div v-if="data.tagList && data.tagList.length" class="article-tags">
        <el-tag v-for="tag in data.tagList" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
      </div>
      <div class="article-foot">
        <el-button @click="onLike" :type="liked ? 'primary' : 'default'">
          <el-icon><Star /></el-icon> {{ t('articleDetail.like') }} ({{ data.likeNum || 0 }})
        </el-button>
        <el-button @click="onFavorite" :type="favorited ? 'primary' : 'default'">
          <el-icon><Collection /></el-icon> {{ t('articleDetail.favorite') }} ({{ data.favoriteNum || 0 }})
        </el-button>
        <el-button @click="$router.back()">{{ t('articleDetail.backToList') }}</el-button>
      </div>
    </article>
    <el-empty v-else :description="t('common.noData')" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Star, Collection } from '@element-plus/icons-vue'
import { articleApi } from '@/api/article'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import Breadcrumb from '@/components/learn/Breadcrumb.vue'

const { t } = useI18n()
const route = useRoute()
const loading = ref(false)
const data = ref<any>({})
const liked = ref(false)
const favorited = ref(false)

async function load() {
  loading.value = true
  try { data.value = (await articleApi.detail(route.params.id as string))?.data || {} } finally { loading.value = false }
}
async function onLike() { try { await articleApi.like(data.value.id); liked.value = !liked.value; data.value.likeNum = (data.value.likeNum || 0) + (liked.value ? 1 : -1) } catch { ElMessage.error(t('common.errors.operationFailed')) } }
async function onFavorite() { try { await articleApi.favorite(data.value.id); favorited.value = !favorited.value } catch { ElMessage.error(t('common.errors.operationFailed')) } }
onMounted(load)
</script>

<style scoped lang="scss">
:where(.article-detail-page) {
  max-width: 900px; margin: 0 auto; padding: 24px 16px;
  .article-wrap { background: var(--el-bg-color); border-radius: var(--global-border-radius); padding: 24px; }
  .article-head { padding-bottom: 16px; border-bottom: var(--unified-border-bottom); margin-bottom: 16px; }
  .article-title { margin: 0 0 12px; font-size: 26px; color: var(--el-text-color-primary); line-height: 1.4; }
  .article-author { display: flex; align-items: center; gap: 12px; }
  .author-info { .author-name { margin: 0; font-size: 14px; color: var(--el-text-color-primary); } .article-time { margin: 4px 0 0; font-size: 12px; color: var(--el-text-color-secondary); } }
  .article-cover { margin-bottom: 16px; border-radius: var(--global-border-radius); overflow: hidden; img { width: 100%; display: block; } }
  .article-content { font-size: 15px; line-height: 1.8; color: var(--el-text-color-regular); }
  .article-tags { margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
  .article-foot { margin-top: 24px; padding-top: 16px; border-top: var(--unified-border); display: flex; gap: 8px; }
}
</style>
