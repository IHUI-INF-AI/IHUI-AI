<template>
  <div class="user-security">
    <h3 class="section-title">{{ t('userComponents.security.title') }}</h3>
    <div class="security-list">
      <div class="security-item">
        <div class="item-info">
          <el-icon :size="24"><Lock /></el-icon>
          <div class="item-detail">
            <h4>{{ t('userComponents.security.loginPassword') }}</h4>
            <p>{{ t('userComponents.security.loginPasswordDesc') }}</p>
          </div>
        </div>
        <el-button type="primary" plain @click="handleChangePassword">{{ t('userComponents.security.modify') }}</el-button>
      </div>
      
      <div class="security-item">
        <div class="item-info">
          <el-icon :size="24"><Phone /></el-icon>
          <div class="item-detail">
            <h4>{{ t('userComponents.security.phoneBinding') }}</h4>
            <p>{{ user?.phone ? maskPhone(user.phone) : t('userComponents.security.phoneBinding') }}</p>
          </div>
        </div>
        <el-button :type="user?.phone ? 'primary' : 'danger'" plain @click="handleBindPhone">
          {{ user?.phone ? t('userComponents.security.modify') : t('commonText.add') }}
        </el-button>
      </div>
      
      <div class="security-item">
        <div class="item-info">
          <el-icon :size="24"><Message /></el-icon>
          <div class="item-detail">
            <h4>{{ t('userComponents.security.emailBinding') }}</h4>
            <p>{{ user?.email ? maskEmail(user.email) : t('userComponents.security.emailBinding') }}</p>
          </div>
        </div>
        <el-button :type="user?.email ? 'primary' : 'danger'" plain @click="handleBindEmail">
          {{ user?.email ? t('userComponents.security.modify') : t('commonText.add') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Lock, Phone, Message } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface User {
  id?: string
  phone?: string
  email?: string
}

const _props = defineProps<{
  user?: User | null
}>()

const emit = defineEmits<{
  (e: 'change-password'): void
  (e: 'bind-phone'): void
  (e: 'bind-email'): void
}>()

const maskPhone = (phone: string) => {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

const maskEmail = (email: string) => {
  const [name, domain] = email.split('@')
  const maskedName = name.charAt(0) + '***' + name.charAt(name.length - 1)
  return `${maskedName}@${domain}`
}

const handleChangePassword = () => {
  emit('change-password')
}

const handleBindPhone = () => {
  emit('bind-phone')
}

const handleBindEmail = () => {
  emit('bind-email')
}
</script>

<style scoped>
.user-security {
  background: var(--bg-card);
  border-radius: var(--global-border-radius);
  padding: 24px;
  }

.section-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.security-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.security-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
}

.item-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.item-info .el-icon {
  color: var(--primary-color);
}

.item-detail h4 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.item-detail p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
