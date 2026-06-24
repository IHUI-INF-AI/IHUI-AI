<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

const { t } = useI18n()
const router = useRouter()

defineProps<{
  isShow?: boolean
}>()

const activeTab = ref('continuous')
const benefits = ref([
  { id: 1, text: '获得10%分销收益，开通一人公司，副业首选' },
  { id: 2, text: '注册登录后享智汇值赠送' },
  { id: 3, text: '平台的会员功能不限使用' },
  { id: 4, text: '赠送888万智汇值,爽用独家Agent' },
  { id: 5, text: '插队定制独家定制agent功能8折优惠' },
  { id: 6, text: '创始人一对一随时答疑陪跑' },
  { id: 7, text: '免费AI导航站,AI服务成本价,不用再被韭菜' },
  { id: 8, text: '公司总部入驻及线下学习实操机会' },
  { id: 9, text: '所有会员课程均可观看学习' },
  { id: 10, text: '插队AI分身/AI客服定制开通' },
])

interface Product {
  id?: number
  amount?: number
  defAmount?: number
  remark?: string
  detail?: string
  giveToken?: number
}

const productList = ref<Record<number, Product[]>>({})
const isLoading = ref(false)
const selectedIndex = ref(0)
const monthlySelectedIndex = ref(0)
const selectedProductAmount = ref(0)
const selectedProductId = ref(0)

let abortController: AbortController | null = null
// 返回上一页定时器
let backTimer: ReturnType<typeof setTimeout> | null = null
const cleanup = useCleanup()
cleanup.add(() => {
  abortController?.abort()
  abortController = null
  if (backTimer !== null) {
    clearTimeout(backTimer)
    backTimer = null
  }
})

const getSelectedTokenDisplay = computed(() => {
  const productType = activeTab.value === 'continuous' ? 4 : 3
  const products = productList.value[productType]
  if (!products || !Array.isArray(products) || products.length === 0) {
    return '888万'
  }
  const selIndex = activeTab.value === 'continuous' ? selectedIndex.value : monthlySelectedIndex.value
  const validIndex = Math.min(selIndex, products.length - 1)
  const selectedProduct = products[validIndex]
  if (selectedProduct && selectedProduct.giveToken) {
    const tokenInWan = Math.floor(selectedProduct.giveToken / 10000)
    return `${tokenInWan}万`
  }
  return '888万'
})

