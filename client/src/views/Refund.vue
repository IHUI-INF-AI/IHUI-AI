<template>
  <div class="refund-page page-container">
    <div class="page-header">
      <h1 class="page-title">{{ t('refund.applyTitle') }}</h1>
      <p class="page-subtitle">{{ t('refund.applySubtitle') }}</p>
    </div>

    <el-card class="refund-form-card" :shadow="false">
      <el-form
        ref="refundFormRef"
        :model="refundForm"
        :rules="refundRules"
        label-width="120px"
        class="refund-form"
      >
        <!-- 订单信息 -->
        <el-form-item :label="t('refund.orderInfo')">
          <div class="order-info-display">
            <div class="order-item">
              <span class="label">{{ t('refund.orderNo') }}:</span>
              <span class="value">{{ orderInfo.orderNo || route.query.orderNo || '-' }}</span>
            </div>
            <div class="order-item">
              <span class="label">{{ t('refund.productName') }}:</span>
              <span class="value">{{ orderInfo.productName || '-' }}</span>
            </div>
            <div class="order-item">
              <span class="label">{{ t('refund.orderAmount') }}:</span>
              <span class="value amount">¥{{ (orderInfo.amount || 0).toFixed(2) }}</span>
            </div>
            <div class="order-item">
              <span class="label">{{ t('refund.paymentMethod') }}:</span>
              <span class="value">{{ getPaymentMethodText(orderInfo.paymentMethod) }}</span>
            </div>
          </div>
        </el-form-item>

        <!-- 退款金额 -->
        <el-form-item :label="t('refund.refundAmount')" prop="amount">
          <el-input-number
            v-model="refundForm.amount"
            :min="0.01"
            :max="orderInfo.amount || 0"
            :precision="2"
            :step="0.01"
            :placeholder="t('refund.refundAmountPlaceholder')"
            class="amount-input"
            style="width: 100%"
          >
            <template #prefix>¥</template>
          </el-input-number>
          <div class="form-tip">
            {{ t('refund.refundAmountTip') }}
            <span class="max-amount">（最大: ¥{{ (orderInfo.amount || 0).toFixed(2) }}）</span>
          </div>
        </el-form-item>

        <!-- 退款原因 -->
        <el-form-item :label="t('refund.reason.title')" prop="reason" required>
          <el-select
            v-model="refundForm.reason"
            :placeholder="t('refund.reasonPlaceholder')"
            class="reason-select"
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option
              v-for="reason in refundReasons"
              :key="reason.value"
              :label="reason.label"
              :value="reason.value"
            />
          </el-select>
        </el-form-item>

        <!-- 退款说明 -->
        <el-form-item :label="t('refund.description')" prop="description">
          <el-input
            v-model="refundForm.description"
            type="textarea"
            :rows="4"
            :placeholder="t('refund.descriptionPlaceholder')"
            :maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <!-- 提交按钮 -->
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="submitting"
            @click="handleSubmit"
            style="width: 200px"
          >
            {{ submitting ? (t('refund.submitting')) : (t('refund.submit')) }}
          </el-button>
          <el-button size="large" @click="handleCancel" style="margin-left: 12px">
            {{ t('common.cancel') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 退款须知 -->
    <el-card class="refund-notice-card" :shadow="false">
      <template #header>
        <span>{{ t('refund.notice') }}</span>
      </template>
      <ul class="notice-list">
        <li>{{ t('refund.notice1') }}</li>
        <li>{{ t('refund.notice2') }}</li>
        <li>{{ t('refund.notice3') }}</li>
        <li>{{ t('refund.notice4') }}</li>
      </ul>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import { applyRefund, type RefundRequest } from '@/api/refund'
import { getOrderDetail, type Order } from '@/api/orders'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { logger } from '@/utils/logger'
import { yuanToFen } from '@/utils/format'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()

// 表单引用
const refundFormRef = ref<FormInstance>()

// 响应式数据
const submitting = ref(false)
const orderInfo = ref({
  orderNo: '',
  productName: '',
  amount: 0,
  paymentMethod: '',
})

// 退款表单
const refundForm = reactive<RefundRequest & { description?: string }>({
  orderNo: '',
  reason: '',
  amount: undefined,
  description: '',
})

// 退款原因选项
const refundReasons = [
  { label: t('refund.reason.duplicate'), value: 'duplicate' },
  { label: t('refund.reason.wrongProduct'), value: 'wrong_product' },
  { label: t('refund.reason.notSatisfied'), value: 'not_satisfied' },
  { label: t('refund.reason.noNeed'), value: 'no_need' },
  { label: t('refund.reason.qualityIssue'), value: 'quality_issue' },
  { label: t('refund.reason.other'), value: 'other' },
]

// 表单验证规则
const refundRules: FormRules = {
  reason: [
    {
      required: true,
      message: t('refund.reasonRequired'),
      trigger: 'change',
    },
    {
      min: 2,
      message: t('refund.reasonMinLength'),
      trigger: 'blur',
    },
  ],
  amount: [
    {
      type: 'number',
      min: 0.01,
      message: t('refund.amountMin'),
      trigger: 'blur',
    },
    {
      validator: (rule, value, callback) => {
        if (value !== undefined && value !== null) {
          if (value > (orderInfo.value.amount || 0)) {
            callback(new Error(t('refund.amountMax')))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

// 获取支付方式文本
const getPaymentMethodText = (method: string): string => {
  const methods: Record<string, string> = {
    wechat: t('payment.wechat'),
    alipay: t('payment.alipay'),
    coins: t('payment.coins'),
  }
  return methods[method] || method || '-'
}

// 加载订单信息
const loadOrderInfo = async () => {
  const orderNo = (route.query.orderNo as string) || (route.params.orderNo as string)
  if (!orderNo) {
    showError(t('refund.orderNoRequired'))
    router.replace('/')
    return
  }

  refundForm.orderNo = orderNo

  try {
    const response = await getOrderDetail(orderNo)
    if (response.success && response.data) {
      const order = response.data as Order & { total_amount?: number; payment_method?: string }
      orderInfo.value = {
        orderNo: order.orderNo || order.id || orderNo,
        productName: order.productName || '-',
        amount: order.amount || order.total_amount || 0,
        paymentMethod: order.paymentMethod || order.payment_method || '',
      }
    } else {
      showError(response.message || t('refund.loadOrderFailed'))
    }
  } catch (error) {
    logger.error('Failed to load order info:', error)
    showError(t('refund.loadOrderFailed'))
  }
}

// 提交退款申请
const handleSubmit = async () => {
  if (!refundFormRef.value) return

  await refundFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return

    try {
      submitting.value = true

      const requestData: RefundRequest = {
        orderNo: refundForm.orderNo,
        reason: refundForm.reason,
        amount: refundForm.amount ? yuanToFen(refundForm.amount) : undefined, // 元转分（统一金额单位）
        description: refundForm.description,
      }

      const response = await applyRefund(requestData)

      if (response.success || response.code === 200) {
        showSuccess(t('refund.applySuccess'))
        const refundNo = (response.data as { refundNo?: string } | null)?.refundNo || refundForm.orderNo
        router.push(`/refunds/${refundNo}`)
      } else {
        showError(response.message || t('refund.applyFailed'))
      }
    } catch (error) {
      logger.error('Failed to submit refund application:', error)
      showError(t('refund.applyFailed'))
    } finally {
      submitting.value = false
    }
  })
}

// 取消
const handleCancel = () => {
  router.replace('/')
}

onMounted(() => {
  loadOrderInfo()
})
</script>

<style scoped lang="scss">
.refund-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
  text-align: center;

  .page-title {
    font-size: 28px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--el-text-color-primary);
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }
}

.refund-form-card {
  margin-bottom: 20px;
}

.order-info-display {
  background: var(--el-bg-color-page);
  padding: 16px;
  border-radius: var(--global-border-radius);

  .order-item {
    display: flex;
    margin-bottom: 12px;
    font-size: 14px;

    &:last-child {
      margin-bottom: 0;
    }

    .label {
      color: var(--el-text-color-secondary);
      min-width: 100px;
    }

    .value {
      color: var(--el-text-color-primary);
      font-weight: 500;

      &.amount {
        color: var(--el-color-primary);
        font-size: 16px;
      }
    }
  }
}

.amount-input {
  width: 100%;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;

  .max-amount {
    color: var(--el-color-primary);
  }
}

.reason-select {
  width: 100%;
}

.refund-notice-card {
  .notice-list {
    margin: 0;
    padding-left: 20px;
    color: var(--el-text-color-regular);
    font-size: 14px;
    line-height: 2;

    li {
      margin-bottom: 8px;
    }
  }
}
</style>
