<template>
  <!--
    AskList.vue — 问答列表页
    路由: EduAsk (/edu/ask)
    功能: 问题卡片列表 + 搜索/排序(最新/热门/未解决) + 我要提问 + 分页
  -->
  <div class="ask-list">
    <!-- ① 页头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.ask.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.ask.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="reload">
          {{ t('edu.profile.retry') }}
        </el-button>
        <el-button type="primary" :icon="EditPen" @click="goCreate">
          {{ t('edu.ask.askQuestion') }}
        </el-button>
      </div>
    </header>

    <!-- ② 错误提示 -->
    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.profile.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- ③ 筛选/搜索 -->
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        :placeholder="t('edu.ask.searchPlaceholder')"
        clearable
        :prefix-icon="Search"
        class="filter-search"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-radio-group v-model="orderBy" @change="handleSearch">
        <el-radio-button value="latest">{{ t('edu.ask.sortLatest') }}</el-radio-button>
        <el-radio-button value="hot">{{ t('edu.ask.sortHot') }}</el-radio-button>
        <el-radio-button value="unresolved">{{ t('edu.ask.sortUnresolved') }}</el-radio-button>
      </el-radio-group>
    </div>

    <!-- ④ 列表 -->
    <div v-loading="loading" class="list-body">
      <el-empty v-if="!loading && questions.length === 0" :description="t('edu.ask.empty')" />

      <div v-else class="question-cards">
        <article
          v-for="q in questions"
          :key="q.id"
          class="question-card"
          @click="goDetail(q.id)"
        >
          <div class="card-main">
            <div class="card-title-row">
              <el-tag
                :type="q.is_resolved ? 'success' : 'warning'"
                size="small"
                effect="plain"
                class="status-tag"
              >
                {{ q.is_resolved ? t('edu.ask.resolved') : t('edu.ask.unresolved') }}
              </el-tag>
              <h2 class="card-title">{{ q.title }}</h2>
            </div>
            <p class="card-summary">{{ q.content }}</p>
            <div class="card-tags">
              <el-tag
                v-for="tag in parseTags(q.tags)"
                :key="tag"
                size="small"
                type="info"
                effect="plain"
                class="card-tag"
              >
                {{ tag }}
              </el-tag>
            </div>
          </div>
          <div class="card-meta">
            <span class="meta-item">
              <el-icon><View /></el-icon>
              {{ q.view_count }} {{ t('edu.ask.viewCount') }}
            </span>
            <span class="meta-item">
              <el-icon><ChatDotRound /></el-icon>
              {{ q.answer_count }} {{ t('edu.ask.answerCount') }}
            </span>
            <span class="meta-item time">
              <el-icon><Clock /></el-icon>
              {{ q.created_at }}
            </span>
          </div>
        </article>
      </div>
    </div>

    <!-- ⑤ 分页 -->
    <div v-if="total > pageSize" class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        background
        @current-change="loadList"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Refresh, EditPen, Search, View, ChatDotRound, Clock } from '@element-plus/icons-vue'
import { askApi, type EduAskQuestion } from '@/api/edu'

const { t } = useI18n()
const router = useRouter()

const questions = ref<EduAskQuestion[]>([])
const loading = ref(false)
const error = ref(false)
const keyword = ref('')
const orderBy = ref<'latest' | 'hot' | 'unresolved'>('latest')
const page = ref(1)
const pageSize = 10
const total = ref(0)

function parseTags(tags?: string): string[] {
  if (!tags) return []
  return tags
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function loadList() {
  loading.value = true
  error.value = false
  try {
    const res = await askApi.listQuestions({
      page: page.value,
      size: pageSize,
      keyword: keyword.value || undefined,
      order_by: orderBy.value,
    })
    const payload = res.data.data
    if (payload) {
      questions.value = payload.items
      total.value = payload.total
    }
  } catch {
    error.value = true
    ElMessage.error(t('edu.profile.loadFailed'))
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadList()
}

function reload() {
  loadList()
}

function goCreate() {
  router.push({ name: 'EduAskCreate' })
}

function goDetail(questionId: number) {
  router.push({ name: 'EduAskDetail', params: { questionId: String(questionId) } })
}

onMounted(loadList)
</script>

<style scoped lang="scss">
.ask-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.error-alert {
  margin: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.filter-search {
  flex: 1;
  min-width: 240px;
  max-width: 360px;
}

.list-body {
  min-height: 200px;
  width: 100%;
}

.question-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.question-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.status-tag {
  flex-shrink: 0;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-summary {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.card-tag {
  border-radius: 8px;
}

.card-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.pagination-wrap {
  display: flex;
  justify-content: center;
}

@media (max-width: 640px) {
  .question-card {
    flex-direction: column;
  }

  .card-meta {
    align-items: flex-start;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .filter-search {
    max-width: none;
  }
}
</style>
