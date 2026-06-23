<template>
  <div class="ask-list-page page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ t('askList.community') }}</h1>
        <p class="page-subtitle">{{ t('askList.subtitle') }}</p>
      </div>
      <button class="ask-btn" @click="askDialog = true">{{ t('askList.askQuestion') }}</button>
    </div>

    <div class="filter-bar">
      <input v-model="keyword" class="search-input" :placeholder="t('askList.searchPlaceholder')" @keydown.enter="handleSearch" />
      <select v-model="cid" class="filter-select" @change="loadList">
        <option value="">{{ t('askList.allCategories') }}</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <select v-model="orderBy" class="filter-select" @change="loadList">
        <option value="create_time">{{ t('askList.latest') }}</option>
        <option value="like_num">{{ t('askList.hottest') }}</option>
        <option value="answer_num">{{ t('askList.mostAnswered') }}</option>
      </select>
    </div>

    <div v-loading="loading" class="list-wrap">
      <div v-if="loadError" class="error-state">
        <p>{{ loadError }}</p>
        <el-button type="primary" size="small" @click="loadList">{{ t('common.retry') }}</el-button>
      </div>

      <div v-else-if="questions.length === 0" class="empty-state">
        <div class="empty-icon">❓</div>
        <p>{{ t('askList.noQuestions') }}</p>
      </div>

      <ul v-else class="question-list">
        <li v-for="q in questions" :key="q.id" class="question-item" @click="goDetail(q.id)">
          <div class="q-head">
            <span v-if="q.is_top" class="flag flag-top">{{ t('askList.pinned') }}</span>
            <span v-if="q.is_essence" class="flag flag-essence">{{ t('askList.essence') }}</span>
            <span v-for="c in q.category_list" :key="c.id" class="cat-tag">{{ c.name }}</span>
          </div>
          <h3 class="q-title">{{ q.title }}</h3>
          <p class="q-content">{{ q.content }}</p>
          <div class="q-foot">
            <span class="author">{{ q.member_name }}</span>
            <span class="time">{{ formatTime(q.create_time) }}</span>
            <span class="stat">💬 {{ q.answer_num }}</span>
            <span class="stat">♥ {{ q.like_num }}</span>
            <span class="stat">⭐ {{ q.favorite_num }}</span>
            <span class="stat">👁 {{ q.watch_num }}</span>
          </div>
        </li>
      </ul>
    </div>

    <el-dialog v-model="askDialog" :title="t('askList.askQuestion')" width="520px">
      <div class="ask-form">
        <label class="form-label">{{ t('askList.title') }}</label>
        <input v-model="newQ.title" class="form-input" :placeholder="t('askList.titlePlaceholder')" />
        <label class="form-label">{{ t('askList.content') }}</label>
        <textarea v-model="newQ.content" class="form-textarea" rows="5" :placeholder="t('askList.contentPlaceholder')" />
        <label class="form-label">{{ t('askList.category') }}</label>
        <select v-model="newQ.cid" class="form-input">
          <option value="">{{ t('askList.selectCategory') }}</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <template #footer>
        <el-button @click="askDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAsk">{{ t('common.submit') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { askApi } from '@/api/ask'

const router = useRouter()
const toast = useToast()
const loading = ref(false)
const loadError = ref('')
const questions = ref<any[]>([])
const categories = ref<any[]>([])
const keyword = ref('')
const cid = ref<number | ''>('')
const orderBy = ref('create_time')
const askDialog = ref(false)
const submitting = ref(false)
const newQ = ref({ title: '', content: '', cid: '' as number | '' })

function formatTime(time: string) {
  if (!time) return ''
  return time.slice(0, 16).replace('T', ' ')
}

async function loadList() {
  loading.value = true
  loadError.value = ''
  try {
    const params: any = { page: 1, limit: 30 }
    if (keyword.value) params.keyword = keyword.value
    if (cid.value) params.cid = Number(cid.value)
    if (orderBy.value) params.order_column = orderBy.value
    const res = await askApi.listPublic(params)
    const data = res?.data || {}
    questions.value = data.data || data.list || []
  } catch {
    loadError.value = '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const res = await askApi.categories()
    const data = res?.data
    categories.value = data?.data || data || []
  } catch {
    /* 静默 */
  }
}

function handleSearch() {
  loadList()
}

function goDetail(id: number) {
  router.push(`/ask/${id}`)
}

async function handleAsk() {
  if (!newQ.value.title.trim() || !newQ.value.content.trim()) {
    toast.error(t('common.messages.titleContentRequired'))
    return
  }
  submitting.value = true
  try {
    const data: any = {
      title: newQ.value.title,
      content: newQ.value.content,
    }
    if (newQ.value.cid) data.cid_list = [Number(newQ.value.cid)]
    await askApi.create(data)
    toast.success(t('common.messages.askSuccess'))
    askDialog.value = false
    newQ.value = { title: '', content: '', cid: '' }
    loadList()
  } catch (e: any) {
    toast.error(e?.response?.data?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadList()
  loadCategories()
})
</script>

<style scoped>
.page-container {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 16px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
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

.ask-btn {
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  border: none;
  border-radius: var(--global-border-radius);
  padding: 8px 18px;
  font-size: 14px;
  cursor: pointer;
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.filter-select {
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.list-wrap {
  min-height: 300px;
}

.question-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.question-item {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 14px 16px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.question-item:hover {
  border-color: var(--el-color-primary);
}

.q-head {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.flag {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: var(--global-border-radius);
}

.flag-top {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}

.flag-essence {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.cat-tag {
  font-size: 12px;
  padding: 1px 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  border-radius: var(--global-border-radius);
}

.q-title {
  font-size: 16px;
  font-weight: 500;
  color: $text-main;
  margin: 0 0 4px;
}

.q-content {
  font-size: 14px;
  color: $text-sec;
  margin: 0 0 8px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.q-foot {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: $text-sec;
  align-items: center;
}

.author {
  font-weight: 500;
  color: $text-main;
}

.time {
  margin-right: auto;
}

.stat {
  font-size: 12px;
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

.ask-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.form-label {
  font-size: 13px;
  color: $text-main;
}

.form-input,
.form-textarea {
  padding: 8px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  outline: none;
  resize: vertical;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
  border-color: $brand-primary;
}
</style>
