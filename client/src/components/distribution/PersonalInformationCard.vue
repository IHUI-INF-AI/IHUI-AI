<template>
  <div class="personal-card-container">
    <div class="personal-card-header">
      <div class="user-info">
        <div class="nickname-wrapper">
          <span class="nickname-label">{{ t('distribution.personalInfo.aiIhui') }}</span>
          <span class="nickname">{{
            userData?.nickname || t('distribution.personalInfo.user')
          }}</span>
        </div>
        <el-avatar :src="avatarUrl" :size="60" />
      </div>
    </div>

    <div class="income-section">
      <div class="income-item">
        <span class="income-label">{{
          t('distribution.personalInfo.totalCompanyPerformance')
        }}</span>
        <span class="income-value">{{ formatPrice(data.totalIncome || 0) }}</span>
      </div>
      <div class="income-row">
        <div class="income-item">
          <span class="income-label">{{ t('distribution.personalInfo.companyIncome') }}</span>
          <span class="income-value">{{ formatPrice(data.currentAmount || 0) }}</span>
        </div>
        <el-button
          type="primary"
          :disabled="!data.currentAmount || data.currentAmount <= 0"
          @click="handleWithdrawal"
        >
          {{ t('distribution.personalInfo.withdrawal') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import type { OperatorDataCardData } from '@/api/distribution/distribution'

interface Props {
  data: OperatorDataCardData
}

const { t } = useI18n()
const props = defineProps<Props>()
const emit = defineEmits<{
  withdrawal: []
}>()

const router = useRouter()
const authStore = useAuthStore()
const { showWarning } = useOperationFeedback()

const userData = computed(() => {
  return props.data.user || authStore.user
})

const avatarUrl = computed(() => {
  if (props.data.user?.avatar) {
    return props.data.user.avatar
  }
  const user = authStore.user
  if (user && typeof user === 'object' && 'avatar' in user) {
    return (user.avatar as string) || '/images/common/userIcon.svg'
  }
  return '/images/common/userIcon.svg'
})

const formatPrice = (value: number): string => {
  if (value >= 10000) {
    return (value / 10000).toFixed(2) + 'w'
  }
  return value.toFixed(2)
}

const handleWithdrawal = () => {
  const amount = props.data.currentAmount || 0
  if (amount <= 0) {
    showWarning(t('distribution.personalInfo.withdrawZeroAmount'))
    return
  }

  const authInfo = authStore.authInfo as { realName?: string; idCard?: string } | null

  if (!authInfo || !authInfo.realName && !authInfo.idCard) {
    showWarning(t('distribution.personalInfo.needRealAuth'))
    emit('withdrawal')
    return
  }

  router.push('/withdrawal/apply?amount=' + amount)
}
</script>

<style scoped lang="scss">
.personal-card-container {
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  border-radius: var(--global-border-radius);
  padding: 30px;
  margin-bottom: 20px;
  background-image: url('https://file.aizhs.top/sys-mini/default/bjcspNew.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.personal-card-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 40px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nickname-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nickname-label {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.nickname {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.income-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.income-item {
  display: flex;
  align-items: center;
  font-size: 16px;
}

.income-label {
  color: var(--el-text-color-primary);
  margin-right: 8px;
}

.income-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.income-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
