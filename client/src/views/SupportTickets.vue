<template>
  <div class="support-tickets" role="main" aria-labelledby="support-tickets-heading">
    <div class="support-tickets-content">
      <h2 id="support-tickets-heading" class="support-tickets-title">{{ t('supportTickets.title') }}</h2>
      <p class="support-tickets-message">{{ t('supportTickets.merged') }}</p>
      <div class="support-tickets-actions">
        <el-button type="primary" @click="goToFeedback">{{ t('supportTickets.goToFeedback') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

defineOptions({ name: 'SupportTickets' })

const { t } = useI18n()
const router = useRouter()

const goToFeedback = () => {
  router.push('/feedback')
}
</script>

<style scoped lang="scss">
.support-tickets {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
}

.support-tickets-content {
  text-align: center;
  width: 100%;
  max-width: 480px;
}

.support-tickets-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 16px;
  line-height: 1.4;
}

.support-tickets-message {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  margin: 0 0 32px;
  line-height: 1.6;
}

.support-tickets-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

@media (width <= 768px) {
  .support-tickets-title {
    font-size: 22px;
  }

  .support-tickets-message {
    font-size: 14px;
  }

  .support-tickets-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