async function fetchProductList() {
  try {
    isLoading.value = true
    abortController = new AbortController()
    const response = await fetch('/api/product', { signal: abortController.signal })
    const res = await response.json()
    if (res.data && typeof res.data === 'object') {
      productList.value = res.data
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return
    // ignore
  } finally {
    isLoading.value = false
  }
}

function close() {
  router.back()
}

function handleSubscribe() {
  const productType = activeTab.value === 'continuous' ? 4 : 3
  const products = productList.value[productType]
  if (!products || !Array.isArray(products) || products.length === 0) {
    ElMessage.warning(t('vipPopup.noProduct'))
    return
  }
  const selIndex = activeTab.value === 'continuous' ? selectedIndex.value : monthlySelectedIndex.value
  const validIndex = Math.min(selIndex, products.length - 1)
  const selectedProduct = products[validIndex]
  if (!selectedProduct) {
    ElMessage.warning(t('vipPopup.productInfoError'))
    return
  }
  selectedProductAmount.value = selectedProduct.amount || 0
  selectedProductId.value = selectedProduct.id || 0
  ElMessage.success(t('vipPopup.paySuccess'))
  if (backTimer !== null) clearTimeout(backTimer)
  backTimer = setTimeout(() => {
    router.back()
  }, 1500)
}

function switchTab(tab: string) {
  activeTab.value = tab
}

function selectPriceCard(index: number) {
  if (activeTab.value === 'continuous') {
    selectedIndex.value = index
  } else {
    monthlySelectedIndex.value = index
  }
}

function getCurrentSelectedPrice(): string {
  const productType = activeTab.value === 'continuous' ? 4 : 3
  const products = productList.value[productType]
  if (!products || !Array.isArray(products) || products.length === 0) {
    return '0'
  }
  const selIndex = activeTab.value === 'continuous' ? selectedIndex.value : monthlySelectedIndex.value
  const validIndex = Math.min(selIndex, products.length - 1)
  const selectedProduct = products[validIndex]
  return selectedProduct ? String((selectedProduct.amount || 0) / 100) : '0'
}

onMounted(() => {
  fetchProductList()
})
</script>

<template>
  <div class="introduce-popup" @click="close">
    <div class="popup-content" @click.stop>
      <div class="popup-container">
        <div class="content-section">
          <img
            src="https://file.aizhs.top/sys-mini/default/back_hudie.png"
            class="butterfly-img"
            alt="butterfly"
            loading="lazy"
          />
          <div class="title-section">
            <img class="title-icon" src="https://file.aizhs.top/sys-mini/default/xing.png" alt="star" loading="lazy" />
            <span class="main-title">
              <span class="purple-text">{{ getSelectedTokenDisplay }}</span> 智汇值 / 月
            </span>
          </div>

          <div class="benefits-list">
            <div v-for="benefit in benefits" :key="benefit.id" class="benefit-item">
              <span class="check-icon">✓</span>
              <span class="benefit-text">{{ benefit.text }}</span>
            </div>
          </div>
        </div>

        <div class="tab-container">
          <div class="tab-wrapper">
            <div
              class="tab-item"
              :class="{ active: activeTab === 'continuous' }"
              @click="switchTab('continuous')"
            >
              <span class="tab-text">{{ t('vipPopup.continuous') }}</span>
            </div>
            <div
              class="tab-item"
              :class="{ active: activeTab === 'monthly' }"
              @click="switchTab('monthly')"
            >
              <span class="tab-text">{{ t('vipPopup.monthly') }}</span>
            </div>
          </div>
        </div>

        <div v-if="isLoading" class="loading-state">{{ t('vipIntroducePopup.loading') }}</div>

        <div v-else-if="activeTab === 'continuous'" class="pricing-options">
          <template v-if="productList[4] && productList[4].length > 0">
            <div
              v-for="(item, index) in productList[4]"
              :key="index"
              class="price-card"
              :class="{ highlighted: index === selectedIndex }"
              @click="selectPriceCard(index)"
            >
              <div class="price-row">
                <div class="price-info-section">
                  <div class="price-header">
                    <span class="period-text">{{ item.remark }}</span>
                    <span v-if="(item.defAmount || 0) > (item.amount || 0)" class="discount-tag">
                      {{ (Math.floor((item.amount || 0) / (item.defAmount || 1) * 100) / 10).toFixed(1) }}折
                    </span>
                  </div>
                  <span class="price-info">{{ item.detail }}</span>
                </div>
                <div>
                  <span class="current-price"><span style="font-size: 0.5em">¥</span>{{ (item.amount || 0) / 100 }}</span>
                  <span v-if="(item.defAmount || 0) > (item.amount || 0)" class="original-price">{{ (item.defAmount || 0) / 100 }}</span>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="loading-state">{{ t('vipIntroducePopup.noContinuousOptions') }}</div>
        </div>

        <div v-else-if="activeTab === 'monthly'" class="pricing-options">
          <template v-if="productList[3] && productList[3].length > 0">
            <div
              v-for="(item, index) in productList[3]"
              :key="index"
              class="price-card"
              :class="{ highlighted: monthlySelectedIndex === index }"
              @click="selectPriceCard(index)"
            >
              <div class="price-row">
                <div class="price-info-section">
                  <div class="price-header">
                    <span class="period-text">{{ item.remark }}</span>
                    <span v-if="(item.defAmount || 0) > (item.amount || 0)" class="discount-tag">
                      {{ (Math.floor((item.amount || 0) / (item.defAmount || 1) * 100) / 10).toFixed(1) }}折
                    </span>
                    <span v-else class="trial-tag">{{ t('vipIntroducePopup.trial') }}</span>
                  </div>
                  <span class="price-info">{{ item.detail }}</span>
                </div>
                <div>
                  <span class="current-price"><span style="font-size: 0.5em">¥</span>{{ (item.amount || 0) / 100 }}</span>
                  <span v-if="(item.defAmount || 0) > (item.amount || 0)" class="original-price">{{ (item.defAmount || 0) / 100 }}</span>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="loading-state">{{ t('vipIntroducePopup.noMonthlyOptions') }}</div>
        </div>

        <div class="subscribe-button" @click="handleSubscribe">
          <img src="https://file.aizhs.top/sys-mini/default/ljkt_icon.png" class="ljkt-icon" alt="icon" loading="lazy" />
          <span class="subscribe-text">{{ t('vipPopup.activateNow') }}</span>
          <span class="subscribe-price">¥{{ getCurrentSelectedPrice() }}</span>
        </div>

        <div class="agreement-text">{{ t('vipPopup.agreeRecharge') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.introduce-popup {
  width: 100%;
  height: 100%;
  background-color: var(--color-ghostwhite-f8f8ff);
  display: flex;
  flex-direction: column;
}

.popup-content {
  width: 100%;
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.popup-container {
  width: 100%;
  padding: 0 15px 25px;
  box-sizing: border-box;
}

.content-section {
  background-color: var(--color-white);
  border-radius: var(--global-border-radius);
  padding: 0 10px;
  margin-top: 10px;
  position: relative;
}

.butterfly-img {
  width: 172px;
  height: 172px;
  display: block;
  margin-bottom: 5px;
  position: absolute;
  right: 0;
  bottom: 0;
}

.title-section {
  padding: 10px 0;
  text-align: left;
  display: flex;
  align-items: center;
}

.title-icon {
  width: 20px;
  height: 20px;
  margin-right: 10px;
  margin-left: 10px;
}

.main-title {
  font-size: 16px;
  font-weight: bold;
  color: var(--color-gray-333);
}

.purple-text {
  font-size: 24px;
  color: var(--color-black);
}

.benefits-list {
  padding: 0 10px 10px;
}

.benefit-item {
  display: flex;
  align-items: center;
  padding: 5px 0;
}

.check-icon {
  width: 16px;
  height: 16px;
  margin-right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-black);
  font-size: 12px;
}

.benefit-text {
  flex: 1;
  font-size: 14px;
  color: var(--color-black);
}

.tab-container {
  margin: 15px 0 10px;
}

.tab-wrapper {
  display: flex;
  background-color: var(--color-white);
  border-radius: var(--global-border-radius);
  padding: 2px;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  border-radius: var(--global-border-radius);
  transition: all 0.3s ease;
  cursor: pointer;

  &.active {
    background-color: var(--color-black);
  }
}

.tab-text {
  font-size: 16px;
  font-weight: bold;
  color: var(--color-gray-666);
}

.tab-item.active .tab-text {
  color: var(--color-white);
}

.pricing-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 15px;
}

.price-card {
  margin-bottom: 10px;
  border-radius: var(--global-border-radius);
  padding: 15px;
  position: relative;
  background-color: var(--color-white);
  border: 2px solid var(--color-white);
  cursor: pointer;

  &.highlighted {
    border: 2px solid var(--color-black);
  }
}

.price-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 0;
}

.period-text {
  font-size: 14px;
  font-weight: bold;
  color: var(--color-black);
}

.discount-tag {
  background-color: var(--color-red-ff6b6b);
  padding: 1px 5px;
  border-radius: var(--global-border-radius);
  margin-left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12px;
  color: var(--color-white);
  font-size: 9px;
  font-weight: bold;
}

.trial-tag {
  background-color: var(--color--4ecdc4);
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  color: var(--color-white);
  font-size: 11px;
  font-weight: bold;
  margin-left: 4px;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.price-info-section {
  flex: 1;
}

.original-price {
  font-size: 12px;
  color: var(--color-gray-999);
  text-decoration: line-through;
  display: block;
  margin-bottom: 4px;
  text-align: center;
}

.current-price {
  font-size: 24px;
  font-weight: bold;
  color: var(--color-purple-7b61ff);
}

.price-info {
  font-size: 11px;
  color: var(--color-gray-666);
}

.loading-state {
  text-align: center;
  padding: 20px 0;
  color: var(--color-gray-666);
  font-size: 14px;
}

.subscribe-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-gradient-purple-deep);
  border-radius: var(--global-border-radius);
  padding: 13px 15px;
  margin: 12px 0 10px;
  position: relative;
  box-shadow: none;
  cursor: pointer;
}

.subscribe-text {
  font-size: 18px;
  font-weight: bold;
  color: var(--color-white);
}

.subscribe-price {
  margin-left: 10px;
  font-size: 18px;
  font-weight: bold;
  color: var(--color-white);
}

.agreement-text {
  text-align: center;
  font-size: 12px;
  color: var(--color--86aeff);
}

.ljkt-icon {
  width: 32px;
  height: 32px;
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
}
</style>
