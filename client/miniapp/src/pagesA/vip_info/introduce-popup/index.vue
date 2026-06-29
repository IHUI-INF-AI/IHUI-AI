<template>
  <view class="introduce-popup" @click="close">
    <view class="popup-content" @click.stop>
      <view class="popup-container">
        <!-- 标题和权益区域 -->
        <view class="content-section" style="background-color: #fff; border-radius: 30rpx; padding: 0 20rpx;margin-top: 20rpx;position: relative;">
          <image src="https://file.aizhs.top/sys-mini/default/back_hudie.png" mode="widthFix" style="width: 345rpx;height: 344rpx;display: block;margin-bottom: 10rpx;position: absolute;right: 0;bottom: 0;"></image>
          <!-- 标题区域 -->
          <view class="title-section">
            <image class="title-icon" src="https://file.aizhs.top/sys-mini/default/xing.png" mode="aspectFit"></image>
            <text class="main-title">
              <text class="purple-text">{{ getSelectedTokenDisplay }}</text> 智汇值 / 月
            </text>
          </view>

          <!-- 权益列表 -->
          <view class="benefits-list">
            <view class="benefit-item" v-for="benefit in benefits" :key="benefit.id">
              <view class="check-icon">✓</view>
              <text class="benefit-text">{{ benefit.text }}</text>
            </view>
          </view>
        </view>

        <!-- 购买选项Tab切换 -->
        <view class="tab-container">
          <view class="tab-wrapper">
            <view class="tab-item" :class="{ active: activeTab === 'continuous' }" @click="switchTab('continuous')">
              <text class="tab-text">连续购买</text>
            </view>
            <view class="tab-item" :class="{ active: activeTab === 'monthly' }" @click="switchTab('monthly')">
              <text class="tab-text">按月购买</text>
            </view>
          </view>
        </view>

        <!-- 加载状态 -->
        <view v-if="isLoading" class="loading-state">
          <text>加载中...</text>
        </view>

        <!-- 连续购买价格选项 -->
        <view v-else-if="activeTab === 'continuous'" class="pricing-options">
          <view v-if="productList[4] && productList[4].length > 0">
            <view 
              v-for="(item, index) in productList[4]" 
              :key="index" 
              class="price-card" 
              :class="{ highlighted: index === selectedIndex }"
              @click="selectPriceCard(index)"
            >
              <view class="price-row">
                <view class="price-info-section">
                  <view class="price-header">
                    <text class="period-text">{{ item.remark }}</text>
                    <view class="discount-tag" v-if="item.defAmount > item.amount">
                      <text class="discount-text">{{ (Math.floor(item.amount/item.defAmount * 100) / 10).toFixed(1) }}折</text>
                    </view>
                  </view>
                  <text class="price-info">{{ item.detail }}</text>
                </view>
                <view>
                  <text class="current-price"><text style="font-size: 0.5em;">¥</text>{{ item.amount / 100 }}</text>
                  <text class="original-price" v-if="item.defAmount > item.amount">{{ item.defAmount / 100 }}</text>
                </view>
              </view>
            </view>
          </view>
          <view v-else class="loading-state">
            <text>{{ isLoading ? '加载中...' : '暂无可用的连续购买选项' }}</text>
          </view>
        </view>

        <!-- 按月购买价格选项 -->
        <view v-else-if="activeTab === 'monthly'" class="pricing-options">
          <view v-if="productList[3] && productList[3].length > 0">
            <view 
              v-for="(item, index) in productList[3]" 
              :key="index" 
              class="price-card" 
              :class="{ highlighted: monthlySelectedIndex === index }"
              @click="selectPriceCard(index)"
            >
              <view class="price-row">
                <view class="price-info-section">
                  <view class="price-header">
                    <text class="period-text">{{ item.remark }}</text>
                    <view class="discount-tag" v-if="item.defAmount > item.amount">
                      <text class="discount-text">{{ (Math.floor(item.amount/item.defAmount * 100) / 10).toFixed(1) }}折</text>
                    </view>
                    <view class="trial-tag" v-else>
                      <text class="trial-text">试用</text>
                    </view>
                  </view>
                  <text class="price-info">{{ item.detail }}</text>
                </view>
                <view>
                  <text class="current-price"><text style="font-size: 0.5em;">¥</text>{{ item.amount / 100 }}</text>
                  <text class="original-price" v-if="item.defAmount > item.amount">{{ item.defAmount / 100 }}</text>
                </view>
              </view>
            </view>
          </view>
          <view v-else class="loading-state">
            <text>{{ isLoading ? '加载中...' : '暂无可用的按月购买选项' }}</text>
          </view>
        </view>

        <!-- 开通按钮 -->
        <view class="subscribe-button" @click="handleSubscribe">
          <image src="https://file.aizhs.top/sys-mini/default/ljkt_icon.png" class="ljkt_icon"></image>
          <text class="subscribe-text">立即开通</text>
          <text class="subscribe-price">¥{{ getCurrentSelectedPrice() }}</text>
        </view>

        <!-- 协议提示 -->
        <view class="agreement-text">
          充值即表示同意并阅读《用户充值协议》
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { product } from '@/service/pay'
import { pay } from '@/utils/pay/index.js'

