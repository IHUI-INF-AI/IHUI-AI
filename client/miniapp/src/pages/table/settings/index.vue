<template>
  <view class="settings-container">
    <navigation-bars 
      color="black" 
      backgroundColor="#fff" 
      :viscosity="true" 
      title="设置" 
      :showBack="true"
      image="/static/images/back.svg"
      @pack="onBackClick" 
    />
    
    <view class="settings-list">
      <view class="settings-item" @click="goToPrivacyPolicy">
        <view class="item-left">
          <text class="item-title">隐私政策</text>
        </view>
        <view class="item-right">
          <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit"></image>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import NavigationBars from "@/components/navigation-bars/index.vue"

function onBackClick() {
  uni.navigateBack({
    delta: 1
  })
}

function goToPrivacyPolicy() {
  uni.navigateTo({
    url: '/pages/table/settings/privacy-policy'
  })
}
</script>

<style lang="scss" scoped>
.settings-container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.settings-list {
  margin-top: 20rpx;
  background-color: #fff;
}

.settings-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:active {
    background-color: #f5f5f5;
  }
}

.item-left {
  display: flex;
  align-items: center;
}

.item-title {
  font-size: 36rpx;
  color: #333;
}

.item-right {
  display: flex;
  align-items: center;
}

.arrow-icon {
  width: 24rpx;
  height: 24rpx;
}
</style>
