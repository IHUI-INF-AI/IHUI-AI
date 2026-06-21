/** * Ripple_Yu * 时间区间切换栏 */
<template>
  <view class="earnings-card-outer">
    <view class="earnings-card">
      <view class="earnings-card-inner">
        <!-- Tab 切换 -->
        <view class="tab-switcher-wrapper">
          <view class="tab-switcher">
            <view class=" tab-switcher-inner">
              <view class="tab-item" :class="{ active: currentTab === 'today' }" @click="switchTab('today')">今日</view>
              <view
                class="tab-divider"
                :class="{ 'tab-divider-hide': currentTab === 'today' || currentTab === 'month' }"
              ></view>
              <view class="tab-item" :class="{ active: currentTab === 'month' }" @click="switchTab('month')">本月</view>
              <view
                class="tab-divider"
                :class="{ 'tab-divider-hide': currentTab === 'month' || currentTab === 'total' }"
              ></view>
              <view class="tab-item" :class="{ active: currentTab === 'total' }" @click="switchTab('total')">累计</view>
            </view>
          </view>
        </view>
        <!-- 数据区 -->
        <view class="data-row">
          <view class="data-item">
            <view class="data-value">{{ formatPrice(currentData.amount) }}</view>
            <view class="data-label">收益</view>
          </view>
          <view class="data-item">
            <view class="data-value">{{ formatPrice(currentData.incomplete) }}</view>
            <view class="data-label">待结算</view>
          </view>
          <view class="data-item">
            <view class="data-value">{{ formatPrice(currentData.finish) }}</view>
            <view class="data-label">已结算</view>
          </view>
        </view>
        <view class="bottom-stats">
          <view class="stat-item">
            <view class="stat-value">{{ currentData.order }}</view>
            <view class="stat-label">{{ tabLabel }}推广订单</view>
          </view>
          <view class="stat-item">
            <view class="stat-value">{{ currentData.strength }}</view>
            <view class="stat-label">{{ tabLabel }}团队新增人数</view>
          </view>
          <view class="stat-item">
            <view class="stat-value">{{ formatPrice(currentData.endAmount) }}</view>
            <view class="stat-label">{{ tabLabel }}提现金额</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatPrice } from "@/utils/time.js";

const props = defineProps({
  dayStatistics: {
    type: Object,
    default: () => ({
      amount: 0,
      incomplete: 0,
      finish: 0,
      order: 0,
      strength: 0,
      endAmount: 0
    })
  },
  monthStatistics: {
    type: Object,
    default: () => ({
      amount: 0,
      incomplete: 0,
      finish: 0,
      order: 0,
      strength: 0,
      endAmount: 0
    })
  },
  sumStatistics: {
    type: Object,
    default: () => ({
      amount: 0,
      incomplete: 0,
      finish: 0,
      order: 0,
      strength: 0,
      endAmount: 0
    })
  }
})

const emit = defineEmits(['tab-change'])

const currentTab = ref('today')

const tabLabel = computed(() => {
  switch (currentTab.value) {
    case 'today': return '日';
    case 'month': return '月';
    case 'total': return '总';
    default: return '日';
  }
})

const currentData = computed(() => {
  switch (currentTab.value) {
    case 'today':
      return props.dayStatistics || { amount: 0, incomplete: 0, finish: 0, order: 0, strength: 0, endAmount: 0 };
    case 'month':
      return props.monthStatistics || { amount: 0, incomplete: 0, finish: 0, order: 0, strength: 0, endAmount: 0 };
    case 'total':
      return props.sumStatistics || { amount: 0, incomplete: 0, finish: 0, order: 0, strength: 0, endAmount: 0 };
    default:
      return props.dayStatistics || { amount: 0, incomplete: 0, finish: 0, order: 0, strength: 0, endAmount: 0 };
  }
})

const switchTab = (tab) => {
  currentTab.value = tab;
  emit('tab-change', tab);
}
</script>

<style lang="scss" scoped>
.earnings-card-outer {
  margin: 0 20rpx;
  padding: 2rpx;
  border-radius: 30rpx;
  background: rgba(0, 4, 255, 0.03);
  /* 渐变边框 */
  box-shadow: 0 4rpx 24rpx rgba(209,158,255,0.08);
}
.earnings-card {
  background: #fff;
  border-radius: 30rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.03);
  overflow: hidden;
  position: relative;
}
.earnings-card-inner {
  padding-top: 10rpx;
  padding-bottom: 37rpx;
  background: rgba(0, 4, 255, 0.03);
}

/* Tab切换 */
.tab-switcher-wrapper {
  border-bottom: 2rpx solid #f0f0f0;
  margin: 0 10rpx 19rpx 10rpx;
  border-radius: 15rpx;
  background: rgba(0, 4, 255, 0.03);
  padding: 2rpx;
  overflow: hidden;
}
.tab-switcher{
  background:#fff;
  border-radius: 15rpx;
}
.tab-switcher-inner{
  display: flex;
  border-radius: 15rpx;
  background: rgba(0, 4, 255, 0.03);
}
.tab-item {
  flex: 1;
  text-align: center;
  font-size: 36rpx;
  color: #888;
  padding: 19rpx 0;
  background: transparent;
  transition: background 0.2s, color 0.2s;
}
.tab-item.active {
  background: rgba(0, 4, 255, 0.03);
}
.tab-divider {
  width: 2rpx;
  height: 48rpx;
  background: #e0e0e0;
  margin: 0 0;
  align-self: center;
  transition: opacity 0.2s;
}
.tab-divider-hide {
  opacity: 0;
}
/* 数据区 */
.data-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin: 24rpx 24rpx 0 24rpx;
}
.data-item {
  flex: 1;
  text-align: center;
}
.data-value {
  font-size: 50rpx;
  font-weight: bold;
  color: #222;
  margin-bottom: 8rpx;
}
.data-label {
  font-size: 32rpx;
  color: #646464;
}

/* 底部统计 */
.bottom-stats {
  display: flex;
  justify-content: space-between;
  margin: 32rpx 24rpx 0 24rpx;
}
.stat-item {
  flex: 1;
  text-align: center;
}
.stat-value {
  font-size: 50rpx;
  font-weight: bold;
  color: #222;
  margin-bottom: 6rpx;
}
.stat-label {
  font-size: 32rpx;
  color: #646464;
}
</style>
