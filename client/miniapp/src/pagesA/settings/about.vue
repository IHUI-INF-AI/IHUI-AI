<template>
  <view class="settings-page">
    <SettingsPageLayout title="关于我们">
      <view class="content-inner">
        <view class="settings-section">
          <view class="section-card">
            <view class="settings-item" @click="onItemClick('serviceAgreement')">
              <text class="item-label">服务协议</text>
              <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit" />
            </view>
            <view class="settings-item" @click="onItemClick('privacyPolicy')">
              <text class="item-label">隐私政策</text>
              <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit" />
            </view>
            <view class="settings-item" @click="onItemClick('appPermission')">
              <text class="item-label">应用权限</text>
              <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit" />
            </view>
            <view class="settings-item" @click="onItemClick('usageRules')">
              <text class="item-label">使用规范</text>
              <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit" />
            </view>
            <view class="settings-item" @click="onItemClick('businessLicense')">
              <text class="item-label">营业执照</text>
              <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit" />
            </view>
            <view class="settings-item" @click="onItemClick('icpRecord')">
              <text class="item-label">ICP备案</text>
              <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit" />
            </view>
            <view class="settings-item" @click="onItemClick('modelRecord')">
              <text class="item-label">模型备案</text>
              <image class="arrow-icon" src="/static/images/arrow_right.png" mode="aspectFit" />
            </view>
          </view>
        </view>
      </view>
    </SettingsPageLayout>
  </view>
</template>

<script setup>
import SettingsPageLayout from './common/SettingsPageLayout.vue'

const onItemClick = (key) => {
  if (key === 'serviceAgreement') {
    uni.navigateTo({ url: '/pagesA/agreement/user-agreement' })
    return
  }
  if (key === 'privacyPolicy') {
    uni.navigateTo({ url: '/pagesA/agreement/privacy-policy' })
    return
  }
  if (key === 'businessLicense') {
    uni.navigateTo({ url: '/pagesA/settings/business-license' })
    return
  }
  if (key === 'icpRecord') {
    uni.navigateTo({ url: '/pagesA/settings/icp-record' })
    return
  }
  if (key === 'modelRecord') {
    uni.navigateTo({ url: '/pagesA/settings/model-record' })
    return
  }
  if (key === 'usageRules') {
    uni.navigateTo({ url: '/pagesA/settings/usage-rules' })
    return
  }
  if (key === 'appPermission') {
    // 应用权限页面
  }
  const names = {}
  uni.showToast({ title: names[key] || key, icon: 'none' })
}
</script>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.content-inner {
  padding: 24rpx 24rpx 48rpx;
}

.settings-section {
  margin-bottom: 32rpx;
}

.section-card {
  background-color: #fff;
  border-radius: 16rpx;
  overflow: hidden;

  .settings-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28rpx 24rpx;
    border-bottom: 1rpx solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    &:active {
      background-color: #f8f8f8;
    }

    .item-label {
      font-size: 30rpx;
      color: #333;
    }

    .arrow-icon {
      width: 24rpx;
      height: 24rpx;
      opacity: 0.5;
    }
  }
}
</style>
