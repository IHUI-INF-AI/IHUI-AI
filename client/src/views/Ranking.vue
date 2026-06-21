<template>
  <div class="ranking-page page-container">
    <div class="page-header">
      <h1 class="page-title">{{ t('ranking.title') }}</h1>
      <p class="page-subtitle">{{ t('ranking.subtitle') }}</p>
    </div>

    <div class="tabs-row">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
      <select v-model="period" class="filter-select" @change="loadData">
        <option value="day">{{ t('ranking.dayRank') }}</option>
        <option value="week">{{ t('ranking.weekRank') }}</option>
        <option value="month">{{ t('ranking.monthRank') }}</option>
        <option value="all">{{ t('ranking.totalRank') }}</option>
      </select>
    </div>

    <div v-loading="loading" class="rank-wrap">
      <div v-if="loadError" class="error-state">
        <p>{{ loadError }}</p>
        <el-button type="primary" size="small" @click="loadData">{{ t('common.retry') }}</el-button>
      </div>

      <div v-else-if="items.length === 0" class="empty-state">
        <div class="empty-icon">🏆</div>
        <p>{{ t('ranking.noData') }}</p>
      </div>

      <ul v-else class="rank-list">
        <li v-for="(item, idx) in items" :key="item.user_id || item.agent_id || idx" :class="['rank-item', `top-${Number(idx) + 1}`]">
          <span :class="['rank-num', getRankClass(Number(idx) + 1)]">
            <template v-if="Number(idx) < 3">{{ ['🥇', '🥈', '🥉'][Number(idx) as 0 | 1 | 2] }}</template>
            <template v-else>{{ Number(idx) + 1 }}</template>
          </span>
          <div class="rank-avatar">
            {{ (item.user_name || item.name || '?').slice(0, 1) }}
          </div>
          <div class="rank-info">
            <h3 class="rank-name">{{ item.user_name || item.name || '匿名' }}</h3>
            <p class="rank-meta">
              <span v-if="item.level">Lv.{{ item.level }}</span>
              <span v-if="item.course_id">· {{ item.title || '课程' }}</span>
              <span v-if="item.heat">· 热度 {{ item.heat }}</span>
            </p>
          </div>
          <span class="rank-score">
            {{ item.score ?? item.view_num ?? item.heat ?? 0 }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { rankApi } from '@/api/ranking'
import { useSEO } from '@/composables/useSEO'

useSEO({
  title: '排行榜 - 智汇AI社区',
  description: '智汇AI社区排行榜，查看最受欢迎的AI智能体和内容',
  keywords: '排行榜,AI排行榜,智汇AI排行',
  ogTitle: '排行榜 - 智汇AI社区',
  ogDescription: '智汇AI社区排行榜，查看最受欢迎的AI智能体和内容',
  canonical: 'https://www.zhihui-ai.com/ranking'
})

const activeTab = ref('user')
const period = ref('week')
const loading = ref(false)
const loadError = ref('')
const items = ref<any[]>([])

const tabs = [
  { key: 'user', label: '用户积分榜' },
  { key: 'agent', label: '智能体热度榜' },
  { key: 'course', label: '课程人气榜' },
]

function getRankClass(rank: number) {
  if (rank === 1) return 'rank-gold'
  if (rank === 2) return 'rank-silver'
  if (rank === 3) return 'rank-bronze'
  return 'rank-default'
}

async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    let res
    const params: any = { limit: 50 }
    if (activeTab.value === 'user') {
      params.period = period.value
      res = await rankApi.user(params)
    } else if (activeTab.value === 'agent') {
      params.period = period.value
      res = await rankApi.agent(params)
    } else {
      res = await rankApi.course(params)
    }
    const data = res?.data
    items.value = data?.data || data?.list || data || []
  } catch {
    loadError.value = '加载失败'
  } finally {
    loading.value = false
  }
}

watch(activeTab, loadData)
watch(period, loadData)

onMounted(loadData)
</script>

<style scoped>
.page-container {
  max-width: 960px;
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

.tabs-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.tab-btn {
  padding: 6px 14px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.tab-btn.active {
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  border-color: var(--el-color-primary);
}

.filter-select {
  margin-left: auto;
  padding: 6px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.rank-wrap {
  min-height: 300px;
}

.rank-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 12px 16px;
  margin-bottom: 6px;
  transition: border-color 0.15s;
}

.rank-item:hover {
  border-color: var(--el-color-primary);
}

.rank-item.top-1 {
  border-color: var(--color-rank-gold);
  background: linear-gradient(0deg, var(--color-rank-top1-bg), var(--color-rank-top1-bg));
}

.rank-item.top-2 {
  border-color: var(--color-rank-silver);
}

.rank-item.top-3 {
  border-color: var(--color-rank-bronze);
}

.rank-num {
  width: 32px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
}

.rank-num.rank-gold {
  color: var(--color-rank-gold);
}

.rank-num.rank-silver {
  color: var(--color-rank-silver);
}

.rank-num.rank-bronze {
  color: var(--color-rank-bronze);
}

.rank-num.rank-default {
  color: $text-sec;
  font-size: 14px;
}

.rank-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-rank-avatar-start), var(--color-rank-avatar-end));
  color: var(--el-bg-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  flex-shrink: 0;
}

.rank-info {
  flex: 1;
  min-width: 0;
}

.rank-name {
  font-size: 14px;
  font-weight: 500;
  color: $text-main;
  margin: 0 0 2px;
}

.rank-meta {
  font-size: 12px;
  color: $text-sec;
  margin: 0;
}

.rank-score {
  font-size: 16px;
  font-weight: 600;
  color: $brand-primary;
  flex-shrink: 0;
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
