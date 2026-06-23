<template>
  <div class="live-detail-page page-container" v-loading="loading">
    <div v-if="!channel.id" class="empty">
      <el-empty :description="t('livePlay.liveNotFound')" />
    </div>
    <template v-else>
      <div class="hero">
        <div class="cover">
          <img :src="channel.cover" :alt="channel.title" loading="lazy" />
          <div v-if="channel.status === 1" class="live-overlay">
            <div class="live-tag">● {{ t('liveDetail.liveNow') }}</div>
            <div class="online-num">{{ channel.onlineNum || 0 }} {{ t('liveDetail.peopleOnline') }}</div>
          </div>
          <el-button v-else type="primary" size="large" @click="goPlay">{{ t('liveDetail.enterLive') }}</el-button>
        </div>
        <div class="info">
          <h1 class="title">{{ channel.title }}</h1>
          <p v-if="channel.description" class="desc">{{ channel.description }}</p>
          <div class="host-row">
            <el-avatar :src="channel.hostAvatar" :size="40" />
            <div class="host-info">
              <div class="host-name">{{ channel.hostName || '—' }}</div>
              <div class="host-meta">{{ t('liveDetail.host') }}</div>
            </div>
          </div>
          <div class="action-row">
            <el-button
              :type="channel.isSubscribed ? 'info' : 'primary'"
              @click="toggleSubscribe"
            >
              {{ channel.isSubscribed ? '已订阅' : '订阅' }}
            </el-button>
            <el-button @click="handleLike">♥ {{ channel.likeNum || 0 }}</el-button>
            <el-button v-if="channel.status === 1" type="success" @click="goPlay">{{ t('liveDetail.enterLiveRoom') }}</el-button>
          </div>
          <div class="time-row">
            <span v-if="channel.status === 0">{{ t('liveDetail.startTime') }}:{{ channel.planStartTime }}</span>
            <span v-else-if="channel.status === 1">{{ t('liveDetail.beginTime') }}:{{ channel.startTime }}</span>
            <span v-else>{{ t('liveDetail.playback') }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { liveApi } from '@/api/live'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const id = String(route.params.id || '')

const channel = ref<any>({})
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await liveApi.detail(id)
    channel.value = res.data || {}
  } finally {
    loading.value = false
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
    ElMessage.error(t('common.errors.operationFailedRetry'))
  }
}

async function handleLike() {
  const prev = channel.value.likeNum || 0
  channel.value.likeNum = prev + 1
  try {
    await liveApi.like(id)
    ElMessage.success(t('common.messages.likeSuccess'))
  } catch {
    channel.value.likeNum = prev
    ElMessage.error(t('common.errors.likeFailed'))
  }
}

function goPlay() {
  router.push({ path: `/live/${id}/play` })
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.live-detail-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.hero) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 24px 12px;
  display: flex;
  gap: 32px;

  @media (width <= 768px) {
    flex-direction: column;
  }
}

:where(.cover) {
  position: relative;
  width: 540px;
  flex-shrink: 0;
  aspect-ratio: 16 / 9;
  background: var(--color-video-bg);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (width <= 768px) {
    width: 100%;
  }
}

:where(.live-overlay) {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent, var(--color-black-60));
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  color: var(--el-color-white);
}

:where(.live-tag) {
  align-self: flex-start;
  padding: 4px 12px;
  background: var(--el-color-danger);
  border-radius: var(--global-border-radius);
  font-size: 12px;
}

:where(.online-num) {
  font-size: 13px;
}

:where(.info) {
  flex: 1;
}

:where(.title) {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 600;
}

:where(.desc) {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

:where(.host-row) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  margin-bottom: 16px;
}

:where(.host-name) {
  font-size: 14px;
  font-weight: 500;
}

:where(.host-meta) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.action-row) {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

:where(.time-row) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
