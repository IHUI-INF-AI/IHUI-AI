<template>
  <div class="ask-detail-page page-container">
    <button class="back-btn" @click="goBack">← {{ t('askDetail.backToList') }}</button>

    <div v-loading="loading" class="detail-wrap">
      <div v-if="loadError" class="error-state">{{ loadError }}</div>

      <div v-else-if="!question" class="empty-state">
        <p>{{ t('askDetail.questionNotFound') }}</p>
      </div>

      <template v-else>
        <div class="q-card">
          <div class="q-head">
            <span v-if="question.is_top" class="flag flag-top">{{ t('askDetail.top') }}</span>
            <span v-if="question.is_essence" class="flag flag-essence">{{ t('askDetail.essence') }}</span>
            <span v-for="c in question.category_list" :key="c.id" class="cat-tag">{{ c.name }}</span>
          </div>
          <h1 class="q-title">{{ question.title }}</h1>
          <div class="q-meta">
            <span>{{ question.member_name }}</span>
            <span>·</span>
            <span>{{ formatTime(question.create_time) }}</span>
            <span>·</span>
            <span>👁 {{ question.watch_num }}</span>
          </div>
          <div class="q-content">{{ question.content }}</div>
          <div class="q-actions">
            <button :class="['action-btn', { active: question.is_like }]" @click="handleLike('question', question.id)">
              ♥ {{ question.like_num }}
            </button>
            <button class="action-btn" @click="handleFavorite('question', question.id)">
              ⭐ {{ t('askDetail.favorite') }}
            </button>
          </div>
        </div>

        <div class="answer-section">
          <h2 class="section-title">{{ answers.length }} {{ t('askDetail.answers') }}</h2>

          <div class="answer-form">
            <textarea v-model="newAnswer" class="answer-textarea" rows="4" :placeholder="t('askDetail.writeAnswerPlaceholder')"></textarea>
            <el-button type="primary" :loading="submitting" @click="handleAnswer">{{ t('askDetail.submitAnswer') }}</el-button>
          </div>

          <ul class="answer-list">
            <li v-for="a in answers" :key="a.id" :class="['answer-item', { adopted: a.is_adopted }]">
              <div v-if="a.is_adopted" class="adopt-badge">{{ t('askDetail.adopted') }}</div>
              <div class="a-head">
                <span class="a-author">{{ a.user_name }}</span>
                <span class="a-time">{{ formatTime(a.create_time) }}</span>
              </div>
              <div class="a-content">{{ a.content }}</div>
              <div class="a-actions">
                <button :class="['action-btn', { active: a.is_like }]" @click="handleLike('answer', a.id)">
                  ♥ {{ a.like_num }}
                </button>
                <button class="action-btn" @click="handleAdopt(a.id)">{{ t('askDetail.adopt') }}</button>
              </div>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { askApi } from '@/api/ask'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const loading = ref(false)
const loadError = ref('')
const question = ref<any>(null)
const answers = ref<any[]>([])
const newAnswer = ref('')
const submitting = ref(false)

function formatTime(timeStr: string) {
  if (!timeStr) return ''
  return timeStr.slice(0, 16).replace('T', ' ')
}

function goBack() {
  router.push('/ask')
}

async function loadDetail() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  loadError.value = ''
  try {
    const [qRes, aRes] = await Promise.all([
      askApi.detail(id),
      askApi.answerList(id, { page: 1, limit: 50 }),
    ])
    const qData = qRes?.data
    question.value = qData?.data || qData || null
    const aData = aRes?.data
    answers.value = aData?.data || aData?.data || aData || []
  } catch {
    loadError.value = '加载失败'
  } finally {
    loading.value = false
  }
}

