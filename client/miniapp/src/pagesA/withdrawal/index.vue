<template>
  <view class="center" style="padding: 0 20rpx; background: #fff">
    <!-- 导航栏 -->
    <navigation-bars title="提现" @pack="onPackClick" :image="image" />

    <!-- 提现内容 -->
    <view class="content-wrap">
      <view style="font-size: 32rpx; color: #676768">可提现金额(元)</view>
      <view style="font-size: 46rpx; font-weight: bold; margin-top: 30rpx; color: black;">
        {{ formatPrice(availableWithdrawalAmount) }}
      </view>
    </view>

    <!-- 提现金额 -->
    <view class="withdrawalMethods">
      <view class="colors">提现金额</view>
      <view class="withdrawalMethods-item">
        <view class="withdrawalMethods-item-price">
          <input disabled type="text" v-model="price" placeholder="输入提现金额" />
        </view>
        <view class="withdrawalMethods-item-text" @click="withdrawAll">
          全部提现
        </view>
      </view>
      <view class="withdrawalMethods-pay">
        <view class="colors">提款方式</view>
        <view style="display: flex; align-items: center">
          <image style="width: 50rpx; height: 50rpx; margin-right: 20rpx" :src="select.image" mode="scaleToFill" />
          <view class="withdrawalMethods-money">{{ select.name }}</view>
        </view>
      </view>
    </view>

    <!-- 提现方式选择 -->
    <view class="withdrawalMethods-tip" style="margin-top: 40rpx; padding: 0 20rpx">
      <text style="font-size: 32rpx; font-weight: bold; color: black">请选择提现方式</text>
      <view v-for="item in radio" :key="item.id" class="radio-item" @click="choose(item)">
        <view class="radio-item-left">
          <image style="width: 40rpx; height: 40rpx" :src="item.image" mode="scaleToFill"></image>
          <text style="margin-left: 20rpx; color: black">{{ item.name }}</text>
        </view>
        <view class="radio-item-right">
          <view class="rounded" v-if="item.id === id"></view>
        </view>
      </view>
    </view>

    <!-- 提现按钮 -->
    <view style="margin-top: 40rpx; display: flex; justify-content: center">
      <view class="btnbj" @click="withdrawDepositClick">提交</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import NavigationBars from '@/components/navigation-bars/index.vue'
import { zhsWithdrawal, getWithdrawal } from '@/service/tixian.js'
import { formatPrice } from '@/utils/time.js'

// 数据
const image = ref('https://file.aizhs.top/sys-mini/default/back.svg')
const availableWithdrawalAmount = ref(0)
const price = ref('')
const id = ref(1)
const select = ref<any>({})

// 提现方式
const radio = ref([
  {
    id: 1,
    value: 1,
    name: '微信',
    image: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/wxfb.png',
  },
])

onMounted(() => {
  loadWithdrawalInfo()
})

// 加载提现信息
async function loadWithdrawalInfo() {
  try {
    const res = await getWithdrawal()
    if (res && res.data) {
      availableWithdrawalAmount.value = res.data.availableAmount || 0
    }
  } catch (error) {
    console.error('加载提现信息失败:', error)
  }
}

// 选择提现方式
function choose(item: any) {
  id.value = item.id
  select.value = item
}

// 全部提现
function withdrawAll() {
  price.value = availableWithdrawalAmount.value.toString()
}

// 提交提现
async function withdrawDepositClick() {
  const amount = Number(price.value)
  if (!amount || amount <= 0) {
    uni.showToast({ title: '请输入提现金额', icon: 'none' })
    return
  }

  if (amount > availableWithdrawalAmount.value) {
    uni.showToast({ title: '提现金额不能超过可提现金额', icon: 'none' })
    return
  }

  if (!select.value.id) {
    uni.showToast({ title: '请选择提现方式', icon: 'none' })
    return
  }

  try {
    await zhsWithdrawal({
      amount,
      type: select.value.value,
    })
    uni.showToast({ title: '提现成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (error) {
    uni.showToast({ title: '提现失败', icon: 'none' })
  }
}

// 返回上一页
function onPackClick() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.center {
  min-height: 100vh;
  background: #fff;
}

.content-wrap {
  padding: 30rpx 0;
}

.colors {
  font-size: 28rpx;
  color: #676768;
  margin-bottom: 20rpx;
}

.withdrawalMethods {
  margin-top: 30rpx;
}

.withdrawalMethods-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1rpx solid #f0f0f0;
  padding: 20rpx 0;
}

.withdrawalMethods-item-price {
  flex: 1;

  input {
    font-size: 32rpx;
    color: #333;
  }
}

.withdrawalMethods-item-text {
  color: #007aff;
  font-size: 28rpx;
}

.withdrawalMethods-pay {
  margin-top: 30rpx;
}

.withdrawalMethods-money {
  font-size: 30rpx;
  color: #333;
}

.withdrawalMethods-tip {
  margin-top: 40rpx;
}

.radio-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.radio-item-left {
  display: flex;
  align-items: center;
}

.radio-item-right {
  .rounded {
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
    background: #007aff;
    border: 4rpx solid #007aff;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 16rpx;
      height: 16rpx;
      background: #fff;
      border-radius: 50%;
    }
  }
}

.btnbj {
  width: 80%;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  background: #007aff;
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: bold;
}
</style>