const props = defineProps({
  isShow: {
    type: Boolean,
    default: false
  }
})

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
  { id: 10, text: '插队AI分身/AI客服定制开通' }
])
const productList = ref([])
const isLoading = ref(false)
const selectedIndex = ref(0)
const monthlySelectedIndex = ref(0)
const stablePay = ref(null)
const payMethodId = ref(1)
const center = ref("")
const selectedProductAmount = ref(0)
const selectedProductId = ref(0)

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
    const res = await product()
    if (res.data && typeof res.data === 'object') {
      productList.value = res.data
    }
  } catch (error) {
  } finally {
    isLoading.value = false
  }
}

function close() {
  uni.navigateBack({ delta: 1 })
}

function stabilization(fn, wait) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    return new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve(fn(...args))
      }, wait)
    })
  }
}

function handleSubscribe() {
  const productType = activeTab.value === 'continuous' ? 4 : 3
  const products = productList.value[productType]
  if (!products || !Array.isArray(products) || products.length === 0) {
    uni.showToast({ title: '暂无可用产品', icon: 'none' })
    return
  }
  const selIndex = activeTab.value === 'continuous' ? selectedIndex.value : monthlySelectedIndex.value
  const validIndex = Math.min(selIndex, products.length - 1)
  const selectedProduct = products[validIndex]
  if (!selectedProduct) {
    uni.showToast({ title: '产品信息错误', icon: 'none' })
    return
  }
  selectedProductAmount.value = selectedProduct.amount
  selectedProductId.value = selectedProduct.id
  stablePay.value().then(() => {
    uni.showToast({ title: '支付成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack({ delta: 1 })
    }, 1500)
  }).catch(err => {
  })
}

function switchTab(tab) {
  activeTab.value = tab
}

function selectPriceCard(index) {
  if (activeTab.value === 'continuous') {
    selectedIndex.value = index
  } else {
    monthlySelectedIndex.value = index
  }
}

function getCurrentSelectedPrice() {
  const productType = activeTab.value === 'continuous' ? 4 : 3
  const products = productList.value[productType]
  if (!products || !Array.isArray(products) || products.length === 0) {
    return '0'
  }
  const selIndex = activeTab.value === 'continuous' ? selectedIndex.value : monthlySelectedIndex.value
  const validIndex = Math.min(selIndex, products.length - 1)
  const selectedProduct = products[validIndex]
  return selectedProduct ? (selectedProduct.amount / 100).toString() : '0'
}

onMounted(() => {
  fetchProductList()
  stablePay.value = stabilization(
    () => pay(center.value, selectedProductAmount.value, selectedProductId.value, 1, 2),
    500
  )
})
</script>

