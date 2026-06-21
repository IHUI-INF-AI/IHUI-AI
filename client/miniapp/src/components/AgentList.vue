<template>
  <view v-if="sourceIs" class="chu-box agent-list-container" style="bottom: calc(100% + 20rpx); top: auto;">
    <view class="chu-inner">
      <view class="chu-content" @scroll="handleScroll">
        <view class="chu_row_agent">
          <view
            class="chu-row"
            :class="{ 'chu-row_act': agentPitch === index }"
            v-for="(item, index) in agentList"
            :key="index"
            @click="pitchHandle(item, index)">
            <view class="chu-row-left">
              <view class="image_logo">
                <image
                  :src="item.agentAvatar || item.avatar || '/static/images/mian_label.png'"
                  class="chu-icon"></image>
              </view>
              <view class="chu-text" style="margin-left: 18rpx;">
                {{ item.agentName || item.name }}
              </view>
              <image v-if="item.isNew" src="/static/images/xtk/new.png" class="chu-power" mode="widthFix">
              </image>
            </view>
            <view class="chu-row-right">
              <view v-if="agentPitch === index" class="selected-icon">
                <image src="/static/images/selected_model.png" mode="widthFix" style="width:80rpx;height:80rpx;"></image>
              </view>
            </view>
          </view>
        </view>
        <view v-if="isLoading" class="loading-more">
          <text>加载中...</text>
        </view>
        <view v-if="!hasMore && agentList.length > 0" class="no-more">
          <text>没有更多了</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  agentList: {
    type: Array,
    default: () => []
  },
  agentPitch: {
    type: Number,
    default: -1
  },
  sourceIs: {
    type: Boolean,
    default: true
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  hasMore: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['agent-pitch-handle', 'scroll'])

const pitchHandle = (item, index) => {
  emit('agent-pitch-handle', item, index)
}

const handleScroll = (e) => {
  emit('scroll', e)
}
</script>

<style lang="scss" scoped>
.agent-list-container {
  width: calc(100% - 40rpx);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: absolute;
  color: rgba(0, 0, 0, 0.4);
  z-index: 1002;
  font-family: 'AlimamaFangYuanTi';
  align-items: flex-end;
  background: transparent;
  box-sizing: border-box;
  border: none;
  margin: 0;
  padding: 0;
  opacity: 0;
  transform: translateY(60rpx);
  animation: slideUp 0.8s ease forwards;
  max-height: 70vh;
  overflow: hidden;
  pointer-events: auto;
}

.chu-inner {
  width: 100%;
  padding: 0;
  border-radius: 15rpx;
  overflow: hidden;
}

.chu-content {
  height: auto;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  border-radius: 15rpx;
  overflow-y: auto;
  padding: 10rpx 20rpx;
  margin-bottom: -5rpx;
  max-height: 70vh;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.15);
}

.chu_row_agent {
  width: 100%;
  padding-bottom: 10rpx;
}

.title {
  padding: 20rpx 30rpx 10rpx;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.chu-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 80rpx;
  border-radius: 15rpx;
  background: #FFFFFF;
  box-sizing: border-box;
  border: 4rpx solid #B9B9B9;
  margin: 5rpx 0;
  padding: 0 10rpx;
  cursor: pointer;

  &:active {
    transform: scale(0.98);
  }
}

.chu-row_act {
  border-color: #000000;
  box-shadow: 0 0 10rpx rgba(0, 0, 0, 0.1);

  .chu-text {
    font-weight: bold;
  }
}

.chu-row-left {
  display: flex;
  align-items: center;
  flex: 1;

  .chu-icon {
    width: 40rpx;
    height: 40rpx;
  }

  .chu-text {
    font-size: 28rpx;
    margin-left: 10rpx;
  }
}

.image_logo {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-left: 10rpx;
  margin-top: 0;
}

.chu-icon {
  width: 40rpx;
  height: 40rpx;
  object-fit: cover;
  border-radius: 8rpx;
}

.chu-text {
  flex: 1;
  min-width: 0;
}


.chu-power {
  width: 40rpx;
  height: 40rpx;
  display: block;
  margin-left: 10rpx;
}

.chu-row-right {
  display: flex;
  justify-content: center;
  align-items: center;

  .chu-power {
    width: 34rpx;
    height: 20rpx;
    margin-right: 10rpx;
    border-radius: 15rpx;
  }

  .selected-icon {
    width: 32rpx;
    height: 32rpx;
    border-radius: 50%;
    background-color: #000000;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-left: 10rpx;
  }
}

.selected-icon {
  animation: bounceIn 0.3s ease;
}

@keyframes bounceIn {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.loading-more,
.no-more {
  text-align: center;
  padding: 20rpx;
  font-size: 26rpx;
  color: #999;
}

.loading-more {
  color: #5a85ff;
}

@keyframes slideUp {
  0% {
    opacity: 0;
    transform: translateY(60rpx);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>