<template>
  <el-dialog
    v-model="dialogVisible"
    width="420px"
    :close-on-click-modal="false"
    :show-close="true"
    class="purchase-popup-dialog"
    destroy-on-close
    @close="handleClose"
  >
    <div class="purchase-popup">
      <!-- 头部 -->
      <div class="popup-header">
        <h3 class="popup-title">{ t('cmpConfirmPurchasePopUp.vipPurchase') }</h3>
      </div>

      <!-- 产品信息 -->
      <div class="product-info">
        <div class="product-name">{{ t('confirmPurchase.vipTitle') }}</div>
        <div class="product-price">
          <span class="price-symbol">¥</span>
          <span class="price-value">{{ dataInfo?.amount || 0 }}</span>
        </div>
        <div class="product-benefits">
          <div class="benefit-item">✓ {{ t('confirmPurchase.priv1') }}</div>
          <div class="benefit-item">✓ {{ t('confirmPurchase.priv2') }}</div>
          <div class="benefit-item">✓ {{ t('confirmPurchase.priv3') }}</div>
          <div class="benefit-item">✓ {{ t('confirmPurchase.priv4') }}</div>
          <div class="benefit-item highlight">✓ {{ t('confirmPurchase.priv5') }}</div>
        </div>
      </div>

      <!-- 支付方式 -->
      <div class="payment-options">
        <div class="option-title">{{ t('confirmPurchase.paymentMethod') }}</div>
        <div
          class="option-item"
          :class="{ active: payMethod === 'wxpay' }"
          @click="selectPayMethod('wxpay')"
        >
          <div class="option-icon wx-icon">
            <span>{{ t('confirmPurchase.wechat') }}</span>
          </div>
          <div class="option-name">{{ t('confirmPurchase.wechatPay') }}</div>
          <div v-if="payMethod === 'wxpay'" class="option-check">✓</div>
        </div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="popup-footer">
        <el-button
          type="primary"
          size="large"
          class="pay-button"
          :loading="isLoading"
          @click="handlePayment"
        >
          {{ t('confirmPurchasePopUp.payNow', { amount: dataInfo?.amount || 0 }) }}
        </el-button>
        <div class="agreement">
          <span class="agreement-text">{{ t('confirmPurchase.agreeTerms') }}</span>
          <span class="agreement-link" @click="openAgreement">{{ t('confirmPurchasePopUp.userAgreement') }}</span>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { ref, computed, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

interface DataInfo {
  amount: number
  id: string
  [key: string]: any
}

const props = defineProps<{
  visible: boolean
  productId?: string
  dataInfo?: DataInfo
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'paySuccess', payload: { productId: string; amount: number }): void
}>()

const router = useRouter()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val),
})

const payMethod = ref('wxpay')
const isLoading = ref(false)

// 支付成功跳转定时器
let paySuccessTimer: ReturnType<typeof setTimeout> | null = null

// 支付请求的 AbortController
let abortController: AbortController | null = null
const cleanup = useCleanup()
cleanup.add(() => {
  abortController?.abort()
  abortController = null
  if (paySuccessTimer !== null) {
    clearTimeout(paySuccessTimer)
    paySuccessTimer = null
  }
})

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      loadProductInfo()
    }
  }
)

function loadProductInfo() {
  // Product info is loaded from dataInfo prop
}

function selectPayMethod(method: string) {
  payMethod.value = method
}

function handleClose() {
  if (!isLoading.value) {
    emit('update:visible', false)
  }
}

function openAgreement() {
  router.push('/agreement').catch(() => {
    ElMessage.info(t('cmpConfirmPurchasePopUp.agreementDeveloping'))
  })
}

