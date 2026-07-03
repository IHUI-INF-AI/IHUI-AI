<template>
  <div class="live-list">
    <!-- ① 页面头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.live.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.live.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadRooms">
          {{ t('edu.common.retry') }}
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

    <!-- ② 状态筛选 -->
    <div class="filter-bar">
      <el-radio-group v-model="filterStatus" @change="handleFilterChange">
        <el-radio-button value="">{{ t('edu.live.filterAll') }}</el-radio-button>
        <el-radio-button value="scheduled">{{ t('edu.live.filterScheduled') }}</el-radio-button>
        <el-radio-button value="live">{{ t('edu.live.filterLive') }}</el-radio-button>
        <el-radio-button value="ended">{{ t('edu.live.filterEnded') }}</el-radio-button>
      </el-radio-group>
    </div>

    <!-- ③ 直播卡片列表 -->
    <div v-loading="loading" class="rooms-body">
      <div v-if="rooms.length" class="rooms-grid">
        <el-card
          v-for="room in rooms"
          :key="room.id"
          class="room-card"
          shadow="hover"
        >
          <div class="room-card-header">
            <span class="room-title" :title="room.title">{{ room.title }}</span>
            <el-tag
              :type="statusTagType(room.status)"
              effect="light"
              size="small"
            >
              {{ statusLabel(room.status) }}
            </el-tag>
          </div>

          <div class="room-meta">
            <div class="meta-line">
              <span class="meta-label">{{ t('edu.live.teacher') }}:</span>
              <span class="meta-value">#{{ room.teacher_id }}</span>
            </div>
            <div class="meta-line">
              <span class="meta-label">{{ t('edu.live.startTime') }}:</span>
              <span class="meta-value">{{ formatTime(room.scheduled_start) }}</span>
            </div>
            <div class="meta-line">
              <el-icon><View /></el-icon>
              <span class="meta-value">
                {{ t('edu.live.attendeeCount', { n: room.attendee_count }) }}
              </span>
              <span v-if="room.max_attendees" class="meta-sub">
                / {{ t('edu.live.maxAttendees', { n: room.max_attendees }) }}
              </span>
            </div>
          </div>

          <div class="room-actions">
            <el-button
              v-if="room.status === 'live'"
              type="danger"
              size="small"
              @click="enterRoom(room.id)"
            >
              {{ t('edu.live.joinLive') }}
            </el-button>
            <el-button
              v-else-if="room.status === 'ended' && room.playback_url"
              type="primary"
              size="small"
              plain
              @click="enterRoom(room.id)"
            >
              {{ t('edu.live.playback') }}
            </el-button>
            <el-button
              v-else-if="room.status === 'ended'"
              size="small"
              disabled
            >
              {{ t('edu.live.noPlayback') }}
            </el-button>
            <el-button
              v-else
              size="small"
              disabled
            >
              {{ t('edu.live.notStarted') }}
            </el-button>
          </div>
        </el-card>
      </div>

      <!-- 空状态 -->
      <el-empty
        v-else-if="!loading"
        :description="t('edu.profile.empty')"
        class="empty-state"
      />
    </div>

    <!-- ④ 分页 -->
    <div v-if="total > 0" class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="loadRooms"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Refresh, View } from '@element-plus/icons-vue'
import { liveApi } from '@/api/edu'
import type { EduLiveRoom } from '@/api/edu'

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const error = ref(false)
const rooms = ref<EduLiveRoom[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const filterStatus = ref<string>('')

async function loadRooms() {
  loading.value = true
  error.value = false
  try {
    const res = await liveApi.listRooms({
      page: page.value,
      size: size.value,
      status: filterStatus.value || undefined,
    })
    const data = res.data?.data
    if (data) {
      rooms.value = data.items
      total.value = data.total
    } else {
      rooms.value = []
      total.value = 0
    }
  } catch (_e) {
    error.value = true
    rooms.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  page.value = 1
  loadRooms()
}

function handleSizeChange() {
  page.value = 1
  loadRooms()
}

function enterRoom(roomId: number) {
  router.push({ name: 'EduLiveRoom', params: { roomId: String(roomId) } })
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

onMounted(loadRooms)
</script>

<style scoped lang="scss">
.live-list {
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

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.rooms-body {
  min-height: 200px;
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.room-card {
  border-radius: 8px;
  transition: border-color 0.2s ease;

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
}

.room-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.room-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.room-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.meta-line {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-regular);
}

.meta-label {
  color: var(--el-text-color-secondary);
}

.meta-value {
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.meta-sub {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.room-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.empty-state {
  padding: 40px 0;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
}

/* 禁止蓝光边框：focus 时仅 border-color 过渡 */
:deep(.el-radio-button__inner) {
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
  box-shadow: none !important;
}

:deep(.el-radio-button__original-radio:focus-visible + .el-radio-button__inner) {
  box-shadow: none !important;
}

:deep(.el-button:focus-visible) {
  outline: none;
  box-shadow: none;
}

@media (width <= 640px) {
  .rooms-grid {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
