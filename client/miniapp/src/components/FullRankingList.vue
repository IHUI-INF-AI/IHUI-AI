<template>
  <view class="full-ranking-list">
    <view v-for="(item, index) in items" :key="index" class="ranking-item" @click="handleItemClick(item)">
      <view class="rank-info">
        <text class="rank">{{ item.ranking }}</text>

        <view v-if="item.rankingUndulationNum == 0" class="rank-change">
          <image :src="item.rankingUndulation" :lazy-load="true" class="hot_icon" />
        </view>
        <view v-else class="rank-change">
          <image :src="item.rankingUndulation" :lazy-load="true" class="hot_icon" />
          <text>{{ item.rankingUndulationNum }}</text>
        </view>
      </view>
      <image :src="item.field1" mode="aspectFit" :lazy-load="true" class="item-icon" />
      <view class="item-details">
        <text class="name">{{ item.name }}</text>
        <text class="company">{{ item.company }}</text>
      </view>

      <view v-if="item.undulationNum == 0">
        <image :src="item.undulation" :lazy-load="true" class="hot_icon" />
      </view>
      <view v-else class="item_hot">
        <image :src="item.undulation" :lazy-load="true" class="hot_icon" />
        <text class="hot">{{ item.undulationNum }}</text>
      </view>

      <view class="attention">
        <text class="attention-value">{{ item.attention }}</text>
        <text class="attention-title">关注度</text>
      </view>
    </view>
    <view class="tabbar_back"></view>

  </view>
</template>

<script setup>
const props = defineProps({
  items: Array,
})

const emit = defineEmits(['item-click'])

function formatAttention(value) {
  if (value >= 10000) {
    const formattedValue = (value / 10000).toFixed(1);
    return formattedValue.endsWith('.0')
      ? `${formattedValue.split('.')[0]}万`
      : `${formattedValue}万`;
  }
  return value;
}

function handleItemClick(item) {
  emit('item-click', item);
}
</script>

<style scoped>
.full-ranking-list {
  padding: 20rpx;
}

.ranking-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.rank-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 20rpx;
  width: 60rpx;
}

.rank {
  font-size: 32rpx;
  font-weight: bold;
  color: #000;
}

.rank-change {
  font-size: 24rpx;
  display: flex;
  color: #000;
  line-height: 28rpx;
}

.hot_icon {
  width: 24rpx;
  height: 24rpx;
}

.up {
  color: #f5222d;
  display: flex;
}

.down {
  color: #07c160;
  display: flex;
}

.item-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 15rpx;
  margin-right: 20rpx;
}

.item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.name {
  font-size: 28rpx;
  font-weight: bold;
  color: #000;
}

.company {
  font-size: 24rpx;
  color: #999;
  margin: 2rpx 0;
}

.attention {
  width: 150rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.item_hot {
  width: 150rpx;
  text-align: center;
  font-size: 20rpx;
  color: #333;
}

.hot {
  font-size: 20rpx;
  line-height: 24rpx;
}

.attention-title {
  font-size: 20rpx;
  color: #999;
}

.attention-value {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 10rpx;
}

.tabbar_back{
  height: 150rpx;
  background-color: rgba(255,255,255,0);
}
</style>
