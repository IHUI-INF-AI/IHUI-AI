<template>
    <view class="settings-page">
        <SettingsPageLayout title="数据统计">
            <view class="content-inner">
                <view class="stats-grid">
                    <view class="stats-item">
                        <text class="stats-value">{{ stats.visits }}</text>
                        <text class="stats-label">访问量</text>
                    </view>
                    <view class="stats-item">
                        <text class="stats-value">{{ stats.duration }}</text>
                        <text class="stats-label">使用时长</text>
                    </view>
                    <view class="stats-item">
                        <text class="stats-value">{{ stats.conversations }}</text>
                        <text class="stats-label">对话次数</text>
                    </view>
                    <view class="stats-item">
                        <text class="stats-value">{{ stats.shares }}</text>
                        <text class="stats-label">分享次数</text>
                    </view>
                </view>

                <view class="card-wrap">
                    <view class="card-title">详细统计</view>
                    <view class="stats-detail">
                        <view class="detail-row">
                            <text class="detail-label">注册时间</text>
                            <text class="detail-value">{{ stats.registerTime }}</text>
                        </view>
                        <view class="detail-row">
                            <text class="detail-label">累计登录天数</text>
                            <text class="detail-value">{{ stats.loginDays }} 天</text>
                        </view>
                        <view class="detail-row">
                            <text class="detail-label">累计使用时长</text>
                            <text class="detail-value">{{ stats.totalDuration }}</text>
                        </view>
                    </view>
                </view>
            </view>
        </SettingsPageLayout>
    </view>
</template>

<script setup>
import { reactive } from 'vue'
import SettingsPageLayout from '@/pagesA/settings/common/SettingsPageLayout.vue'

const stats = reactive({
    visits: 0,
    duration: '0小时',
    conversations: 0,
    shares: 0,
    registerTime: '--',
    loginDays: 0,
    totalDuration: '0小时'
})
</script>

<style lang="scss" scoped>
.settings-page {
    min-height: 100vh;
    background-color: #f5f5f5;
}

.content-inner {
    padding: 24rpx 24rpx 48rpx;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24rpx;
    margin-bottom: 24rpx;
}

.stats-item {
    background: #fff;
    border-radius: 16rpx;
    padding: 32rpx 24rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.stats-value {
    font-size: 40rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 8rpx;
}

.stats-label {
    font-size: 24rpx;
    color: #999;
}

.card-wrap {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    padding: 32rpx 24rpx;
    box-sizing: border-box;
}

.card-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 24rpx;
}

.stats-detail {
    display: flex;
    flex-direction: column;
}

.detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f5f5f5;

    &:last-child {
        border-bottom: none;
    }
}

.detail-label {
    font-size: 28rpx;
    color: #666;
}

.detail-value {
    font-size: 28rpx;
    color: #333;
}
</style>