<style scoped lang="scss">
.introduce-popup {
  width: 100%;
  height: 100%;
  background-color: #F8F8FF;
  display: flex;
  flex-direction: column;
}

.popup-content {
  width: 100%;
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

.popup-container {
  width: 100%;
  padding: 0 30rpx 50rpx;
  box-sizing: border-box;
}

.title-section {
  padding: 20rpx 0;
  text-align: left;
  display: flex;
  align-items: center;
}

.title-icon {
  width: 40rpx;
  height: 40rpx;
  margin-right: 20rpx;
  margin-left: 20rpx;
}

.main-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.purple-text {
  font-size: 48rpx;
  color: #000;
  font-family: AlimamaFangYuanTi !important;
}

.benefits-list {
  margin-bottom: 0;
  background-color: transparent;
  border-radius: 0;
  padding: 0 20rpx 20rpx;
}

.benefit-item {
  display: flex;
  align-items: center;
  margin-bottom: 0;
  padding: 10rpx 0;
}

.check-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000;
  font-size: 24rpx;
}

.benefit-text {
  flex: 1;
  font-size: 28rpx;
  color: #000;
}

.tab-container {
  margin: 30rpx 0 20rpx;
}

.tab-wrapper {
  display: flex;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 4rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 15rpx;
  transition: all 0.3s ease;
}

.tab-item.active {
    background-color: #000;
  }

.tab-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #666;
}

.tab-item.active .tab-text {
  color: #fff;
}

.pricing-options {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.price-card {
  margin-bottom: 20rpx;
  border-radius: 20rpx;
  padding: 30rpx;
  position: relative;
  background-color: #fff;
  border: 4rpx solid #fff;
}

.price-card.highlighted {
  border: 4rpx solid #000;
}

.price-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 0;
}

.period-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #000;
}

.discount-tag {
  background-color: #ff6b6b;
  padding: 2rpx 10rpx;
  border-radius: 10rpx;
  margin-left: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24rpx;
}

.discount-text {
  color: #fff;
  font-size: 18rpx;
  font-weight: bold;
}

.trial-tag {
  background-color: #4ecdc4;
  padding: 4rpx 16rpx;
  border-radius: 15rpx;
}

.trial-text {
  color: #fff;
  font-size: 22rpx;
  font-weight: bold;
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
  font-size: 24rpx;
  color: #999;
  text-decoration: line-through;
  display: block;
  margin-bottom: 8rpx;
  text-align: center;
}

.current-price {
  font-size: 48rpx;
  font-weight: bold;
  color: #7B61FF;
}

.price-info {
  font-size: 22rpx;
  color: #666;
}

.loading-state {
  text-align: center;
  padding: 40rpx 0;
  color: #666;
  font-size: 28rpx;
}

.subscribe-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(269deg, rgb(217 219 254 / 0.8) -211%, rgb(217 219 254 / 0.8) -152%, rgb(217 219 255 / 0.8) -125%, rgb(217 219 254 / 0.8) -35%, rgb(217 219 255 / 0.8) -19%, rgb(144 125 255 / 0.8) 219%, rgb(224 225 252 / 0.8) 305%);
  border-radius: 15rpx;
  padding: 26rpx 30rpx;
  margin: 25rpx 0 20rpx;
  position: relative;
  box-shadow: inset 0 -6px 20px 0 rgb(255 255 255 / 0.8);
  font-family: AlimamaFangYuanTi !important;
}

.star-icon {
  width: 40rpx;
  height: 40rpx;
  margin-right: 10rpx;
  display: flex;
  align-items: center;
}

.subscribe-text {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  font-family: AlimamaFangYuanTi !important;
}

.subscribe-price {
  margin-left: 20rpx;
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  font-family: AlimamaFangYuanTi !important;
}

.agreement-text {
  text-align: center;
  font-size: 24rpx;
  color: #86AEFF;
}

.ljkt_icon{
  width: 64rpx;
  height: 64rpx;
  position: absolute;
  left: 30rpx;
  top: 50%;
  transform: translateY(-50%);
}
</style>
