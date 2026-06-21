<template>
  <view class="earn-commission">
    <!-- 顶部导航栏 -->
    <view class="header">
      <text class="title">分佣计划</text>
    </view>

    <!-- 滚动区域 -->
    <scroll-view scroll-y class="scroll-area">
      <!-- 介绍区域 -->
      <view class="intro-section">
        <view class="intro-title">邀请好友，赚取佣金</view>
        <view class="intro-desc">
          加入我们的分佣计划，邀请好友注册成为会员，您将获得会员费20%的佣金收益
        </view>

        <view class="stats-area">
          <view class="stats-item">
            <text class="stats-value">¥0.00</text>
            <text class="stats-label">累计收益</text>
          </view>
          <view class="stats-item">
            <text class="stats-value">0</text>
            <text class="stats-label">邀请人数</text>
          </view>
        </view>
      </view>

      <!-- 规则说明 -->
      <view class="rules-section">
        <view class="section-title">分佣规则</view>
        <view class="rule-item">
          <text class="rule-num">1</text>
          <text class="rule-text">成为VIP会员后可参与分佣计划</text>
        </view>
        <view class="rule-item">
          <text class="rule-num">2</text>
          <text class="rule-text">邀请好友成为会员，您将获得会员费20%的佣金</text>
        </view>
        <view class="rule-item">
          <text class="rule-num">3</text>
          <text class="rule-text">佣金将在好友支付成功后24小时内自动结算到您的账户</text>
        </view>
        <view class="rule-item">
          <text class="rule-num">4</text>
          <text class="rule-text">账户余额满100元可申请提现到微信或支付宝</text>
        </view>
      </view>
    </scroll-view>

    <!-- 固定底部按钮区域 -->
    <view class="bottom-area">
      <button class="commission-btn" @tap="openPopup">
        开通VIP会员 参与分佣计划
      </button>
    </view>

    <!-- 确认购买弹窗 -->
    <ConfirmPurchasePopUp :visible="showPopup" @updateVisible="handlePayment" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ConfirmPurchasePopUp from '@/pagesA/ConfirmPurchasePopUp/index.vue'

// 数据
const showPopup = ref(false)

// 打开弹窗
function openPopup() {
  showPopup.value = true
}

// 处理支付
function handlePayment(visible: boolean) {
  showPopup.value = visible
}
</script>

<style lang="scss" scoped>
.earn-commission {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60rpx 30rpx 40rpx;
  text-align: center;

  .title {
    font-size: 36rpx;
    font-weight: bold;
    color: #fff;
  }
}

.scroll-area {
  flex: 1;
  padding: 20rpx;
}

.intro-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx 30rpx;
  margin-bottom: 20rpx;
  text-align: center;
}

.intro-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
}

.intro-desc {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
  margin-bottom: 40rpx;
}

.stats-area {
  display: flex;
  justify-content: space-around;
}

.stats-item {
  text-align: center;

  .stats-value {
    font-size: 48rpx;
    font-weight: bold;
    color: #007aff;
    display: block;
    margin-bottom: 8rpx;
  }

  .stats-label {
    font-size: 26rpx;
    color: #999;
  }
}

.rules-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 24rpx;
}

.rule-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 24rpx;

  .rule-num {
    width: 40rpx;
    height: 40rpx;
    background: #007aff;
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    margin-right: 16rpx;
    flex-shrink: 0;
  }

  .rule-text {
    font-size: 28rpx;
    color: #666;
    line-height: 1.6;
  }
}

.bottom-area {
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
}

.commission-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
  font-weight: bold;
}
</style>
