<template>
  <div class="circle-list-page page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('circleList.title') }}</h1>
        <p class="page-subtitle">{{ t('circleList.subtitle') }}</p>
      </div>
    </div>

    <div class="filter-bar">
      <input v-model="keyword" class="search-input" :placeholder="t('circleList.searchPlaceholder')" @keydown.enter="loadList" />
      <select v-model="cid" class="filter-select" @change="loadList">
        <option value="">{{ t('circleList.allCategories') }}</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <label class="checkbox-wrap">
        <input v-model="onlyOfficial" type="checkbox" @change="loadList" />
        {{ t('circleList.onlyOfficial') }}
      </label>
    </div>

    <div v-loading="loading" class="list-wrap">
      <div v-if="loadError" class="error-state">
        <p>{{ loadError }}</p>
        <el-button type="primary" size="small" @click="loadList">{{ t('common.retry') }}</el-button>
      </div>

      <div v-else-if="circles.length === 0" class="empty-state">
        <div class="empty-icon">🌐</div>
        <p>{{ t('circleList.noCircles') }}</p>
      </div>

      <div v-else class="circle-grid">
        <div v-for="c in circles" :key="c.id" class="circle-card" @click="goDetail(c.id)">
          <div class="cover">
            <span v-if="c.is_official" class="flag flag-official">{{ t('circleList.official') }}</span>
            <span v-if="c.is_top" class="flag flag-top">{{ t('circleList.top') }}</span>
            <span class="cover-emoji">{{ c.cover || c.avatar || '🌐' }}</span>
          </div>
          <div class="info">
            <h3 class="c-name">{{ c.name }}</h3>
            <p class="c-desc">{{ c.description || t('circleList.noDesc') }}</p>
            <div class="c-stats">
              <span>👥 {{ c.member_num || 0 }} {{ t('circleList.members') }}</span>
              <span>📝 {{ c.post_num || 0 }} {{ t('circleList.posts') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRouter } from 'vue-router'
import { circleApi } from '@/api/content/circle'

const router = useRouter()
const loading = ref(false)
const loadError = ref('')
const circles = ref<any[]>([])
const categories = ref<any[]>([])
const keyword = ref('')
const cid = ref<number | ''>('')
const onlyOfficial = ref(false)

async function loadList() {
  loading.value = true
  loadError.value = ''
  try {
    const params: any = { page: 1, limit: 30 }
    if (keyword.value) params.keyword = keyword.value
    if (cid.value) params.category_id = Number(cid.value)
    if (onlyOfficial.value) params.is_official = true
    const res = await circleApi.list(params)
    const data = res?.data
    circles.value = data?.data || data?.list || data || []
  } catch {
    loadError.value = t('common.loadFailed')
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const res = await circleApi.categories()
    const data = res?.data
    categories.value = data?.data || data || []
  } catch {
    /* 静默 */
  }
}

function goDetail(id: number) {
  router.push(`/circle/${id}`)
}

onMounted(() => {
  loadList()
  loadCategories()
})
</script>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: $text-main;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: $text-sec;
  margin: 4px 0 0;
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  background: var(--el-bg-color);
  color: $text-main;
}

.filter-select {
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  font-size: 14px;
  color: $text-main;
}

.checkbox-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: $text-main;
  cursor: pointer;
}

.list-wrap {
  min-height: 300px;
}

.circle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.circle-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s;
}

.circle-card:hover {
  border-color: $brand-primary;
}

.cover {
  height: 96px;
  background: linear-gradient(135deg, var(--color-rank-avatar-start), var(--color-rank-avatar-end));
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
}

.flag {
  position: absolute;
  top: 8px;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: var(--global-border-radius);
  color: var(--el-bg-color);
}

.flag-official {
  right: 8px;
  background: var(--el-color-warning);
}

.flag-top {
  left: 8px;
  background: var(--el-color-danger);
}

.cover-emoji {
  font-size: 40px;
  line-height: 1;
}

.info {
  padding: 12px 14px;
}

.c-name {
  font-size: 15px;
  font-weight: 500;
  color: $text-main;
  margin: 0 0 4px;
}

.c-desc {
  font-size: 13px;
  color: $text-sec;
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.c-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: $text-sec;
}

.error-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: $text-sec;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}
</style>
