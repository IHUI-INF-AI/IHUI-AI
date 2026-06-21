<template>
  <div class="learn-payment-confirm-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="breadcrumbItems" />

    <div class="content">
      <div class="success-icon">✓</div>
      <h1 class="title">{{ t('learnPaymentConfirm.title') }}</h1>
      <p class="desc">{{ t('learnPaymentConfirm.desc') }}</p>
      <div class="actions">
        <el-button type="primary" size="large" @click="goLearn">{{ t('learnPaymentConfirm.startLearn') }}</el-button>
        <el-button size="large" @click="goList">{{ t('learnPaymentConfirm.viewMore') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const _orderId = String(route.query.orderId || '')

const breadcrumbItems = computed(() => [
  { title: '课程', path: '/learn' },
  { title: '支付完成' },
])

function goLearn() {
  router.push({ path: '/learn' })
}

function goList() {
  router.push({ path: '/learn/list' })
}
</script>

<style lang="scss" scoped>
:where(.learn-payment-confirm-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.content) {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 60px 12px;
  text-align: center;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  margin-top: 24px;
}

:where(.success-icon) {
  width: 80px;
  height: 80px;
  line-height: 80px;
  font-size: 48px;
  color: var(--el-color-white);
  background: var(--el-color-success);
  border-radius: 50%;
  margin: 0 auto 24px;
}

:where(.title) {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:where(.desc) {
  margin: 0 0 32px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

:where(.actions) {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
