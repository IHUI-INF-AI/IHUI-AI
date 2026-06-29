<template>
  <div class="order-detail-page page-container radius-auto">
    <div class="order-detail-container radius-auto">
      <div class="order-header radius-auto">
        <el-button link @click="router.back()" style="margin-bottom: 20px">
          <el-icon><ArrowLeft /></el-icon>
          {{ t('orderDetail.back') }}
        </el-button>
        <h2>{{ t('orderDetail.title') }}</h2>
      </div>

      <el-card v-loading="loading" :shadow="false" class="order-card radius-auto">
        <template v-if="order">
          <!-- 订单基本信息 -->
          <div class="order-info-section">
            <h3>{{ t('orderDetail.orderInfo') }}</h3>
            <el-descriptions :column="2" border>
              <el-descriptions-item :label="t('orderDetail.orderNo')">
                {{ order.orderNo }}
              </el-descriptions-item>
              <el-descriptions-item :label="t('orderDetail.orderType')">
                <el-tag effect="plain">
                  {{ getOrderTypeText(order.type) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item :label="t('orderDetail.orderStatus')">
                <el-tag effect="plain">
                  {{ getOrderStatusText(order.status) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item :label="t('orderDetail.orderAmount')">
                <span class="amount-text">¥{{ order.amount.toFixed(2) }}</span>
              </el-descriptions-item>
              <el-descriptions-item :label="t('orderDetail.createTime')">
                {{ formatTime(order.createTime) }}
              </el-descriptions-item>
              <el-descriptions-item
                v-if="order.completeTime"
                :label="t('orderDetail.completeTime')"
              >
                {{ formatTime(order.completeTime) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <!-- 订单描述 -->
          <div v-if="order.description" class="order-description">
            <h3>{{ t('orderDetail.orderDescription') }}</h3>
            <p>{{ order.description }}</p>
          </div>

          <!-- 订单操作 -->
          <div class="order-actions">
            <el-button v-if="order.status === 'pending'" @click="handleCancelOrder">
              {{ t('orderDetail.cancelOrder') }}
            </el-button>
            <el-button 
              v-if="canRefund(order)" 
              type="warning" 
              @click="handleRefund"
            >
              {{ t('orderDetail.applyRefund') }}
            </el-button>
            <el-button v-if="order.status === 'completed'" @click="handleDownloadInvoice">
              {{ t('orderDetail.downloadInvoice') }}
            </el-button>
            <el-button @click="handleContactService">{{
              t('orderDetail.contactService')
            }}</el-button>
          </div>
        </template>

        <el-empty v-else :description="t('orderDetail.orderNotExistOrDeleted')" />
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
 
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { usePageState } from '@/composables/usePageState'
import { ApiErrorType } from '@/utils/errorHandler'
import { ArrowLeft } from '@/lib/lucide-fallback'
import { getOrderDetail, type Order } from '@/api/orders'
import { downloadInvoice } from '@/api/invoice'
import { applyRefund } from '@/api/refund'
import { ElMessageBox } from 'element-plus'
import { logger } from '@/utils/logger'
import { openCustomerServiceChat } from '@/composables/useOpenCustomerServiceChat'
import { formatDateTime as formatTime } from '@/utils/format'

const route = useRoute()
const { t } = useI18n()
const router = useRouter() as ReturnType<typeof useRouter> & {
  back: () => void
}
const { handleResult: _handleResult, showSuccess, showError: showErrorMsg, showInfo } = useOperationFeedback()
const { confirm: showConfirm } = useConfirmDialog()
const { loading, error: pageError } = usePageState()

const order = ref<Order | null>(null)

// 加载订单详情
const loadOrderDetail = async () => {
  const orderId = route.params.id as string
  if (!orderId) {
    const errorMsg = t('orderDetail.orderIdNotExists')
    pageError.value = {
      type: ApiErrorType.VALIDATION,
      code: 400,
      message: errorMsg,
    }
    showErrorMsg(errorMsg)
    router.back()
    return
  }

  loading.value = true
  pageError.value = null
  try {
    const response = await getOrderDetail(orderId)
    if (response.code === 200 || response.success) {
      order.value = response.data || null
    } else {
      const errorMsg = response.message || t('orderDetail.loadOrderDetailFailed')
      pageError.value = {
        type: ApiErrorType.BUSINESS,
        code: response.code,
        message: errorMsg,
      }
      showErrorMsg(errorMsg)
      router.back()
    }
  } catch (error: unknown) {
    const errorMsg =
      (error instanceof Error ? error.message : String(error)) ||
      t('orderDetail.loadOrderDetailFailed')
    pageError.value = {
      type: ApiErrorType.UNKNOWN,
      code: 500,
      message: errorMsg,
      originalError: error,
    }
    showErrorMsg(errorMsg)
    router.back()
  } finally {
    loading.value = false
  }
}

// 订单类型文本
const getOrderTypeText = (type: string) => {
  const typeMap: Record<string, string> = {
    recharge: t('orderDetail.typeRecharge'),
    consumption: t('orderDetail.typeConsumption'),
    refund: t('orderDetail.typeRefund'),
    withdraw: t('orderDetail.typeWithdraw'),
  }
  return typeMap[type] || type
}

// 订单状态文本
const getOrderStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: t('orderDetail.statusPending'),
    processing: t('orderDetail.statusProcessing'),
    completed: t('orderDetail.statusCompleted'),
    failed: t('orderDetail.statusFailed'),
    cancelled: t('orderDetail.statusCancelled'),
  }
  return statusMap[status] || status
}

// 订单状态类型
const _getOrderStatusType = (status: string) => {
  const typeMap: Record<string, string> = {
    pending: 'warning',
    processing: 'info',
    completed: 'success',
    failed: 'danger',
    cancelled: 'info',
  }
  return typeMap[status] || 'info'
}

// 取消订单
const handleCancelOrder = async () => {
  const confirmed = await showConfirm(
    t('orderDetail.cancelOrderConfirm'),
    t('orderDetail.cancelOrderTitle'),
    { type: 'warning' }
  )
  if (!confirmed) return

  // 这里应该调用取消订单API
  showSuccess(t('orderDetail.orderCancelled'))
  await loadOrderDetail()
}

// 下载发票 - 完整实现
const handleDownloadInvoice = async () => {
  if (!order.value) {
    showErrorMsg(t('orderDetail.orderNotExist'))
    return
  }

  try {
    // 检查订单状态，只有已完成的订单才能下载发票
    if (order.value.status !== 'completed' && order.value.status !== 'paid') {
      showInfo(t('orderDetail.invoiceOnlyForCompletedOrders'))
      return
    }

    // 下载发票PDF
    const blob = await downloadInvoice(order.value.id)
    
    // 创建下载链接
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `发票_${order.value.orderNo}_${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    showSuccess(t('orderDetail.invoiceDownloadSuccess'))
    logger.info('Invoice download successful', { orderId: order.value.id, orderNo: order.value.orderNo })
  } catch (error) {
    logger.error('Invoice download failed:', error)
    showErrorMsg(t('orderDetail.invoiceDownloadFailed'))
  }
}

// 判断是否可以退款
const canRefund = (order: Order) => {
  // 只有已支付且非token类型的订单可以退款
  return (order.status === 'paid' || order.status === 'completed') && order.type !== 'tokens'
}

// 申请退款
const handleRefund = async () => {
  if (!order.value) return

  try {
    const { value: form } = await ElMessageBox.prompt(
      t('orderDetail.refundReasonPlaceholder'),
      t('orderDetail.applyRefund'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        inputType: 'textarea',
        inputPlaceholder: t('orderDetail.refundReasonPlaceholder'),
        inputValidator: (value: string) => {
          if (!value || value.trim().length === 0) {
            return t('orderDetail.refundReasonRequired')
          }
          if (value.trim().length < 5) {
            return t('orderDetail.refundReasonMinLength')
          }
          return true
        },
      }
    )

    if (!form || !form.trim()) return

    const response = await applyRefund({
      orderNo: order.value.orderNo || order.value.id,
      reason: form.trim(),
      description: form.trim(),
    })

    if (response.success || response.code === 200) {
      showSuccess(t('orderDetail.refundApplied'))
      await loadOrderDetail()
    } else {
      showErrorMsg(response.message || t('orderDetail.refundApplyFailed'))
    }
  } catch (error: unknown) {
    if (error !== 'cancel') {
      logger.error('Refund application failed:', error)
      showErrorMsg(t('orderDetail.refundApplyFailed'))
    }
  }
}

// 联系客服：在 AI 对话悬浮窗内打开客服模式
const handleContactService = () => {
  openCustomerServiceChat()
}

onMounted(() => {
  loadOrderDetail()
})
</script>

<style scoped lang="scss">
.order-detail-page {
  min-height: 100vh;
  background: var(--el-bg-color-page);
  padding: 20px;
}

.order-detail-container {
  width: 100%;
  padding: 20px;
}

.order-header {
  margin-bottom: 20px;

  h2 {
    font-size: 24px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0;
  }
}

.order-card {
  .order-info-section {
    margin-bottom: 24px;

    h3 {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
    }

    .amount-text {
      font-size: 20px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .order-description {
    margin-bottom: 24px;
    padding: 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);

    h3 {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
    }

    p {
      color: var(--el-text-color-secondary);
      line-height: 1.6;
      margin: 0;
    }
  }

  .order-actions {
    display: flex;
    gap: 15px;
    padding-top: 20px;
    border-top: none;
  }
}
</style>