async function handleLike(targetType: 'question' | 'answer', targetId: number) {
  try {
    const res = await askApi.toggleLike(targetType, targetId)
    const data = res?.data
    const liked = data?.data?.liked ?? data?.liked ?? false
    if (targetType === 'question' && question.value) {
      question.value.is_like = liked
      question.value.like_num = Math.max(0, (question.value.like_num || 0) + (liked ? 1 : -1))
    } else {
      const a = answers.value.find((x) => x.id === targetId)
      if (a) {
        a.is_like = liked
        a.like_num = Math.max(0, (a.like_num || 0) + (liked ? 1 : -1))
      }
    }
  } catch {
    toast.error('操作失败')
  }
}

async function handleFavorite(targetType: 'question' | 'answer', targetId: number) {
  try {
    await askApi.toggleFavorite(targetType, targetId)
    toast.success('已切换收藏')
  } catch {
    toast.error('操作失败')
  }
}

async function handleAnswer() {
  const id = Number(route.params.id)
  if (!newAnswer.value.trim()) {
    toast.error('请输入回答内容')
    return
  }
  submitting.value = true
  try {
    await askApi.answer(id, newAnswer.value)
    toast.success('回答成功')
    newAnswer.value = ''
    const aRes = await askApi.answerList(id, { page: 1, limit: 50 })
    const aData = aRes?.data
    answers.value = aData?.data || aData || []
  } catch {
    toast.error('提交失败')
  } finally {
    submitting.value = false
  }
}

async function handleAdopt(answerId: number) {
  try {
    await askApi.adopt(answerId)
    toast.success('已采纳')
    answers.value.forEach((a) => (a.is_adopted = a.id === answerId))
  } catch {
    toast.error('操作失败')
  }
}

watch(() => route.params.id, loadDetail, { immediate: true })
onMounted(loadDetail)
</script>

<style scoped>
.page-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px;
}

.back-btn {
  background: transparent;
  border: none;
  color: $brand-primary;
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 12px;
  padding: 0;
}

.detail-wrap {
  min-height: 300px;
}

.q-card {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 20px 24px;
  margin-bottom: 16px;
}

.q-head {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
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
  font-size: 22px;
  font-weight: 600;
  color: $text-main;
  margin: 0 0 8px;
}

.q-meta {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: $text-sec;
  margin-bottom: 16px;
}

.q-content {
  font-size: 15px;
  line-height: 1.7;
  color: $text-main;
  white-space: pre-wrap;
  margin-bottom: 16px;
}

.q-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: transparent;
  border: var(--unified-border);
  color: $text-sec;
  border-radius: var(--global-border-radius);
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}

.action-btn:hover {
  border-color: $brand-primary;
  color: $brand-primary;
}

.action-btn.active {
  background: $brand-primary;
  color: var(--el-bg-color);
  border-color: $brand-primary;
}

.answer-section {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  color: $text-main;
  margin: 0 0 12px;
}

.answer-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: var(--unified-border-bottom);
}

.answer-textarea {
  padding: 10px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  background: var(--el-bg-color);
  color: $text-main;
  outline: none;
  resize: vertical;
  font-family: inherit;
}

.answer-textarea:focus {
  border-color: $brand-primary;
}

.answer-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.answer-item {
  padding: 12px 0;
  border-bottom: var(--unified-border-bottom);
  position: relative;
}

.answer-item:last-child {
  border-bottom: none;
}

.answer-item.adopted {
  background: var(--el-color-success-light-9);
  margin: 0 -24px;
  padding: 12px 24px;
}

.adopt-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: var(--el-color-success);
  color: var(--el-bg-color);
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
}

.a-head {
  display: flex;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 6px;
}

.a-author {
  color: $text-main;
  font-weight: 500;
}

.a-time {
  color: $text-sec;
}

.a-content {
  font-size: 14px;
  line-height: 1.6;
  color: $text-main;
  white-space: pre-wrap;
  margin-bottom: 8px;
}

.a-actions {
  display: flex;
  gap: 8px;
}

.error-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: $text-sec;
}
</style>
