<template>
  <div class="live-room">
    <!-- ① 页面头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.live.roomTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.live.roomSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadRoom">
          {{ t('edu.common.retry') }}
        </el-button>
        <el-button type="danger" :icon="Close" @click="handleLeave">
          {{ t('edu.live.leaveLive') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.common.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <div v-loading="loading" class="room-body">
      <!-- ② 视频播放区 -->
      <section class="player-section">
        <div v-if="room?.stream_url || room?.playback_url" class="player-wrap">
          <video
            ref="videoRef"
            class="player-video"
            :src="room?.stream_url || room?.playback_url"
            controls
            autoplay
            playsinline
          />
          <div v-if="room?.status === 'live'" class="live-badge">
            <span class="live-dot"></span>
            {{ t('edu.live.liveNow') }}
          </div>
        </div>
        <el-empty
          v-else
          :description="room?.status === 'ended' ? t('edu.live.noPlayback') : t('edu.live.notStarted')"
          class="player-empty"
        />
      </section>

      <!-- ③ 直播信息卡 -->
      <section v-if="room" class="info-card">
        <h2 class="info-title">{{ room.title }}</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ t('edu.live.teacher') }}</span>
            <span class="info-value">#{{ room.teacher_id }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.live.startTime') }}</span>
            <span class="info-value">{{ formatTime(room.scheduled_start) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.live.endTime') }}</span>
            <span class="info-value">{{ formatTime(room.scheduled_end) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.order.status') }}</span>
            <el-tag :type="statusTagType(room.status)" effect="light" size="small">
              {{ statusLabel(room.status) }}
            </el-tag>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('edu.live.attendeeCount', { n: room.attendee_count }) }}</span>
            <span class="info-value">
              {{ room.attendee_count }}{{ room.max_attendees ? ` / ${room.max_attendees}` : '' }}
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Refresh, Close } from '@element-plus/icons-vue'
import { liveApi } from '@/api/edu'
import type { EduLiveRoom } from '@/api/edu'

const props = defineProps<{ roomId?: string }>()

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const error = ref(false)
const room = ref<EduLiveRoom | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const joined = ref(false)

function resolveRoomId(): number {
  const raw = props.roomId
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

async function loadRoom() {
  const id = resolveRoomId()
  if (!id) {
    error.value = true
    return
  }
  loading.value = true
  error.value = false
  try {
    const res = await liveApi.getRoom(id)
    room.value = res.data?.data ?? null
  } catch (_e) {
    error.value = true
    room.value = null
  } finally {
    loading.value = false
  }
}

async function joinRoom() {
  const id = resolveRoomId()
  if (!id) return
  try {
    await liveApi.joinLive(id)
    joined.value = true
  } catch (_e) {
    // 加入失败不阻断观看，静默处理
  }
}

async function leaveRoom() {
  const id = resolveRoomId()
  if (!id || !joined.value) return
  try {
    await liveApi.leaveLive(id)
  } catch (_e) {
    // 离开失败静默处理
  } finally {
    joined.value = false
  }
}

async function handleLeave() {
  await leaveRoom()
  router.back()
}

function statusLabel(status: EduLiveRoom['status']): string {
  const map: Record<EduLiveRoom['status'], string> = {
    scheduled: t('edu.live.statusScheduled'),
    live: t('edu.live.statusLive'),
    ended: t('edu.live.statusEnded'),
    cancelled: t('edu.live.statusCancelled'),
  }
  return map[status] || status
}

function statusTagType(status: EduLiveRoom['status']): 'danger' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'live':
      return 'danger'
    case 'scheduled':
      return 'warning'
    case 'ended':
      return 'info'
    case 'cancelled':
      return 'info'
    default:
      return 'info'
  }
}

function formatTime(value: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(async () => {
  await loadRoom()
  await joinRoom()
})

onUnmounted(() => {
  // 组件卸载时自动离开
  void leaveRoom()
})
</script>

<style scoped lang="scss">
.live-room {
  display: flex;
  flex-direction: column;
  gap: 20px;
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
  font-size: 22px;
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

.room-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 200px;
}

.player-section {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.player-wrap {
  position: relative;
  width: 100%;
  /* stylelint-disable color-no-hex -- 视频播放器底色必须黑 */
  background: #000;
  /* stylelint-enable color-no-hex */
  aspect-ratio: 16 / 9;
}

.player-video {
  width: 100%;
  height: 100%;
  display: block;
  /* stylelint-disable color-no-hex -- 视频播放器底色必须黑 */
  background: #000;
  /* stylelint-enable color-no-hex */
}

.live-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgb(245 108 108 / 0.9);
  /* stylelint-disable color-no-hex -- 直播徽章白字 */
  color: #fff;
  /* stylelint-enable color-no-hex */
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
}

.live-dot {
  width: 6px;
  height: 6px;
  /* stylelint-disable color-no-hex -- 直播闪烁点白 */
  background: #fff;
  /* stylelint-enable color-no-hex */
  border-radius: 50%;
  animation: live-blink 1.2s infinite;
}

@keyframes live-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.player-empty {
  background: var(--el-bg-color);
  padding: 60px 0;
}

.info-card {
  padding: 20px 24px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.info-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.info-value {
  font-size: 14px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* 禁止蓝光边框 */
:deep(.el-button:focus-visible) {
  outline: none;
  box-shadow: none;
}

@media (width <= 640px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
