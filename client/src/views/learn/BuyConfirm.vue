<template>
  <div class="learn-buyconfirm-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="breadcrumbItems" />

    <div v-loading="loading" class="content">
      <el-empty v-if="!lesson.id" :description="t('common.noData')" />
      <div v-else class="confirm-wrap">
        <div class="lesson-card">
          <div class="cover">
            <img :src="lesson.cover || lesson.image" :alt="lesson.name" loading="lazy" />
          </div>
          <div class="info">
            <h3 class="title">{{ lesson.name || lesson.title }}</h3>
            <div class="meta">
              <span>{{ t('buyConfirm.teacher') }}:{{ lesson.teacherName || '—' }}</span>
              <span>·</span>
              <span>{{ lesson.learnNum || 0 }} {{ t('buyConfirm.peopleLearning') }}</span>
            </div>
          </div>
        </div>

        <div class="pay-methods">
          <h3 class="section-title">{{ t('buyConfirm.payMethod') }}</h3>
          <el-radio-group v-model="payType">
            <el-radio value="alipay">{{ t('buyConfirm.alipay') }}</el-radio>
            <el-radio value="wechat">{{ t('buyConfirm.wechatPay') }}</el-radio>
            <el-radio value="balance">{{ t('buyConfirm.balancePay') }}</el-radio>
          </el-radio-group>
        </div>

        <div class="summary">
          <div class="row">
            <span>{{ t('buyConfirm.courseAmount') }}</span>
            <span>¥{{ (lesson.price || 0).toFixed(2) }}</span>
          </div>
          <div class="row total">
            <span>{{ t('buyConfirm.actualPay') }}</span>
            <span class="price">¥{{ (lesson.price || 0).toFixed(2) }}</span>
          </div>
        </div>

        <div class="actions">
          <el-button type="primary" size="large" :loading="submitting" @click="handlePay">
            确认支付
          </el-button>
          <el-button size="large" @click="goBack">{{ t('common.cancel') }}</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import { learnApi } from '@/api/learn'

const route = useRoute()
const router = useRouter()
const id = String(route.query.id || route.params.id || '')

const lesson = ref<any>({})
const loading = ref(false)
const submitting = ref(false)
const payType = ref('alipay')

const breadcrumbItems = computed(() => [
  { title: '课程', path: '/learn' },
  { title: '购买确认' },
])

async function load() {
  loading.value = true
  try {
    const res: any = await learnApi.detail(id)
    lesson.value = res.data || {}
  } finally {
    loading.value = false
  }
}

async function handlePay() {
  submitting.value = true
  try {
    const orderRes: any = await learnApi.createOrder({ lessonId: id, payType: payType.value })
    const orderId = orderRes.data?.id
    if (orderId) {
      router.push({ path: '/learn/payment', query: { orderId } })
    } else {
      ElMessage.error(t('common.errors.orderCreateFailed'))
    }
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.back()
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.learn-buyconfirm-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.content) {
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 12px;
}

:where(.confirm-wrap) {
  background: var(--el-bg-color);
  padding: 24px;
  border-radius: var(--global-border-radius);
}

:where(.lesson-card) {
  display: flex;
  gap: 16px;
  padding-bottom: 24px;
  border-bottom: var(--unified-border-bottom);
  margin-bottom: 24px;
}

:where(.cover) {
  width: 160px;
  flex-shrink: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--global-border-radius);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

:where(.info) {
  flex: 1;
}

:where(.title) {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

:where(.meta) {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.section-title) {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

:where(.pay-methods) {
  margin-bottom: 24px;
}

:where(.summary) {
  border-top: var(--unified-border);
  padding: 16px 0;
  margin-bottom: 24px;
}

:where(.row) {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 14px;
}

:where(.row.total) {
  font-weight: 600;
  font-size: 16px;
  margin-top: 8px;
}

:where(.price) {
  color: var(--el-color-danger);
}

:where(.actions) {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
