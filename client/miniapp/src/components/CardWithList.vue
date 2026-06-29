<template>
  <view class="card-container">
    <view class="card-header">
      <text class="card-title">{{ title }}</text>
      <view class="card-more" @click="handleMoreClick">
        <text class="more-text">完整榜单</text>
        <image class="arrow-icon" style="transform: rotate(180deg);display: block;float: right;margin-top: 2rpx;" :lazy-load="true"
          src="/static/images/back.svg" mode="aspectFit" />
      </view>
    </view>
    <view class="card-content">
      <scroll-view class="card-items-scroll" scroll-x>
        <view class="card-items">
          <view v-for="(item, index) in items" :key="index" class="card-item" @click="handleItemClick(item)">
            <image :src="item.field1" :lazy-load="true" mode="aspectFit" class="item-icon" />
            <text class="item-name">{{ item.name }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: '榜单标题'
  },
  items: {
    type: Array,
    default: () => [
      { imageUrl: 'https://via.placeholder.com/100', text: '项目1' },
      { imageUrl: 'https://via.placeholder.com/100', text: '项目2' },
      { imageUrl: 'https://via.placeholder.com/100', text: '项目3' },
      { imageUrl: 'https://via.placeholder.com/100', text: '项目4' }
    ]
  }
})

const emit = defineEmits(['more-click', 'item-click'])

function handleMoreClick() {
  emit('more-click')
}

function handleItemClick(item) {
  emit('item-click', item)
}
</script>

<style lang="scss">
.card-container {
  background-color: #fff;
  border-radius: 15rpx;
  padding: 24rpx;
  margin: 20rpx;
  box-shadow: 0 0 12rpx rgb(0 0 0 / 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.card-title {
  font-size: 32rpx;
  color: #000;
  font-weight: bold;
}

.card-more {
  display: flex;
  align-items: center;
}

.more-text {
  font-size: 24rpx;
  color: #999;
  margin-right: 4rpx;
}

.arrow-icon {
  width: 24rpx;
  height: 24rpx;
}

.card-content {
  display: flex;
  justify-content: space-between;
}

.content-item {
  width: 22%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.item-image {
  width: 100rpx;
  height: 100rpx;
  border-radius: 8rpx;
  margin-bottom: 12rpx;
}

.item-text {
  font-size: 24rpx;
  color: #333;
  text-align: center;
}

.card-items-scroll {
  width: 100%;
  white-space: nowrap;
}

.card-items {
  display: inline-flex;
  gap: 20rpx;
}

.card-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  width: 160rpx;
  padding: 20rpx;
  background-color: #f9f9f9;
  border-radius: 15rpx;
  box-sizing: border-box;
}

.item-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 15rpx;
  margin-bottom: 10rpx;
}

.item-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
}

.item-company {
  font-size: 24rpx;
  color: #999;
  margin-top: 5rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
}

.item-attention {
  font-size: 24rpx;
  color: #07c160;
  margin-top: 5rpx;
}

.full-list-btn {
  margin-top: 20rpx;
  text-align: center;
  color: #007aff;
  font-size: 28rpx;
  font-weight: bold;
}
</style>
