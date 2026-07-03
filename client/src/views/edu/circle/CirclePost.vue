<template>
  <!--
    CirclePost.vue — 帖子详情页
    路由: EduCirclePost (/edu/circle/post/:postId)
    功能: 帖子内容 + 图片 + 点赞 + 评论列表(占位)
    说明: API 无单独获取帖子的接口，此处展示帖子内容与评论占位，保持简洁
  -->
  <div class="circle-post">
    <!-- ① 页头 -->
    <header class="page-header">
      <div class="header-text">
        <el-button :icon="ArrowLeft" text @click="goBack">
          {{ t('edu.circle.title') }}
        </el-button>
        <h1 class="page-title">{{ t('edu.circle.postDetail') }}</h1>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadPost">
          {{ t('edu.profile.retry') }}
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
      <!-- ③ 帖子主体 -->
      <section v-if="post" class="post-section">
        <div class="post-content">{{ post.content }}</div>
        <div v-if="post.images && post.images.length" class="post-images">
          <el-image
            v-for="(img, idx) in post.images"
            :key="idx"
            :src="img"
            fit="cover"
            :preview-src-list="post.images"
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
        <div class="post-meta">
          <span class="meta-item">
            <el-icon><Clock /></el-icon>
            {{ post.created_at }}
          </span>
        </div>
        <div class="post-actions">
          <el-button
            :type="liked ? 'primary' : 'default'"
            :icon="Pointer"
            :loading="liking"
            @click="handleLike"
          >
            {{ t('edu.circle.like') }} {{ post.like_count }}
          </el-button>
        </div>
      </section>

      <!-- ④ 评论列表(占位) -->
      <section class="comments-section">
        <h3 class="section-title">
          {{ t('edu.circle.comments') }}
          <span v-if="post" class="count-badge">{{ post.comment_count }}</span>
        </h3>
        <el-empty :description="t('edu.circle.comments')" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Refresh, Clock, Pointer, Picture } from '@element-plus/icons-vue'
import { circleApi, type EduCirclePost } from '@/api/edu'

const props = defineProps<{ postId?: string }>()

const { t } = useI18n()
const router = useRouter()

const post = ref<EduCirclePost | null>(null)
const loading = ref(false)
const error = ref(false)
const liking = ref(false)
const liked = ref(false)

const postIdNum = computed(() => {
  const n = Number(props.postId)
  return Number.isFinite(n) && n > 0 ? n : 0
})

async function loadPost() {
  if (!postIdNum.value) return
  loading.value = true
  error.value = false
  try {
    // API 无单独获取帖子的接口，从圈子帖子列表中查找匹配项
    // 尝试通过已知圈子列表间接定位（保持简洁，失败则展示空状态）
    const listRes = await circleApi.listCircles({ page: 1, size: 50 })
    const circlesPayload = listRes.data.data
    const circles = circlesPayload?.items ?? []
    for (const c of circles) {
      try {
        const postsRes = await circleApi.listPosts(c.id, { page: 1, size: 100 })
        const postsPayload = postsRes.data.data
        const found = postsPayload?.items?.find((p) => p.id === postIdNum.value)
        if (found) {
          post.value = found
          return
        }
      } catch {
        // 单个圈子加载失败，继续尝试下一个
      }
    }
    // 未找到帖子，保留空状态
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function handleLike() {
  if (!post.value) return
  liking.value = true
  try {
    const res = await circleApi.likePost(post.value.id)
    const count = res.data.data?.like_count
    if (typeof count === 'number') {
      post.value.like_count = count
    } else {
      post.value.like_count += 1
    }
    liked.value = true
  } catch {
    ElMessage.error(t('edu.profile.loadFailed'))
  } finally {
    liking.value = false
  }
}

function goBack() {
  router.push({ name: 'EduCircle' })
}

onMounted(loadPost)
</script>

<style scoped lang="scss">
.circle-post {
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

.post-section {
  padding: 20px 24px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  width: 160px;
  height: 160px;
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

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.post-actions {
  display: flex;
  gap: 8px;
}

.comments-section {
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
</style>
