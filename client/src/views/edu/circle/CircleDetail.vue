<template>
  <!--
    CircleDetail.vue — 圈子详情页
    路由: EduCircleDetail (/edu/circle/detail/:circleId)
    功能: 圈子信息头 + 退出圈子 + 帖子列表(内容/图片/点赞/评论数/时间) + 发帖输入框
  -->
  <div class="circle-detail">
    <!-- ① 页头 -->
    <header class="page-header">
      <div class="header-text">
        <el-button :icon="ArrowLeft" text @click="goBack">
          {{ t('edu.circle.title') }}
        </el-button>
        <h1 class="page-title">{{ t('edu.circle.detailTitle') }}</h1>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadAll">
          {{ t('edu.profile.retry') }}
        </el-button>
        <el-button
          v-if="circle"
          type="danger"
          plain
          :icon="CircleClose"
          :loading="leaving"
          @click="handleLeave"
        >
          {{ t('edu.circle.leave') }}
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

    <div v-loading="loading" class="detail-body">
      <!-- ③ 圈子信息头 -->
      <section v-if="circle" class="circle-hero">
        <div class="hero-cover">
          <el-image v-if="circle.cover" :src="circle.cover" fit="cover" class="hero-img">
            <template #error>
              <div class="hero-placeholder">
                <el-icon :size="36"><Picture /></el-icon>
              </div>
            </template>
          </el-image>
          <div v-else class="hero-placeholder">
            <el-icon :size="36"><Picture /></el-icon>
          </div>
        </div>
        <div class="hero-info">
          <div class="hero-head">
            <h2 class="hero-name">{{ circle.name }}</h2>
            <el-tag v-if="!circle.is_public" size="small" type="info" effect="plain" class="private-tag">
              {{ t('edu.circle.isPublic') }}
            </el-tag>
          </div>
          <p class="hero-desc">{{ circle.description || circle.name }}</p>
          <div class="hero-stats">
            <span class="stat-item">
              <el-icon><User /></el-icon>
              {{ t('edu.circle.memberCount', { n: circle.member_count }) }}
            </span>
            <span class="stat-item">
              <el-icon><Document /></el-icon>
              {{ t('edu.circle.postCount', { n: circle.post_count }) }}
            </span>
          </div>
        </div>
      </section>

      <!-- ④ 发帖输入框 -->
      <section v-if="circle" class="post-form">
        <h3 class="section-title">{{ t('edu.circle.createPost') }}</h3>
        <el-input
          v-model="postContent"
          type="textarea"
          :rows="3"
          :placeholder="t('edu.circle.postContent')"
          maxlength="1000"
          show-word-limit
        />
        <div class="form-actions">
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="!postContent.trim()"
            :icon="Promotion"
            @click="handleSubmitPost"
          >
            {{ t('edu.circle.createPost') }}
          </el-button>
        </div>
      </section>

      <!-- ⑤ 帖子列表 -->
      <section class="posts-section">
        <h3 class="section-title">
          {{ t('edu.circle.posts') }}
          <span v-if="posts.length" class="count-badge">{{ posts.length }}</span>
        </h3>

        <el-empty v-if="!loading && posts.length === 0" :description="t('edu.circle.noPosts')" />

        <div v-else class="post-cards">
          <article
            v-for="p in posts"
            :key="p.id"
            class="post-card"
          >
            <div class="post-content">{{ p.content }}</div>
            <div v-if="p.images && p.images.length" class="post-images">
              <el-image
                v-for="(img, idx) in p.images"
                :key="idx"
                :src="img"
                fit="cover"
                :preview-src-list="p.images"
                :initial-index="idx"
                preview-teleported
                class="post-img"
              >
                <template #error>
                  <div class="img-fallback">
                    <el-icon><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
            </div>
            <div class="post-footer">
              <span class="post-time">
                <el-icon><Clock /></el-icon>
                {{ p.created_at }}
              </span>
              <div class="post-actions">
                <el-button
                  size="small"
                  :icon="Pointer"
                  :loading="likingId === p.id"
                  @click="handleLikePost(p)"
                >
                  {{ t('edu.circle.like') }} {{ p.like_count }}
                </el-button>
                <el-button
                  size="small"
                  :icon="ChatDotRound"
                  @click="goPost(p.id)"
                >
                  {{ t('edu.circle.comments') }} {{ p.comment_count }}
                </el-button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft, Refresh, CircleClose, Picture, User, Document,
  Promotion, Clock, Pointer, ChatDotRound,
} from '@element-plus/icons-vue'
import { circleApi, type EduCircle, type EduCirclePost } from '@/api/edu'

