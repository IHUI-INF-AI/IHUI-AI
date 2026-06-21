<template>
  <view class="type">
    <!-- Loading 遮罩层 -->
    <view v-if="loading" class="loading-mask">
      <view class="loading-container">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>
    </view>

    <!-- 导航栏 -->
    <navigation-bars 
      color="black" 
      :viscosity="true" 
      title="充值" 
      :backgroundColor="color" 
      :image="images"
      @pack="onPackClick" 
    />

    <view style="padding: 0 20rpx; box-sizing: border-box;">
      <!-- 用户信息卡片 -->
      <UserInfoCard 
        ref="userInfoCard" 
        :userInfo="currentUser" 
        :openid="currentUser.open_id" 
        :showBtn="false"
      />
    </view>

    <!-- 充值金额选择 -->
    <view class="amount-section">
      <view class="section-title">请选择充值金额</view>
      <view class="amount-grid">
        <view 
          v-for="(item, index) in amountList" 
          :key="index"
          class="amount-item"
          :class="{ 'amount-item-active': selectedAmount === item.value }"
          @click="selectAmount(item.value)"
        >
          <view class="amount-value">{{ item.value }}</view>
          <view class="amount-label">{{ item.label }}</view>
          <view class="amount-price" v-if="item.discount">¥{{ item.price }}</view>
          <view class="amount-price" v-else>¥{{ item.value }}</view>
        </view>
      </view>
    </view>

    <!-- 自定义金额 -->
    <view class="custom-amount-section">
      <view class="section-title">自定义金额</view>
      <view class="custom-input-wrapper">
        <text class="currency-symbol">¥</text>
        <input 
          class="custom-input" 
          type="digit" 
          v-model="customAmount" 
          placeholder="请输入充值金额"
          @blur="onCustomAmountBlur"
        />
      </view>
    </view>

    <!-- 充值按钮 -->
    <view class="action-section">
      <view class="recharge-btn" @click="handleRecharge">
        <text class="recharge-btn-text">立即充值</text>
      </view>
    </view>

    <!-- 充值说明 -->
    <view class="notice-section">
      <view class="notice-title">充值说明</view>
      <view class="notice-content">
        <text>1. 充值金额将实时到账</text>
        <text>2. 充值金额不可退款</text>
        <text>3. 如有疑问请联系客服</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import NavigationBars from '@/components/navigation-bars/index.vue'
import UserInfoCard from '@/components/UserInfoCard/UserInfoCard.vue'

// 数据
const loading = ref(false)
const color = ref('#fff')
const images = ref('https://file.aizhs.top/sys-mini/default/back.svg')
const currentUser = ref<any>({})
const selectedAmount = ref(0)
const customAmount = ref('')

// 充值金额列表
const amountList = ref([
  { value: 10, label: '10智汇值', price: 10, discount: false },
  { value: 50, label: '50智汇值', price: 50, discount: false },
  { value: 100, label: '100智汇值', price: 100, discount: true },
  { value: 200, label: '200智汇值', price: 180, discount: true },
  { value: 500, label: '500智汇值', price: 450, discount: true },
  { value: 1000, label: '1000智汇值', price: 900, discount: true },
])

onMounted(() => {
  loadUserInfo()
})

// 加载用户信息
function loadUserInfo() {
  const data = uni.getStorageSync('data')
  if (data) {
    currentUser.value = data
  }
}

// 选择金额
function selectAmount(amount: number) {
  selectedAmount.value = amount
  customAmount.value = ''
}

// 自定义金额失焦
function onCustomAmountBlur() {
  if (customAmount.value) {
    selectedAmount.value = Number(customAmount.value)
  }
}

// 充值
async function handleRecharge() {
  const amount = selectedAmount.value || Number(customAmount.value)
  if (!amount || amount <= 0) {
    uni.showToast({ title: '请选择充值金额', icon: 'none' })
    return
  }

  loading.value = true
  try {
    // TODO: 调用充值 API
    // const res = await createRechargeOrder({ amount })
    // if (res && res.data) {
    //   // 调用微信支付
    //   await wxPay(res.data.paymentInfo)
    // }
    uni.showToast({ title: '充值成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (error) {
    uni.showToast({ title: '充值失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 返回上一页
function onPackClick() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.type {
  min-height: 100vh;
  background: #f5f5f5;
  position: relative;
}

.loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-container {
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx 60rpx;
  text-align: center;
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid #eee;
  border-top-color: #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20rpx;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 28rpx;
  color: #666;
}

.amount-section {
  padding: 30rpx 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 24rpx;
}

.amount-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.amount-item {
  width: 31%;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  text-align: center;
  margin-bottom: 20rpx;
  border: 2rpx solid #eee;

  &.amount-item-active {
    border-color: #007aff;
    background: rgba(0, 122, 255, 0.05);
  }

  .amount-value {
    font-size: 40rpx;
    font-weight: bold;
    color: #007aff;
    margin-bottom: 8rpx;
  }

  .amount-label {
    font-size: 24rpx;
    color: #999;
    margin-bottom: 8rpx;
  }

  .amount-price {
    font-size: 26rpx;
    color: #ff3b30;
  }
}

.custom-amount-section {
  padding: 0 20rpx 30rpx;
}

.custom-input-wrapper {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.currency-symbol {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-right: 16rpx;
}

.custom-input {
  flex: 1;
  font-size: 32rpx;
  color: #333;
}

.action-section {
  padding: 20rpx 40rpx;
}

.recharge-btn {
  background: #007aff;
  border-radius: 44rpx;
  padding: 28rpx;
  text-align: center;
}

.recharge-btn-text {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
}

.notice-section {
  padding: 30rpx 20rpx;
}

.notice-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
}

.notice-content {
  font-size: 26rpx;
  color: #999;
  line-height: 1.8;

  text {
    display: block;
  }
}
</style>
