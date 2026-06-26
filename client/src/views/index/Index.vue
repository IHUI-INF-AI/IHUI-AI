<template>
  <div class="home-index-page" v-loading="loading">
    <div class="common-container">
      <!-- 顶部欢迎 + 搜索 -->
      <div class="hero-section">
        <div class="hero-left">
          <h1 class="hero-title">{{ t('indexHome.platformTitle') }}</h1>
          <p class="hero-subtitle">{{ t('indexHome.subtitle') }}</p>
          <SearchBar v-model="searchKw" :placeholder="t('indexHome.searchPlaceholder')" :hot-words="hotWords" @search="onSearch" />
        </div>
        <div class="hero-right stats">
          <div class="stat-card" v-for="s in stats" :key="s.label">
            <div class="stat-num">{{ s.value }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </div>
      </div>

      <!-- 快捷入口 -->
      <div class="quick-section">
        <h2 class="section-title">{{ t('indexHome.quickEntry') }}</h2>
        <div class="quick-grid">
          <router-link v-for="q in quickEntries" :key="q.to" :to="q.to" class="quick-item">
            <div class="quick-icon" :style="{ background: q.color }">
              <el-icon :size="24"><component :is="q.icon" /></el-icon>
            </div>
            <span class="quick-label">{{ q.label }}</span>
          </router-link>
        </div>
      </div>

      <!-- 推荐课程 -->
      <div v-if="hotLessonList.length" class="module-section">
        <div class="module-head">
          <h2 class="module-title">{{ t('indexHome.hotCourses') }}</h2>
          <router-link to="/learn/list" class="module-more">{{ t('indexHome.more') }}</router-link>
        </div>
        <div class="lesson-grid">
          <article v-for="l in hotLessonList" :key="l.id" class="lesson-card" @click="$router.push(`/learn/detail/${l.id}`)">
            <div class="lesson-cover">
              <img v-if="l.cover" :src="l.cover" :alt="l.title" loading="lazy" />
              <div v-else class="lesson-placeholder"><el-icon :size="32"><Picture /></el-icon></div>
            </div>
            <div class="lesson-info">
              <h3 class="lesson-title">{{ l.title }}</h3>
              <p class="lesson-meta">{{ l.teacherName || t('indexHome.masterTeacher') }} · {{ l.studentNum || 0 }} {{ t('indexHome.peopleLearning') }}</p>
              <div class="lesson-foot">
                <span class="lesson-price" v-if="l.price !== undefined">
                  <template v-if="l.price === 0">{{ t('indexHome.free') }}</template>
                  <template v-else>¥{{ l.price }}</template>
                </span>
                <el-button size="small" type="primary" plain>{{ t('common.view') }}</el-button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <!-- 直播 + 考试 双列 -->
      <div class="dual-section">
        <div v-if="liveData.length" class="dual-card">
          <div class="module-head">
            <h2 class="module-title">{{ t('indexHome.livingNow') }}</h2>
            <router-link to="/live" class="module-more">{{ t('indexHome.more') }}</router-link>
          </div>
          <div class="live-list">
            <div v-for="lv in liveData" :key="lv.id" class="live-item" @click="$router.push(`/live/${lv.id}`)">
              <div class="live-thumb">
                <img v-if="lv.cover" :src="lv.cover" :alt="lv.title" />
                <span class="live-status">{{ t('indexHome.liveBadge') }}</span>
              </div>
              <p class="live-title">{{ lv.title }}</p>
              <p class="live-host">{{ lv.hostName }}</p>
            </div>
          </div>
        </div>
        <div v-if="examData.length" class="dual-card">
          <div class="module-head">
            <h2 class="module-title">{{ t('indexHome.upcomingExams') }}</h2>
            <router-link to="/exam" class="module-more">{{ t('indexHome.more') }}</router-link>
          </div>
          <div class="exam-list">
            <div v-for="e in examData" :key="e.id" class="exam-item">
              <p class="exam-title">{{ e.title }}</p>
              <p class="exam-time">{{ e.startTime }} ~ {{ e.endTime }}</p>
              <el-button size="small" type="primary" @click="$router.push(`/exam/${e.id}`)">{{ t('indexHome.signUp') }}</el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 资讯 + 文章 双列 -->
      <div class="dual-section">
        <div v-if="newsList.length" class="dual-card">
          <div class="module-head">
            <h2 class="module-title">{{ t('indexHome.latestNews') }}</h2>
            <router-link to="/news" class="module-more">{{ t('indexHome.more') }}</router-link>
          </div>
          <ul class="info-list">
            <li v-for="n in newsList" :key="n.id" @click="$router.push(`/news/${n.id}`)">
              <span class="info-title">{{ n.title }}</span>
              <span class="info-time">{{ n.publishTime }}</span>
            </li>
          </ul>
        </div>
        <div v-if="articleList.length" class="dual-card">
          <div class="module-head">
            <h2 class="module-title">{{ t('indexHome.featuredArticles') }}</h2>
            <router-link to="/article" class="module-more">{{ t('indexHome.more') }}</router-link>
          </div>
          <ul class="info-list">
            <li v-for="a in articleList" :key="a.id" @click="$router.push(`/article/${a.id}`)">
              <span class="info-title">{{ a.title }}</span>
              <span class="info-time">{{ a.publishTime }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { Picture, Reading, ChatDotRound, Connection, Collection, VideoCamera, Document, EditPen } from '@element-plus/icons-vue'
import { newsApi } from '@/api/content/news'
import { articleApi } from '@/api/content/article'
import { liveApi } from '@/api/learn/live'
import { examApi } from '@/api/learn/exam'
import { learnApi } from '@/api/learn/learn'
import SearchBar from '@/components/module/SearchBar.vue'

const loading = ref(false)
const searchKw = ref('')
const hotWords = ref(['前端开发', 'AI 入门', 'Python', '数据分析', '架构师'])
const stats = ref([
  { label: t('indexHome.statCourses'), value: '1,280' },
  { label: t('indexHome.statStudents'), value: '58.6k' },
  { label: t('indexHome.statLive'), value: '24' },
  { label: t('indexHome.statExam'), value: '12' },
])
const quickEntries = [
  { label: t('indexHome.qeCourse'), to: '/learn', icon: Reading, color: 'var(--el-color-primary)' },
  { label: t('indexHome.qeLive'), to: '/live', icon: VideoCamera, color: 'var(--el-color-success)' },
  { label: t('indexHome.qeExam'), to: '/exam', icon: EditPen, color: 'var(--el-color-warning)' },
  { label: t('indexHome.qeNews'), to: '/news', icon: Document, color: 'var(--el-color-info)' },
  { label: t('indexHome.qeArticle'), to: '/article', icon: Reading, color: 'var(--el-color-primary-light-3)' },
  { label: t('indexHome.qeAsk'), to: '/ask', icon: ChatDotRound, color: 'var(--el-color-danger)' },
  { label: t('indexHome.qeCircle'), to: '/circle', icon: Connection, color: 'var(--el-color-success-light-3)' },
  { label: t('indexHome.qeResource'), to: '/resource', icon: Collection, color: 'var(--el-color-warning-light-3)' },
]
const hotLessonList = ref<Record<string, unknown>[]>([])
const liveData = ref<Record<string, unknown>[]>([])
const examData = ref<Record<string, unknown>[]>([])
const newsList = ref<Record<string, unknown>[]>([])
const articleList = ref<Record<string, unknown>[]>([])

async function load() {
  loading.value = true
  try {
    const [lives, exams, news, articles] = await Promise.allSettled([
      liveApi.list({ page: 1, pageSize: 4 } as unknown as Parameters<typeof liveApi.list>[0]),
      examApi.listPapers({ page: 1, limit: 4 } as unknown as Parameters<typeof examApi.listPapers>[0]),
      newsApi.list({ current: 1, size: 6 }),
      articleApi.list({ current: 1, size: 6 }),
    ])
    liveData.value = lives.status === 'fulfilled' ? ((lives.value as { list?: Record<string, unknown>[] }).list || []) : []
    examData.value = exams.status === 'fulfilled' ? ((exams.value as { list?: Record<string, unknown>[] }).list || []) : []
    newsList.value = news.status === 'fulfilled' ? ((news.value as { data?: { list?: Record<string, unknown>[] } }).data?.list || []) : []
    articleList.value = articles.status === 'fulfilled' ? ((articles.value as { data?: { list?: Record<string, unknown>[] } }).data?.list || []) : []

    // 推荐课程
    try {
      const r = await learnApi.recommend({ limit: 6 } as unknown as Parameters<typeof learnApi.recommend>[0])
      hotLessonList.value = ((r as { data?: { list?: Record<string, unknown>[] } }).data?.list) || []
    } catch {
      try {
        const r2 = await learnApi.list({ page: 1, pageSize: 6 } as unknown as Parameters<typeof learnApi.list>[0])
        hotLessonList.value = ((r2 as { data?: { list?: Record<string, unknown>[] } }).data?.list) || []
      } catch { hotLessonList.value = [] }
    }
  } finally { loading.value = false }
}

function onSearch(v: string) {
  // 跳到课程搜索
  window.location.href = `/learn/list?keyword=${encodeURIComponent(v)}`
}
onMounted(load)
</script>

<style scoped lang="scss">
:where(.home-index-page) {
  min-height: 100vh; padding: 24px 16px;
  background: var(--el-bg-color-page);
  .common-container { max-width: 1200px; margin: 0 auto; }

  .hero-section { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: center; padding: 24px; background: var(--el-bg-color); border-radius: var(--global-border-radius); margin-bottom: 24px;

 @media (width <= 768px) { grid-template-columns: 1fr; } }
  .hero-title { margin: 0 0 8px; font-size: 28px; color: var(--el-text-color-primary); }
  .hero-subtitle { margin: 0 0 16px; color: var(--el-text-color-secondary); font-size: 14px; }
  .hero-right { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .stat-card { padding: 12px 16px; background: var(--el-fill-color-light); border-radius: var(--global-border-radius); text-align: center; min-width: 100px; }
  .stat-num { font-size: 22px; font-weight: 700; color: var(--el-color-primary); }
  .stat-label { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 4px; }
  .section-title, .module-title { margin: 0; font-size: 20px; color: var(--el-text-color-primary); }
  .quick-section, .module-section, .dual-section { background: var(--el-bg-color); border-radius: var(--global-border-radius); padding: 20px; margin-bottom: 16px; }
  .module-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .module-more { font-size: 13px; color: var(--el-text-color-secondary); text-decoration: none; &:hover { color: var(--el-color-primary); } }
  .quick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px; }
  .quick-item { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px; border-radius: var(--global-border-radius); text-decoration: none; transition: background 0.2s; &:hover { background: var(--el-fill-color-light); } }
  .quick-icon { width: 48px; height: 48px; border-radius: var(--global-border-radius); display: flex; align-items: center; justify-content: center; color: var(--el-bg-color); }
  .quick-label { font-size: 13px; color: var(--el-text-color-primary); }
  .lesson-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .lesson-card { background: var(--el-bg-color); border-radius: var(--global-border-radius); overflow: hidden; border: var(--unified-border); cursor: pointer; transition: transform 0.2s; &:hover {  } }
  .lesson-cover { aspect-ratio: 16 / 9; background: var(--el-fill-color-light); overflow: hidden; img { width: 100%; height: 100%; object-fit: cover; display: block; } }
  .lesson-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--el-text-color-placeholder); }
  .lesson-info { padding: 12px; }
  .lesson-title { margin: 0 0 6px; font-size: 14px; color: var(--el-text-color-primary); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .lesson-meta { margin: 0 0 8px; font-size: 12px; color: var(--el-text-color-secondary); }
  .lesson-foot { display: flex; justify-content: space-between; align-items: center; .lesson-price { color: var(--el-color-primary); font-weight: 600; font-size: 14px; } }

  .dual-section { display: grid; grid-template-columns: 1fr 1fr; gap: 16px;

 @media (width <= 768px) { grid-template-columns: 1fr; } }
  .dual-card { background: var(--el-bg-color); border-radius: var(--global-border-radius); padding: 20px; }
  .live-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .live-item { cursor: pointer; .live-thumb { position: relative; aspect-ratio: 16 / 9; border-radius: var(--global-border-radius); overflow: hidden; background: var(--el-fill-color-light); img { width: 100%; height: 100%; object-fit: cover; display: block; } } .live-status { position: absolute; top: 6px; left: 6px; background: var(--el-color-danger); color: var(--el-bg-color); padding: 2px 6px; border-radius: var(--global-border-radius); font-size: 12px; } .live-title { margin: 6px 0 2px; font-size: 13px; color: var(--el-text-color-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .live-host { margin: 0; font-size: 12px; color: var(--el-text-color-secondary); } &:hover { .live-title { color: var(--el-color-primary); } } }
  .exam-list { display: flex; flex-direction: column; gap: 12px; }
  .exam-item { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; padding: 8px 0; border-bottom: var(--unified-border-bottom); &:last-child { border-bottom: none; } .exam-title { margin: 0; font-size: 13px; color: var(--el-text-color-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .exam-time { margin: 0; font-size: 12px; color: var(--el-text-color-secondary); grid-column: 1 / 2; } }
  .info-list { list-style: none; padding: 0; margin: 0; li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--el-border-color-lighter); cursor: pointer; &:last-child { border-bottom: none; } .info-title { font-size: 13px; color: var(--el-text-color-regular); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; &:hover { color: var(--el-color-primary); } } .info-time { font-size: 12px; color: var(--el-text-color-placeholder); flex-shrink: 0; margin-left: 12px; } } }
}
</style>
