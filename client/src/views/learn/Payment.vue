<template>
  <div class="learn-payment-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="[{ title: t('learnPayment.breadcrumbCourse'), path: '/learn' }, { title: t('learnPayment.breadcrumbPay') }]" />

    <div v-loading="loading" class="content">
      <el-empty v-if="!order.id" :description="t('learnPayment.notExist')" />
      <div v-else class="pay-wrap">
        <div class="qr-section">
          <div class="qr-placeholder">
            <div class="qr-icon">📱</div>
            <div class="qr-tip">{{ t('learnPayment.scanTip', { type: payTypeLabel }) }}</div>
          </div>
        </div>
        <div class="info-section">
          <h3 class="title">{{ t('learnPayment.orderDetail') }}</h3>
          <div class="info-row">
            <span>{{ t('learnPayment.orderId') }}</span>
            <span>{{ order.id }}</span>
          </div>
          <div class="info-row">
            <span>{{ t('learnPayment.payMethod') }}</span>
            <span>{{ payTypeLabel }}</span>
          </div>
          <div class="info-row total">
            <span>{{ t('learnPayment.amountDue') }}</span>
            <span class="price">¥{{ (order.amount || 0).toFixed(2) }}</span>
          </div>
          <el-button
            type="primary"
            size="large"
            :loading="paying"
            @click="handleSimulatePay"
          >
            {{ t('learnPayment.simulatePay') }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import { learnApi } from '@/api/learn'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const orderId = String(route.query.orderId || '')

const order = ref<any>({})
const loading = ref(false)
const paying = ref(false)
const payType = ref('alipay')

const payTypeLabel = computed(() => {
  return payType.value === 'wechat' ? t('learnPayment.wechat') : payType.value === 'balance' ? t('learnPayment.balance') : t('learnPayment.alipay')
})

async function load() {
  loading.value = true
  try {
    // 简化:直接用 orderId 构造订单对象
    order.value = { id: orderId, amount: 0, payType: payType.value }
  } finally {
    loading.value = false
  }
}

async function handleSimulatePay() {
  paying.value = true
  try {
    await learnApi.payOrder({ orderId, payType: payType.value })
    ElMessage.success(t('learnPayment.paySuccess'))
    router.push({ path: '/learn/payment/confirm', query: { orderId } })
  } finally {
    paying.value = false
  }
}

onMounted(() => {
  load()
})
</script>

<style lang="scss" scoped>
:where(.learn-payment-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.content) {
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 12px;
}

:where(.pay-wrap) {
  display: flex;
  gap: 32px;
  background: var(--el-bg-color);
  padding: 32px;
  border-radius: var(--global-border-radius);

  @media (width <= 768px) {
    flex-direction: column;
  }
}

:where(.qr-section) {
  flex: 0 0 240px;
}

:where(.qr-placeholder) {
  width: 240px;
  height: 240px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--el-fill-color-lighter);
}

:where(.qr-icon) {
  font-size: 64px;
}

:where(.qr-tip) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

:where(.info-section) {
  flex: 1;
}

:where(.title) {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

:where(.info-row) {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

:where(.info-row.total) {
  font-weight: 600;
  font-size: 16px;
  border-bottom: none;
  margin: 12px 0 24px;
}

:where(.price) {
  color: var(--el-color-danger);
  font-size: 24px;
}
</style>
