/** * Ripple_Yu * 时间区间切换栏 */
<template>
  <view class="earnings-card-outer">
    <view class="earnings-card">
      <view class="earnings-card-inner">
        <!-- Tab 切换 -->
        <view class="bar_body">
          <TabBar :barList="barList" @change="switchTab"></TabBar>
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
            <view class="stat-label">{{ tabLabel }}公司业绩</view>
          </view>
          <view class="stat-item">
            <view class="stat-value">{{ currentData.strength }}</view>
            <view class="stat-label">{{ tabLabel }}新增人数</view>
          </view>
          <view class="stat-item">
            <view class="stat-value">{{ formatPrice(currentData.endAmount) }}</view>
            <view class="stat-label">{{ tabLabel }}业绩</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatPrice } from "@/utils/time.js"
import TabBar from '@/components/study/bar.vue'

const emit = defineEmits(['tab-change'])

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

const currentTab = ref('today')
const barList = ref([
  { name: '今日', value: 'today' },
  { name: '本月', value: 'month' },
  { name: '累计', value: 'total' },
])

const tabLabel = computed(() => {
  switch (currentTab.value) {
    case 'today': return '日'
    case 'month': return '月'
    case 'total': return '总'
    default: return '日'
  }
})

const currentData = computed(() => {
  switch (currentTab.value) {
    case 'today':
      return props.dayStatistics || { amount: 0, incomplete: 0, finish: 0, order: 0, strength: 0, endAmount: 0 }
    case 'month':
      return props.monthStatistics || { amount: 0, incomplete: 0, finish: 0, order: 0, strength: 0, endAmount: 0 }
    case 'total':
      return props.sumStatistics || { amount: 0, incomplete: 0, finish: 0, order: 0, strength: 0, endAmount: 0 }
    default:
      return props.dayStatistics || { amount: 0, incomplete: 0, finish: 0, order: 0, strength: 0, endAmount: 0 }
  }
})

function switchTab(tab) {
  currentTab.value = tab.value
  emit('tab-change', tab.value)
}
</script>

<style lang="scss" scoped>
.bar_body {
  width: 100%;
  padding: 0 12rpx 0 8rpx;
  box-sizing: border-box;
}
.earnings-card-outer {
  margin: 0 20rpx;
  padding: 2rpx;
  border-radius: 30rpx;
  background: none;
  /* 渐变边框 */
  box-shadow: 0 0 24rpx rgba(209,158,255,0.08);
}
.earnings-card {
  background: #fff;
  border-radius: 30rpx;
  box-shadow: 0 0 8rpx rgba(0,0,0,0.03);
  overflow: hidden;
  position: relative;
}
.earnings-card-inner {
  padding-top: 10rpx;
  padding-bottom: 37rpx;
  background: rgba(0, 4, 255, 0.03);
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
