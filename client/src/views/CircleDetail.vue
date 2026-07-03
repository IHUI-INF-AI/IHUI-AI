<template>
  <div class="circle-detail-page page-container">
    <button class="back-btn" @click="goBack">← {{ t('circleDetail.back') }}</button>

    <div v-if="circle" class="circle-header">
      <div class="header-cover">
        <span class="header-emoji">{{ circle.cover || circle.avatar || '🌐' }}</span>
      </div>
      <div class="header-info">
        <h1 class="c-name">{{ circle.name }}</h1>
        <p class="c-desc">{{ circle.description || t('circleDetail.noDesc') }}</p>
        <div class="c-meta">
          <span>👥 {{ circle.member_num || 0 }} {{ t('circleDetail.members') }}</span>
          <span>📝 {{ circle.post_num || 0 }} {{ t('circleDetail.posts') }}</span>
          <span>{{ t('circleDetail.owner') }}: {{ circle.owner_name }}</span>
        </div>
        <button class="join-btn" @click="handleJoin">{{ joined ? t('circleDetail.joined') : t('circleDetail.join') }}</button>
      </div>
    </div>

    <div class="post-section">
      <h2 class="section-title">{{ t('circleDetail.postsTitle') }}</h2>

      <div class="post-form">
        <textarea v-model="newPost" class="post-textarea" rows="3" placeholder="说点什么..."></textarea>
        <el-button type="primary" :loading="submitting" @click="handlePublish">{{ t('circleDetail.publish') }}</el-button>
      </div>

      <div v-loading="loading" class="post-list-wrap">
        <div v-if="posts.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <p>{{ t('circleDetail.noPosts') }}</p>
        </div>

        <ul v-else class="post-list">
          <li v-for="p in posts" :key="p.id" class="post-item">
            <div class="p-head">
              <span class="p-author">{{ p.user_name }}</span>
              <span v-if="p.is_top" class="flag">{{ t('circleDetail.top') }}</span>
              <span v-if="p.is_essence" class="flag flag-essence">{{ t('circleDetail.essence') }}</span>
              <span class="p-time">{{ formatTime(p.create_time) }}</span>
            </div>
            <h3 v-if="p.title" class="p-title">{{ p.title }}</h3>
            <p class="p-content">{{ p.content }}</p>
            <div class="p-actions">
              <button :class="['action-btn', { active: p.is_liked }]" @click="handleLike(p.id)">
                ♥ {{ p.like_num }}
              </button>
              <button class="action-btn">💬 {{ p.comment_num }}</button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { circleApi, type Circle, type CirclePost } from '@/api/circle'

interface CirclePostWithLike extends CirclePost {
  is_liked?: boolean
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()
const loading = ref(false)
const circle = ref<Circle | null>(null)
const posts = ref<CirclePostWithLike[]>([])
const newPost = ref('')
const submitting = ref(false)
const joined = ref(false)

function formatTime(time: string) {
  if (!time) return ''
  return time.slice(0, 16).replace('T', ' ')
}

function goBack() {
  router.push('/circle')
}

async function loadDetail() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    const [cRes, pRes] = await Promise.all([
      circleApi.detail(id),
      circleApi.posts(id, { page: 1, limit: 30 }),
    ])
    const cData = cRes?.data
    circle.value = cData?.data || cData || null
    const pData = pRes?.data
    posts.value = pData?.data || pData?.list || pData || []
  } catch {
    /* 静默 */
  } finally {
    loading.value = false
  }
}

async function handleJoin() {
  const id = Number(route.params.id)
  try {
    if (joined.value) {
      await circleApi.quit(id)
      joined.value = false
      toast.success('已退出')
    } else {
      await circleApi.join(id)
      joined.value = true
      toast.success('已加入')
    }
  } catch {
    toast.error('操作失败')
  }
}

async function handlePublish() {
  const id = Number(route.params.id)
  if (!newPost.value.trim()) {
    toast.error('请输入内容')
    return
  }
  submitting.value = true
  try {
    await circleApi.publish({ circle_id: id, content: newPost.value })
    toast.success('发布成功')
    newPost.value = ''
    const pRes = await circleApi.posts(id, { page: 1, limit: 30 })
    const pData = pRes?.data
    posts.value = pData?.data || pData?.list || pData || []
  } catch {
    toast.error('发布失败')
  } finally {
    submitting.value = false
  }
}

async function handleLike(postId: number) {
  try {
    await circleApi.toggleLike(postId)
    const p = posts.value.find((x) => x.id === postId)
    if (p) {
      p.is_liked = !p.is_liked
      p.like_num = Math.max(0, (p.like_num || 0) + (p.is_liked ? 1 : -1))
    }
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

.circle-header {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  margin-bottom: 16px;
}

.header-cover {
  height: 120px;
  background: linear-gradient(135deg, var(--color-rank-avatar-start), var(--color-rank-avatar-end));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60px;
}

.header-emoji {
  font-size: 60px;
}

.header-info {
  padding: 16px 24px;
  position: relative;
}

.c-name {
  font-size: 22px;
  font-weight: 600;
  color: $text-main;
  margin: 0 0 6px;
}

.c-desc {
  font-size: 14px;
  color: $text-sec;
  margin: 0 0 8px;
  line-height: 1.5;
}

.c-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: $text-sec;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.join-btn {
  background: var(--el-color-primary);
  color: var(--app-button-text-on-primary); /* 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色 */
  border: none;
  border-radius: var(--global-border-radius);
  padding: 6px 16px;
  font-size: 14px;
  cursor: pointer;
}

.post-section {
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

.post-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: var(--unified-border-bottom);
}

.post-textarea {
  padding: 10px 12px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  outline: none;
  resize: vertical;
  font-family: inherit;
}

.post-textarea:focus {
  border-color: var(--border-unified-color-hover);
}

.post-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.post-item {
  padding: 12px 0;
  border-bottom: var(--unified-border-bottom);
}

.post-item:last-child {
  border-bottom: none;
}

.p-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.p-author {
  font-size: 14px;
  font-weight: 500;
  color: $text-main;
}

.flag {
  font-size: 11px;
  padding: 1px 6px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
  border-radius: var(--global-border-radius);
}

.flag-essence {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.p-time {
  margin-left: auto;
  font-size: 12px;
  color: $text-sec;
}

.p-title {
  font-size: 15px;
  font-weight: 500;
  color: $text-main;
  margin: 0 0 4px;
}

.p-content {
  font-size: 14px;
  color: $text-main;
  margin: 0 0 8px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.p-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  background: transparent;
  border: none;
  color: $text-sec;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.action-btn:hover {
  color: $brand-primary;
}

.action-btn.active {
  color: var(--el-color-danger);
}

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
