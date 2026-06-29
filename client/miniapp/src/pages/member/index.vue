<template>
  <view class="member-container">
    <!-- 用户信息头部 -->
    <view class="header">
      <view class="user-info">
        <image class="avatar" :src="userInfo.avatar || '/static/images/default-avatar.png'" mode="aspectFill"></image>
        <view class="user-detail">
          <text class="nickname">{{ userInfo.nickname || '游客' }}</text>
          <view class="vip-badge" v-if="isVIP">
            <text class="vip-text">VIP会员</text>
            <text class="vip-expire" v-if="isPermanentVIP">永久有效</text>
            <text class="vip-expire" v-else>{{ vipExpireText }}</text>
          </view>
          <view class="non-vip" v-else>
            <text>普通用户</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 会员特权 -->
    <view class="card privileges-card">
      <text class="card-title">会员特权</text>
      <view class="privileges-list">
        <view class="privilege-item">
          <image class="privilege-icon" src="/static/images/unlimited.png"></image>
          <view class="privilege-content">
            <text class="privilege-title">无限对话</text>
            <text class="privilege-desc">无限制使用AI对话功能</text>
          </view>
          <text class="privilege-status" :class="{ active: isVIP }">{{ isVIP ? '已开通' : '未开通' }}</text>
        </view>

        <view class="privilege-item">
          <image class="privilege-icon" src="/static/images/advanced.png"></image>
          <view class="privilege-content">
            <text class="privilege-title">高级模型</text>
            <text class="privilege-desc">使用最新的AI大模型</text>
          </view>
          <text class="privilege-status" :class="{ active: isVIP }">{{ isVIP ? '已开通' : '未开通' }}</text>
        </view>

        <view class="privilege-item">
          <image class="privilege-icon" src="/static/images/priority.png"></image>
          <view class="privilege-content">
            <text class="privilege-title">优先响应</text>
            <text class="privilege-desc">对话请求优先处理</text>
          </view>
          <text class="privilege-status" :class="{ active: isVIP }">{{ isVIP ? '已开通' : '未开通' }}</text>
        </view>

        <view class="privilege-item">
          <image class="privilege-icon" src="/static/images/community.png"></image>
          <view class="privilege-content">
            <text class="privilege-title">VIP社区</text>
            <text class="privilege-desc">加入专属VIP交流群</text>
          </view>
          <text class="privilege-status" :class="{ active: isVIP }">{{ isVIP ? '已开通' : '未开通' }}</text>
        </view>
      </view>
    </view>

    <!-- 使用统计 -->
    <view class="card usage-card">
      <text class="card-title">使用统计</text>
      <view class="usage-stats">
        <view class="stat-item">
          <text class="stat-value">{{ userInfo.free_quota || 0 }}</text>
          <text class="stat-label">剩余免费额度</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ userInfo.credit || 0 }}</text>
          <text class="stat-label">积分</text>
        </view>
      </view>
    </view>

    <!-- VIP 开通卡片 -->
    <view class="vip-card" v-if="!isVIP">
      <view class="vip-info">
        <view class="vip-title">开通VIP会员</view>
        <view class="vip-desc">享受更多特权，提升AI体验</view>
        <view class="vip-price">
          <text class="current-price">¥588</text>
          <text class="original-price">¥998</text>
          <text class="discount">限时优惠</text>
        </view>
      </view>
      <button class="vip-btn" @click="handleOpenVip">立即开通</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// 用户信息
const userInfo = ref<any>({})

// VIP 状态
const isVIP = computed(() => userInfo.value.isVip || false)
const isPermanentVIP = computed(() => userInfo.value.vipExpireTime === 'permanent')
const vipExpireText = computed(() => {
  if (!userInfo.value.vipExpireTime) return ''
  const date = new Date(userInfo.value.vipExpireTime)
  return `有效期至 ${date.toLocaleDateString()}`
})

onMounted(() => {
  loadUserInfo()
})

// 加载用户信息
function loadUserInfo() {
  const data = uni.getStorageSync('data')
  if (data) {
    userInfo.value = data
  }
}

// 开通 VIP
function handleOpenVip() {
  uni.navigateTo({ url: '/pagesA/vip/details' })
}
</script>

<style lang="scss" scoped>
.member-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  padding: 40rpx;
  margin-bottom: 20rpx;
}

.user-info {
  display: flex;
  align-items: center;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-right: 24rpx;
}

.user-detail {
  flex: 1;
}

.nickname {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  display: block;
  margin-bottom: 10rpx;
}

.vip-badge {
  display: inline-flex;
  align-items: center;
  background: rgb(255 215 0 / 0.3);
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
}

.vip-text {
  font-size: 24rpx;
  color: #ffd700;
  margin-right: 10rpx;
}

.vip-expire {
  font-size: 20rpx;
  color: #fff;
}

.non-vip {
  font-size: 24rpx;
  color: rgb(255 255 255 / 0.8);
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.card-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 24rpx;
}

.privilege-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.privilege-icon {
  width: 60rpx;
  height: 60rpx;
  margin-right: 20rpx;
}

.privilege-content {
  flex: 1;
}

.privilege-title {
  font-size: 28rpx;
  color: #333;
  display: block;
  margin-bottom: 6rpx;
}

.privilege-desc {
  font-size: 24rpx;
  color: #999;
}

.privilege-status {
  font-size: 24rpx;
  color: #999;

  &.active {
    color: #07c160;
  }
}

.usage-stats {
  display: flex;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #007aff;
  display: block;
  margin-bottom: 10rpx;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
}

.vip-card {
  background: linear-gradient(135deg, #ffd700 0%, #fa0 100%);
  border-radius: 20rpx;
  padding: 40rpx;
  margin-top: 20rpx;
}

.vip-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.vip-desc {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 20rpx;
}

.vip-price {
  display: flex;
  align-items: baseline;
  margin-bottom: 30rpx;
}

.current-price {
  font-size: 48rpx;
  font-weight: bold;
  color: #ff3b30;
  margin-right: 16rpx;
}

.original-price {
  font-size: 28rpx;
  color: #999;
  text-decoration: line-through;
  margin-right: 16rpx;
}

.discount {
  font-size: 22rpx;
  color: #ff3b30;
  background: rgb(255 59 48 / 0.1);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.vip-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  background: #ff3b30;
  color: #fff;
  border-radius: 40rpx;
  font-size: 32rpx;
  font-weight: bold;
}
</style>
