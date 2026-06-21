<template>
  <view class="settings-page">
    <SettingsPageLayout title="设置">
      <view class="content-inner">
        <!-- 账号与安全 -->
        <view class="settings-section">
          <view class="section-title">账号与安全</view>
          <view class="section-card">
            <view class="settings-item" @click="onItemClick('account')">
              <text class="item-label">账号管理</text>
              <text class="arrow-icon">›</text>
            </view>
            <view class="settings-item" @click="onItemClick('changePhone')">
              <text class="item-label">更换手机号</text>
              <text class="arrow-icon">›</text>
            </view>
            <view class="settings-item" @click="onItemClick('accountCancel')">
              <text class="item-label">账号注销/注销说明</text>
              <text class="arrow-icon">›</text>
            </view>
          </view>
        </view>

        <!-- 通用设置 -->
        <view class="settings-section">
          <view class="section-title">通用设置</view>
          <view class="section-card">
            <view class="settings-item settings-item-switch">
              <text class="item-label">消息通知</text>
              <switch :checked="messageNotification" color="#07c160" @change="onMessageNotificationChange" />
            </view>
          </view>
        </view>

        <!-- 我的服务 -->
        <view class="settings-section">
          <view class="section-title">我的服务</view>
          <view class="section-card">
            <view class="settings-item" @click="onItemClick('myAiModel')">
              <text class="item-label">我的AI模型</text>
              <text class="arrow-icon">›</text>
            </view>
            <view class="settings-item" @click="onItemClick('commissionPlan')">
              <text class="item-label">分佣计划</text>
              <text class="arrow-icon">›</text>
            </view>
            <view class="settings-item" @click="onItemClick('withdrawRecords')">
              <text class="item-label">提现记录</text>
              <text class="arrow-icon">›</text>
            </view>
            <view class="settings-item" @click="onItemClick('chatHistory')">
              <text class="item-label">聊天记录</text>
              <text class="arrow-icon">›</text>
            </view>
            <view class="settings-item" @click="onItemClick('statistics')">
              <text class="item-label">数据统计</text>
              <text class="arrow-icon">›</text>
            </view>
          </view>
        </view>

        <!-- 帮助与反馈 -->
        <view class="settings-section">
          <view class="section-title">帮助与反馈</view>
          <view class="section-card">
            <view class="settings-item" @click="onItemClick('feedback')">
              <text class="item-label">帮助与反馈</text>
              <text class="arrow-icon">›</text>
            </view>
            <view class="settings-item" @click="onItemClick('about')">
              <text class="item-label">关于我们</text>
              <text class="arrow-icon">›</text>
            </view>
          </view>
        </view>

        <!-- 联系客服 -->
        <view class="settings-section">
          <view class="section-card">
            <button class="settings-item settings-item-contact" open-type="contact">
              <text class="item-label">联系客服</text>
              <text class="arrow-icon">›</text>
            </button>
          </view>
        </view>

        <!-- 隐私与权限 -->
        <view class="settings-section">
          <view class="section-title">隐私与权限</view>
          <view class="section-card">
            <view class="settings-item" @click="onItemClick('privacy')">
              <text class="item-label">隐私与权限</text>
              <text class="arrow-icon">›</text>
            </view>
          </view>
        </view>

        <!-- 其他 -->
        <view class="settings-section">
          <view class="section-title">其他</view>
          <view class="section-card">
            <view class="settings-item" @click="onItemClick('viewWeb')">
              <text class="item-label">查看网页版</text>
              <text class="arrow-icon">›</text>
            </view>
            <view class="settings-item" @click="onItemClick('checkUpdate')">
              <text class="item-label">检查更新</text>
              <text class="arrow-icon">›</text>
            </view>
            <view class="settings-item settings-item-disabled">
              <text class="item-label">当前版本号</text>
              <text class="item-value">{{ versionName }}</text>
            </view>
          </view>
        </view>

        <!-- 退出登录 -->
        <view class="logout-section">
          <view class="logout-btn" @click="handleLogout">
            <text class="logout-text">退出登录</text>
          </view>
        </view>
      </view>
    </SettingsPageLayout>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SettingsPageLayout from './common/SettingsPageLayout.vue'
import { useSettings, useUser } from '@/composables/shared-logic'

const { settings, updateSetting } = useSettings()
const { clearUser } = useUser()

// 数据
const messageNotification = ref(settings.value.notifications)
const versionName = ref('1.0.0')

onMounted(() => {
  const appInfo = uni.getSystemInfoSync()
  if (appInfo && appInfo.version) {
    versionName.value = appInfo.version
  }
})

// 点击设置项
function onItemClick(type: string) {
  const routeMap: Record<string, string> = {
    account: '/pagesA/settings/account',
    changePhone: '/pagesA/settings/change-phone',
    accountCancel: '/pagesA/settings/account-cancel',
    feedback: '/pagesA/fankui/index',
    about: '/pagesA/settings/about',
    privacy: '/pagesA/settings/privacy',
    myAiModel: '/pagesA/my_ai_model/index',
    commissionPlan: '/pagesA/commission-plan/index',
    withdrawRecords: '/pagesA/withdraw-records/index',
    chatHistory: '/pagesA/chat-history/index',
    statistics: '/pagesA/statistics/index',
  }

  if (type === 'checkUpdate') {
    uni.showToast({ title: '已是最新版本', icon: 'success' })
    return
  }

  if (type === 'viewWeb') {
    uni.navigateTo({ url: '/pagesA/webview/index?url=https://aizhihuishe.com' })
    return
  }

  const url = routeMap[type]
  if (url) {
    uni.navigateTo({ url })
  }
}

// 消息通知切换
function onMessageNotificationChange(e: any) {
  messageNotification.value = e.detail.value
  updateSetting('notifications', e.detail.value)
}

// 退出登录
function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        clearUser()
        uni.removeStorageSync('data')
        uni.reLaunch({ url: '/pages/login-app/login' })
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.content-inner {
  padding: 20rpx;
}

.settings-section {
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 16rpx;
  padding-left: 16rpx;
}

.section-card {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.settings-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &.settings-item-switch {
    justify-content: space-between;
  }

  &.settings-item-disabled {
    opacity: 0.6;
  }

  &.settings-item-contact {
    background: none;
    border: none;
    border-radius: 0;
    margin: 0;
    padding: 0;
    line-height: normal;
    font-size: inherit;
    text-align: left;
    width: 100%;
    box-sizing: border-box;

    &::after {
      border: none;
    }
  }
}

.item-label {
  font-size: 30rpx;
  color: #333;
}

.item-value {
  font-size: 28rpx;
  color: #999;
}

.arrow-icon {
  font-size: 36rpx;
  color: #ccc;
}

.logout-section {
  margin-top: 60rpx;
  padding: 0 40rpx;
}

.logout-btn {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  text-align: center;
}

.logout-text {
  font-size: 32rpx;
  color: #ff3b30;
}
</style>