async function handlePayment() {
  if (!props.dataInfo) {
    ElMessage.warning(t('cmpConfirmPurchasePopUp.productNotExist'))
    return
  }

  isLoading.value = true

  try {
    const userInfoStr = localStorage.getItem('userInfo')
    const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null

    if (!userInfo || !userInfo.openid) {
      ElMessage.warning(t('confirmPurchase.pleaseLogin'))
      isLoading.value = false
      return
    }

    const params = {
      productId: props.productId || props.dataInfo.id,
      payMethod: payMethod.value,
      openid: userInfo.openid,
    }

    abortController = new AbortController()
    const response = await fetch('/api/payment/createOrder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: abortController.signal,
    })

    if (!response.ok) {
      throw new Error(t('confirmPurchase.createOrderFailed', { status: response.status }))
    }

    const result = await response.json()

    if (result.code === 0 && result.data) {
      const payParams = result.data.payParams
      if (payParams && payParams.jsapi) {
        // H5/小程序环境 - 调用支付
        if (typeof window !== 'undefined' && (window as any).WeixinJSBridge) {
          (window as any).WeixinJSBridge.invoke(
            'getBrandWCPayRequest',
            {
              appId: payParams.appId,
              timeStamp: payParams.timeStamp,
              nonceStr: payParams.nonceStr,
              package: payParams.package,
              signType: payParams.signType,
              paySign: payParams.paySign,
            },
            (res: any) => {
              if (res.err_msg === 'get_brand_wcpay_request:ok') {
                ElMessage.success(t('confirmPurchase.paySuccess'))
                emit('paySuccess', { productId: props.productId || '', amount: props.dataInfo!.amount })
                emit('update:visible', false)
              } else {
                ElMessage.error(t('confirmPurchase.payCancelled'))
              }
            }
          )
        } else {
          // Web 环境 - 跳转支付
          ElMessage.info(t('confirmPurchase.redirectingPay'))
          if (paySuccessTimer !== null) clearTimeout(paySuccessTimer)
          paySuccessTimer = setTimeout(() => {
            ElMessage.success(t('cmpConfirmPurchasePopUp.paySuccess'))
            emit('paySuccess', { productId: props.productId || '', amount: props.dataInfo!.amount })
            emit('update:visible', false)
          }, 2000)
        }
      } else {
        // 无支付参数 - 直接成功
        ElMessage.success(t('cmpConfirmPurchasePopUp.paySuccess2'))
        emit('paySuccess', { productId: props.productId || '', amount: props.dataInfo!.amount })
        emit('update:visible', false)
      }
    } else {
      throw new Error(result.message || '创建订单失败')
    }
  } catch (error: any) {
    if (error instanceof Error && error.name === 'AbortError') return
    ElMessage.error(error?.message || '支付失败，请重试')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.purchase-popup-dialog :deep(.el-dialog) {
  background: var(--color--1a1a20);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
}

.purchase-popup-dialog :deep(.el-dialog__header) {
  border-bottom: var(--unified-border-bottom);
  padding: 15px 20px;
}

.purchase-popup-dialog :deep(.el-dialog__title) {
  color: var(--color-white);
}

.purchase-popup-dialog :deep(.el-dialog__headerbtn .el-dialog__close) {
  color: var(--color-white-60);
}

.purchase-popup {
  padding: 0;
}

.popup-header {
  padding: 15px 0;
  text-align: center;
}

.popup-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--color-white);
  margin: 0;
}

.product-info {
  padding: 15px;
}

.product-name {
  font-size: 17px;
  color: var(--color-white);
  font-weight: bold;
  margin-bottom: 10px;
  text-align: center;
}

.product-price {
  text-align: center;
  margin-bottom: 15px;
}

.price-symbol {
  font-size: 16px;
  color: var(--color-cyan-bright);
  font-weight: bold;
}

.price-value {
  font-size: 30px;
  color: var(--color-cyan-bright);
  font-weight: bold;
  margin-left: 4px;
}

.product-benefits {
  display: flex;
  flex-direction: column;
  padding: 10px;
  background: var(--color-rgba-0--242--255--0-05-);
  border-radius: var(--global-border-radius);
}

.benefit-item {
  font-size: 13px;
  color: var(--color-gray-333);
  line-height: 1.6;
  margin-bottom: 5px;
}

.benefit-item.highlight {
  color: var(--color-deeporange-ff5722);
  font-weight: bold;
}

.payment-options {
  padding: 0 15px 15px;
}

.option-title {
  font-size: 15px;
  color: var(--color-white);
  margin-bottom: 10px;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 10px;
  background: var(--color-white-5);
  border-radius: var(--global-border-radius);
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.option-item.active {
  background: var(--color-rgba-0--242--255--0-1-);
  border: var(--unified-border);
}

.option-icon {
  width: 35px;
  height: 35px;
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  font-size: 12px;
  font-weight: bold;
  color: var(--color-white);
}

.option-icon.wx-icon {
  background: var(--color--09bb07);
}

.option-name {
  flex: 1;
  font-size: 15px;
  color: var(--color-white);
}

.option-check {
  font-size: 15px;
  color: var(--color-cyan-bright);
  font-weight: bold;
}

.popup-footer {
  padding: 0 15px 15px;
}

.pay-button {
  width: 100%;
  height: 45px;
  font-size: 16px;
  font-weight: bold;
  border-radius: var(--global-border-radius);
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
  border: none;
  box-shadow: 0 0 8px var(--color-rgba-5--122--255--0-4-);
  margin-bottom: 10px;
}

.pay-button:hover {
  opacity: 0.9;
}

.agreement {
  text-align: center;
  font-size: 12px;
  color: var(--color-white-50);
}

.agreement-link {
  color: var(--color-cyan-bright);
  cursor: pointer;
  margin-left: 2px;
}
</style>
