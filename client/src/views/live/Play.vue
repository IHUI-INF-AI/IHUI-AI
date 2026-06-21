<template>
  <div class="live-play-page page-container" v-loading="loading">
    <div v-if="!channel.id" class="empty">
      <el-empty :description="t('livePlay.liveNotFound')" />
    </div>
    <template v-else>
      <div class="play-wrap">
        <div class="player-section">
          <div class="player">
            <LearnVideo
              v-if="playUrl"
              :src="playUrl"
              :poster="channel.cover"
              autoplay
            />
            <div v-else class="offline">
              <div class="offline-icon">📡</div>
              <div class="offline-text">{{ t('livePlay.notLive') }}</div>
            </div>
          </div>
          <div class="meta">
            <h2 class="title">{{ channel.title }}</h2>
            <div class="host-row">
              <el-avatar :src="channel.hostAvatar" :size="32" />
              <span class="host-name">{{ channel.hostName || '—' }}</span>
              <el-button
                :type="channel.isSubscribed ? 'info' : 'primary'"
                size="small"
                @click="toggleSubscribe"
              >
                {{ channel.isSubscribed ? '已订阅' : '+ 订阅' }}
              </el-button>
            </div>
          </div>
        </div>

        <div class="side-section">
          <div class="tab-bar">
            <span class="tab" :class="{ active: tab === 'comment' }" @click="tab = 'comment'">
              弹幕({{ commentList.length }})
            </span>
            <span class="tab" :class="{ active: tab === 'gift' }" @click="tab = 'gift'">
              礼物
            </span>
            <span class="tab" :class="{ active: tab === 'info' }" @click="tab = 'info'">
              详情
            </span>
          </div>
          <div v-if="tab === 'comment'" class="comment-pane">
            <div class="comment-list">
              <div v-for="c in commentList" :key="c.id" class="comment-item">
                <span class="comment-user">{{ c.userName }}:</span>
                <span class="comment-content">{{ c.content }}</span>
              </div>
            </div>
            <div class="comment-input">
              <el-input
                v-model="newComment"
                placeholder="发条弹幕..."
                size="small"
                @keyup.enter="sendComment"
              >
                <template #append>
                  <el-button size="small" @click="sendComment">{{ t('livePlay.send') }}</el-button>
                </template>
              </el-input>
            </div>
          </div>
          <div v-else-if="tab === 'gift'" class="gift-pane">
            <div
              v-for="g in giftList"
              :key="g.id"
              class="gift-item"
              @click="sendGift(g)"
            >
              <div class="gift-icon">{{ g.icon || '🎁' }}</div>
              <div class="gift-name">{{ g.name }}</div>
              <div class="gift-price">{{ g.price }} 积分</div>
            </div>
          </div>
          <div v-else class="info-pane">
            <h3>直播介绍</h3>
            <p>{{ channel.description || '暂无介绍' }}</p>
            <h3>统计数据</h3>
            <p>观看:{{ channel.viewNum || 0 }}</p>
            <p>点赞:{{ channel.likeNum || 0 }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import LearnVideo from '@/components/learn/Video.vue'
import { liveApi } from '@/api/live'

const { t } = useI18n()
const route = useRoute()
const id = String(route.params.id || '')

const channel = ref<any>({})
const commentList = ref<any[]>([])
const giftList = ref<any[]>([])
const loading = ref(false)
const tab = ref<'comment' | 'gift' | 'info'>('comment')
const newComment = ref('')

const playUrl = computed(() => {
  return channel.value?.playUrlHls || channel.value?.playUrlFlv || channel.value?.pullUrl || ''
})

async function loadChannel() {
  loading.value = true
  try {
    const res: any = await liveApi.detail(id)
    channel.value = res.data || {}
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  const res: any = await liveApi.commentList(id)
  commentList.value = res.data?.items || res.data?.list || []
}

async function loadGifts() {
  try {
    const res: any = await liveApi.giftList()
    giftList.value = res.data || []
  } catch {
    ElMessage.error('礼物列表加载失败')
  }
}

async function sendComment() {
  if (!newComment.value.trim()) return
  const content = newComment.value
  const item = {
    id: Date.now().toString(),
    userName: '我',
    content,
  }
  commentList.value.push(item)
  newComment.value = ''
  try {
    await liveApi.commentSubmit({ channelId: id, content, type: 'text' })
  } catch {
    commentList.value = commentList.value.filter((c) => c.id !== item.id)
    ElMessage.error('评论发送失败')
  }
}

async function sendGift(g: any) {
  try {
    await liveApi.giftSend({ channelId: id, giftId: g.id, count: 1 })
    ElMessage.success(`送出 ${g.name} x1`)
  } catch {
    ElMessage.error('礼物发送失败')
  }
}

async function toggleSubscribe() {
  try {
    if (channel.value.isSubscribed) {
      await liveApi.unsubscribe(id)
      channel.value.isSubscribed = false
    } else {
      await liveApi.subscribe(id)
      channel.value.isSubscribed = true
    }
  } catch {
    ElMessage.error('操作失败，请重试')
  }
}

onMounted(() => {
  loadChannel()
  loadComments()
  loadGifts()
})
</script>

<style lang="scss" scoped>
:where(.live-play-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.play-wrap) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 12px;
  display: flex;
  gap: 16px;

  @media (width <= 768px) {
    flex-direction: column;
  }
}

:where(.player-section) {
  flex: 1;
  min-width: 0;
}

:where(.player) {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--color-video-bg);
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

:where(.offline) {
  text-align: center;
  color: var(--el-color-white);
}

:where(.offline-icon) {
  font-size: 64px;
}

:where(.meta) {
  padding: 16px 0;
}

:where(.title) {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

:where(.host-row) {
  display: flex;
  align-items: center;
  gap: 12px;
}

:where(.host-name) {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
}

:where(.side-section) {
  width: 320px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}

:where(.tab-bar) {
  display: flex;
  border-bottom: var(--unified-border-bottom);
}

:where(.tab) {
  flex: 1;
  padding: 12px;
  text-align: center;
  font-size: 13px;
  cursor: pointer;
  color: var(--el-text-color-regular);

  &.active {
    color: var(--el-color-primary);
    font-weight: 500;
    border-bottom: 2px solid var(--el-color-primary);
  }
}

:where(.comment-pane) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

:where(.comment-list) {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

:where(.comment-item) {
  font-size: 13px;
  padding: 4px 0;
}

:where(.comment-user) {
  color: var(--el-color-primary);
  margin-right: 4px;
}

:where(.comment-input) {
  border-top: var(--unified-border);
  padding: 8px;
}

:where(.gift-pane) {
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  overflow-y: auto;
}

:where(.gift-item) {
  text-align: center;
  padding: 8px 4px;
  border-radius: var(--global-border-radius);
  cursor: pointer;

  &:hover {
    background: var(--el-fill-color-lighter);
  }
}

:where(.gift-icon) {
  font-size: 32px;
}

:where(.gift-name) {
  font-size: 12px;
}

:where(.gift-price) {
  font-size: 11px;
  color: var(--el-color-primary);
}

:where(.info-pane) {
  padding: 12px;
  font-size: 13px;

  h3 {
    font-size: 14px;
    margin: 12px 0 4px;
  }

  p {
    margin: 4px 0;
    color: var(--el-text-color-regular);
  }
}
</style>
