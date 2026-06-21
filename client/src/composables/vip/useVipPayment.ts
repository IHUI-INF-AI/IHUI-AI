 
/**
 * VIP 支付管理 Composable
 *
 * 负责 VIP 支付流程、支付状态轮询和支付对话框管理
 *
 * @packageDocumentation
 */

import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useAuthStore } from '@/stores/auth'
import { purchaseVip } from '@/api/vip'
import { logger } from '@/utils/logger'
import type { PricingPlan } from './useVipPricing'

/**
 * useVipPayment 配置选项
 */
export interface UseVipPaymentOptions {
  /** 支付成功回调 */
  onPaymentSuccess?: () => void
  /** 支付失败回调 */
  onPaymentFailed?: (error: string) => void
}

/**
 * VIP 支付管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回支付状态、对话框状态和相关方法
 *
 * @example
 * ```vue
 * <script setup>
 * import { useVipPayment } from '@/composables/vip/useVipPayment'
 *
 * const {
 *   showPaymentDialog,
 *   paymentMethod,
 *   processing,
 *   qrCodeDialogVisible,
 *   qrCodeUrl,
 *   handlePayment,
 * } = useVipPayment({
 *   onPaymentSuccess: () => {
 *     logger.info('[VipPayment] Payment successful')
 *   },
 * })
 * </script>
 *
 * <template>
 *   <el-dialog v-model="showPaymentDialog" title="支付">
 *     <el-radio-group v-model="paymentMethod">
 *       <el-radio label="wechat">微信支付</el-radio>
 *       <el-radio label="alipay">支付/el-radio>
 *     </el-radio-group>
 *     <el-button @click="handlePayment(selectedPlan)" :loading="processing">
 *       确认支付
 *     </el-button>
 *   </el-dialog>
 * </template>
 * ```
 */
export function useVipPayment(options: UseVipPaymentOptions = {}) {
  const { onPaymentSuccess, onPaymentFailed } = options
  const router = useRouter()
  const { t } = useI18n()
  const { showSuccess, showError: showErrorMsg } = useOperationFeedback()
  const authStore = useAuthStore()

  const showPaymentDialog = ref(false)
  const paymentMethod = ref('wechat')
  const processing = ref(false)
  const qrCodeDialogVisible = ref(false)
  const qrCodeUrl = ref('')

  let paymentPollingTimer: NodeJS.Timeout | null = null

  const startPaymentStatusPolling = (): void => {
    if (paymentPollingTimer) {
      clearInterval(paymentPollingTimer)
    }

    paymentPollingTimer = setInterval(async () => {
      try {
        // 刷新用户信息以检查VIP状态
         
        if ((authStore as any).fetchUserInfo) {
           
          await (authStore as any).fetchUserInfo()
        }

        // 如果用户已成为VIP，停止轮询并关闭对话框
         
        if ((authStore.user as any)?.isVip) {
          stopPaymentStatusPolling()
          qrCodeDialogVisible.value = false
          showSuccess(t('vip.paymentSuccess'))
          if (onPaymentSuccess) {
            onPaymentSuccess()
          }
        }
      } catch (error) {
        // 静默失败，继续轮询
        logger.error('[VipPayment] Failed to poll payment status:', error)
      }
    }, 3000) // X秒轮询一
  }

  const stopPaymentStatusPolling = (): void => {
    if (paymentPollingTimer) {
      clearInterval(paymentPollingTimer)
      paymentPollingTimer = null
    }
  }

  const handlePayment = async (selectedPlan: PricingPlan | null): Promise<void> => {
    if (!selectedPlan) return

    try {
      processing.value = true

      // 调用真实API购买VIP
      const response = await purchaseVip({
        packageId: String(selectedPlan.id),
        paymentMethod: paymentMethod.value as 'wechat' | 'alipay' | 'balance',
      })

      if (response.data.code === 200 || response.data.success) {
        showPaymentDialog.value = false
        showSuccess(t('vip.paymentSuccess'))

        // 如果有支付URL，跳转到支付页面（校验必须是 http/https 协议，防止 javascript: 等危险协议）
        if (response.data?.paymentUrl) {
          const paymentUrl = String(response.data.paymentUrl)
          if (/^https?:\/\//i.test(paymentUrl)) {
            window.location.href = paymentUrl
            return
          } else {
            logger.error('[useVipPayment] 非法支付URL，已拦截', { paymentUrl })
          }
        }

        // 如果有二维码，显示二维码对话框
        if (response.data?.qrCode) {
          qrCodeDialogVisible.value = true
          qrCodeUrl.value = response.data.qrCode
          // 开始轮询支付状态
          startPaymentStatusPolling()
        } else {
          showSuccess(t('vip.useQrCode'))
        }

        // 刷新用户信息
         
        if ((authStore as any).fetchUserInfo) {
           
          await (authStore as any).fetchUserInfo()
        }

        // 跳转到用户中心
        try {
          // 如果已经在用户中心，不执行跳转
           
          if ((router as any).currentRoute.value.path !== '/profile') {
            await router.push('/profile').catch(error => {
              // 忽略导航重复错误
              if (error.name !== 'NavigationDuplicated' && error.name !== 'NavigationRedirected') {
                logger.error('[VipPayment] Failed to navigate to user center:', error)
              }
            })
          }
        } catch (error) {
          logger.error('[VipPayment] Route navigation error:', error)
        }

        if (onPaymentSuccess) {
          onPaymentSuccess()
        }
      } else {
        const errorMessage = response.data.message || t('vip.paymentFailed')
        showErrorMsg(errorMessage)
        if (onPaymentFailed) {
          onPaymentFailed(errorMessage)
        }
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : t('vip.paymentFailed')
      showErrorMsg(errorMessage)
      if (onPaymentFailed) {
        onPaymentFailed(errorMessage)
      }
    } finally {
      processing.value = false
    }
  }

  const openPaymentDialog = (): void => {
    showPaymentDialog.value = true
  }

  const closePaymentDialog = (): void => {
    showPaymentDialog.value = false
    stopPaymentStatusPolling()
  }

  const scrollToPlans = (): void => {
    const pricingSection = document.querySelector('.pricing-section')
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  onUnmounted(() => {
    stopPaymentStatusPolling()
  })

  return {
    showPaymentDialog,
    paymentMethod,
    processing,
    qrCodeDialogVisible,
    qrCodeUrl,
    handlePayment,
    openPaymentDialog,
    closePaymentDialog,
    startPaymentStatusPolling,
    stopPaymentStatusPolling,
    scrollToPlans,
  }
}