const props = defineProps<{ circleId?: string }>()

const { t } = useI18n()
const router = useRouter()

const circle = ref<EduCircle | null>(null)
const posts = ref<EduCirclePost[]>([])
const loading = ref(false)
const error = ref(false)
const leaving = ref(false)
const postContent = ref('')
const submitting = ref(false)
const likingId = ref<number | null>(null)

const circleIdNum = computed(() => {
  const n = Number(props.circleId)
  return Number.isFinite(n) && n > 0 ? n : 0
})

async function loadCircle() {
  if (!circleIdNum.value) return
  try {
    const res = await circleApi.getCircle(circleIdNum.value)
    circle.value = res.data.data ?? null
  } catch {
    error.value = true
  }
}

async function loadPosts() {
  if (!circleIdNum.value) return
  try {
    const res = await circleApi.listPosts(circleIdNum.value, { order_by: 'latest' })
    const payload = res.data.data
    posts.value = payload?.items ?? []
  } catch {
    error.value = true
  }
}

async function loadAll() {
  loading.value = true
  error.value = false
  try {
    await Promise.all([loadCircle(), loadPosts()])
  } finally {
    loading.value = false
  }
}

async function handleSubmitPost() {
  if (!postContent.value.trim() || !circleIdNum.value) return
  submitting.value = true
  try {
    await circleApi.createPost(circleIdNum.value, { content: postContent.value.trim() })
    ElMessage.success(t('edu.profile.submit'))
    postContent.value = ''
    await loadPosts()
  } catch {
    ElMessage.error(t('edu.profile.loadFailed'))
  } finally {
    submitting.value = false
  }
}

async function handleLikePost(p: EduCirclePost) {
  likingId.value = p.id
  try {
    const res = await circleApi.likePost(p.id)
    const count = res.data.data?.like_count
    if (typeof count === 'number') {
      p.like_count = count
    } else {
      p.like_count += 1
    }
  } catch {
    ElMessage.error(t('edu.profile.loadFailed'))
  } finally {
    likingId.value = null
  }
}

async function handleLeave() {
  if (!circleIdNum.value) return
  try {
    await ElMessageBox.confirm(t('edu.circle.leaveConfirm'), t('edu.circle.leave'), {
      type: 'warning',
      confirmButtonText: t('edu.profile.submit'),
      cancelButtonText: t('edu.profile.cancel'),
    })
    leaving.value = true
    await circleApi.leaveCircle(circleIdNum.value)
    ElMessage.success(t('edu.circle.leaveSuccess'))
    router.push({ name: 'EduCircle' })
  } catch {
    // 用户取消或操作失败
  } finally {
    leaving.value = false
  }
}

function goBack() {
  router.push({ name: 'EduCircle' })
}

function goPost(postId: number) {
  router.push({ name: 'EduCirclePost', params: { postId: String(postId) } })
}

onMounted(loadAll)
</script>

<style scoped lang="scss">
.circle-detail {
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
  gap: 8px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.error-alert {
  margin: 0;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 200px;
}

.circle-hero {
  display: flex;
  gap: 20px;
  padding: 20px 24px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  flex-wrap: wrap;
}

.hero-cover {
  flex-shrink: 0;
  width: 140px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.hero-img,
.hero-placeholder {
  width: 100%;
  height: 100%;
}

.hero-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
}

.hero-info {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.hero-name {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.private-tag {
  border-radius: 8px;
}

.hero-desc {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

.hero-stats {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.post-form {
  padding: 20px 24px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.posts-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.post-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.post-card {
  padding: 16px 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s ease;
}

.post-card:hover {
  border-color: var(--el-border-color);
}

.post-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.post-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.post-img {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  cursor: pointer;
}

.img-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.post-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.post-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.post-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 640px) {
  .circle-hero {
    flex-direction: column;
  }

  .hero-cover {
    width: 100%;
    height: 140px;
  }
}
</style>
