<template>
  <div class="user-info-card">
    <div class="user-header">
      <div class="user-avatar" @click="handleAvatarClick">
        <img v-if="displayAvatar" :src="displayAvatar" :alt="displayNickname" />
        <div v-else class="avatar-placeholder">{{ userInitial }}</div>
        <div v-if="!isLoggedIn" class="login-hint" @click.stop="handleLoginClick">
          {{ t('userCenter.clickToLogin') }}
        </div>
      </div>
      <div class="user-details">
        <div class="user-name-row">
          <h3 class="user-name">{{ displayNickname }}</h3>
          <span v-if="userInfo?.isVip" class="vip-badge">
            {{ userInfo.memberLevelText || t('userCenter.vipMember') }}
          </span>
        </div>
        <p v-if="displayPhone" class="user-phone">{{ formatPhone(displayPhone) }}</p>
        <p v-else-if="!isLoggedIn" class="user-phone placeholder">
          {{ t('userCenter.notLoggedIn') }}
        </p>
      </div>
    </div>

    <div v-if="isLoggedIn && userInfo" class="user-stats">
      <div class="stat-item" @click="handleTokenClick">
        <span class="stat-value">{{ formatToken(userInfo.tokenQuantity || 0) }}</span>
        <span class="stat-label">{{ t('userCenter.tokenBalance') }}</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item" @click="handleLevelClick">
        <span class="stat-value">{{ userInfo.memberLevelText || t('userCenter.regularMember') }}</span>
        <span class="stat-label">{{ t('userCenter.memberLevel') }}</span>
      </div>
    </div>

    <div v-if="showRechargeBtn && isLoggedIn" class="user-actions">
      <button class="btn-recharge" @click="handleRecharge">
        {{ t('userCenter.recharge') }}
      </button>
      <button class="btn-edit" @click="handleEditProfile">
        {{ t('userComponents.infoCard.edit') }}
      </button>
    </div>

    <div v-if="!isLoggedIn" class="user-actions">
      <button class="btn-login" @click="handleLoginClick">
        {{ t('auth.login_register') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface UserInfo {
  uuid?: string
  openId?: string
  isLoggedIn: boolean
  username: string
  isVip: number | null
  knowledgeBaseQuota?: string
  remainingTokens?: string
  userId?: string
  avatarUrl?: string
  memberLevelText?: string
  nextLevelInfoText?: string
  identityType?: number
  tokenQuantity?: number
  phone?: string
  zhsToken?: string
  avatar?: string
  nickname?: string
}

const props = defineProps<{
  userInfo?: UserInfo | null
  showRechargeBtn?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit-profile'): void
  (e: 'update:login-out', data: UserInfo): void
  (e: 'open-level-introduce-popup'): void
  (e: 'open-introduce-popup'): void
  (e: 'open-introduce-popups'): void
  (e: 'open-privateadvisory-popup'): void
}>()

const isLoggedIn = computed(() => props.userInfo?.isLoggedIn ?? false)

const displayNickname = computed(() => {
  if (!isLoggedIn.value) return t('userCenter.notLoggedIn')
  return props.userInfo?.username || props.userInfo?.nickname || t('userCenter.defaultUsername')
})

const displayAvatar = computed(() => {
  return props.userInfo?.avatarUrl || props.userInfo?.avatar || ''
})

const displayPhone = computed(() => {
  return props.userInfo?.phone || ''
})

const userInitial = computed(() => {
  const name = displayNickname.value
  return name.charAt(0).toUpperCase()
})

const formatPhone = (phone: string) => {
  if (!phone) return ''
  if (phone.length >= 7) {
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4)
  }
  return phone
}

const formatToken = (value: number) => {
  if (value >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿'
  } else if (value >= 10000) {
    return (value / 10000).toFixed(2) + '万'
  }
  return value.toString()
}

const handleAvatarClick = () => {
  if (!isLoggedIn.value) {
    handleLoginClick()
  }
}

const handleLoginClick = () => {
  emit('update:login-out', {
    isLoggedIn: false,
    username: '',
    isVip: null,
    knowledgeBaseQuota: '',
    remainingTokens: '',
    userId: '',
    avatarUrl: '',
    memberLevelText: '',
    nextLevelInfoText: '',
    identityType: 0,
    tokenQuantity: 0,
  })
}

const handleEditProfile = () => {
  emit('edit-profile')
}

const handleRecharge = () => {
  window.location.href = '/top-up'
}

const handleTokenClick = () => {
  emit('open-introduce-popup')
}

const handleLevelClick = () => {
  if (props.userInfo?.isVip === 0) {
    emit('open-introduce-popup')
  } else if (props.userInfo?.isVip === 1) {
    emit('open-introduce-popups')
  } else {
    emit('open-privateadvisory-popup')
  }
}
</script>

<style scoped>
.user-info-card {
  padding: 20px;
  background: transparent;
}

.user-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  cursor: pointer;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary);
  color: var(--app-button-text-on-primary);
  font-size: 28px;
  font-weight: bold;
}

.login-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-black-60);
  color: var(--app-button-text-on-primary);
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.user-avatar:hover .login-hint {
  opacity: 1;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.user-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.vip-badge {
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  color: #1a1a1a;
  background: var(--color-amber-500);
  border-radius: var(--global-border-radius);
}

.user-phone {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.user-phone.placeholder {
  color: var(--el-text-color-placeholder);
}

.user-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px;
  cursor: pointer;
  transition: transform 0.2s;
}

.stat-item:hover {
  transform: scale(1.02);
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: var(--el-border-color);
}

.user-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  justify-content: center;
}

.btn-recharge,
.btn-edit,
.btn-login {
  padding: 10px 24px;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-recharge {
  background: var(--el-color-primary);
  color: var(--color-dark-bg-4);
}

.btn-recharge:hover {
  transform: translateY(-1px);
  box-shadow: var(--global-box-shadow);
}

.btn-edit {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.btn-edit:hover {
  background: var(--el-fill-color-dark);
}

.btn-login {
  background: var(--el-color-primary);
  color: var(--app-button-text-on-primary);
  padding: 12px 48px;
}

.btn-login:hover {
  transform: translateY(-1px);
  box-shadow: var(--global-box-shadow);
}
</style>
