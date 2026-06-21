<template>
    <view class="settings-page">
        <SettingsPageLayout title="ICP备案">
            <view class="content-inner">
                <view class="card-wrap">
                    <view class="icp-label">ICP备案/许可证号</view>
                    <view class="icp-value">吉ICP备2025027274号-7A</view>
                </view>
            </view>
        </SettingsPageLayout>
    </view>
</template>

<script setup>
import SettingsPageLayout from './common/SettingsPageLayout.vue'
</script>

<style lang="scss" scoped>
.settings-page {
    min-height: 100vh;
    background-color: #f5f5f5;
}

.content-inner {
    padding: 24rpx 24rpx 48rpx;
}

.card-wrap {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    padding: 32rpx 24rpx;
    box-sizing: border-box;
}

.icp-label {
    font-size: 26rpx;
    color: #999;
    margin-bottom: 16rpx;
}

.icp-value {
    font-size: 32rpx;
    color: #333;
    font-weight: 500;
}
</style>
