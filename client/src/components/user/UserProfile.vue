<template>
  <div class="user-profile">
    <div class="profile-header">
      <div class="avatar-section">
        <img v-if="user?.avatar" :src="user.avatar" :alt="user?.nickname || 'User'" class="avatar" />
        <div v-else class="avatar avatar-placeholder">{{ userInitial }}</div>
        <button v-if="editable" class="btn-change-avatar" @click="handleChangeAvatar">
          {{ t('userComponents.profile.editProfile') }}
        </button>
      </div>
      <div class="info-section">
        <h2 class="user-name">{{ user?.nickname || user?.username || 'User' }}</h2>
        <p class="user-id">ID: {{ user?.id || '-' }}</p>
        <div class="user-badges" v-if="showBadges">
          <span v-if="user?.isVip" class="badge vip">VIP</span>
          <span v-if="user?.isAdmin" class="badge admin">{{ t('userComponents.profile.admin') }}</span>
        </div>
      </div>
    </div>
    
    <div class="profile-body">
      <div class="info-item">
        <span class="label">{{ t('userComponents.profile.email') }}:</span>
        <span class="value">{{ user?.email || t('commonText.status.pending') }}</span>
      </div>
      <div class="info-item">
        <span class="label">{{ t('userComponents.profile.phone') }}:</span>
        <span class="value">{{ user?.phone || t('commonText.status.pending') }}</span>
      </div>
      <div class="info-item">
        <span class="label">{{ t('userComponents.profile.registerTime') }}:</span>
        <span class="value">{{ formatDate(user?.createTime) }}</span>
      </div>
    </div>
    
    <div class="profile-footer" v-if="editable">
      <el-button type="primary" @click="handleEdit">{{ t('userComponents.profile.editProfile') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTime } from '@/utils/format'

const { t } = useI18n()

interface User {
  id?: string
  nickname?: string
  username?: string
  avatar?: string
  email?: string
  phone?: string
  isVip?: boolean
  isAdmin?: boolean
  createTime?: string
}

const props = defineProps<{
  user?: User | null
  editable?: boolean
  showBadges?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'change-avatar'): void
}>()

const userInitial = computed(() => {
  const name = props.user?.nickname || props.user?.username || 'User'
  return name.charAt(0).toUpperCase()
})

const formatDate = (date?: string) => {
  if (!date) return '-'
  return formatTime(date, 'YYYY-MM-DD')
}

const handleEdit = () => {
  emit('edit')
}

const handleChangeAvatar = () => {
  emit('change-avatar')
}
</script>

<style scoped>
.user-profile {
  background: var(--bg-card);
  border-radius: var(--global-border-radius);
  padding: 24px;
  }

.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: var(--unified-border-bottom);
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  color: var(--el-bg-color-page);
  font-size: 32px;
  font-weight: 700;
}

.btn-change-avatar {
  padding: 4px 12px;
  font-size: 12px;
  color: var(--primary-color);
  background: transparent;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.btn-change-avatar:hover {
  background: var(--primary-color);
  color: var(--el-bg-color-page);
}

.info-section {
  flex: 1;
}

.user-name {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.user-id {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.user-badges {
  display: flex;
  gap: 8px;
}

.badge {
  padding: 2px 8px;
  font-size: 12px;
  border-radius: var(--global-border-radius);
}

.badge.vip {
  background: var(--color-yellow-ffd700);
  color: var(--color-brown-8b6914);
}

.badge.admin {
  background: var(--danger-color);
  color: var(--el-bg-color-page);
}

.profile-body {
  margin-bottom: 24px;
}

.info-item {
  display: flex;
  padding: 12px 0;
  border-bottom: var(--unified-border-bottom);
}

.info-item:last-child {
  border-bottom: none;
}

.label {
  width: 100px;
  color: var(--text-secondary);
  font-size: 14px;
}

.value {
  flex: 1;
  color: var(--text-primary);
  font-size: 14px;
}

.profile-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
