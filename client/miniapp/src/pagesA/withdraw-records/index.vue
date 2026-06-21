<template>
    <view class="settings-page">
        <SettingsPageLayout title="提现记录">
            <view class="content-inner">
                <view v-if="records.length === 0" class="empty-state">
                    <text class="empty-text">暂无提现记录</text>
                </view>
                <view v-else class="record-list">
                    <view
                        v-for="(item, index) in records"
                        :key="index"
                        class="record-item"
                    >
                        <view class="record-info">
                            <text class="record-amount">-{{ item.amount }} 元</text>
                            <text class="record-time">{{ item.time }}</text>
                        </view>
                        <view class="record-status" :class="'status-' + item.status">
                            <text>{{ item.statusText }}</text>
                        </view>
                    </view>
                </view>
            </view>
        </SettingsPageLayout>
    </view>
</template>

<script setup>
import { ref } from 'vue'
import SettingsPageLayout from '@/pagesA/settings/common/SettingsPageLayout.vue'

const records = ref([])
</script>

<style lang="scss" scoped>
.settings-page {
    min-height: 100vh;
    background-color: #f5f5f5;
}

.content-inner {
    padding: 24rpx 24rpx 48rpx;
}

.empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 120rpx 0;
}

.empty-text {
    font-size: 28rpx;
    color: #999;
}

.record-list {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
}

.record-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 32rpx 24rpx;
    border-bottom: 1rpx solid #f5f5f5;

    &:last-child {
        border-bottom: none;
    }
}

.record-info {
    display: flex;
    flex-direction: column;
}

.record-amount {
    font-size: 32rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 8rpx;
}

.record-time {
    font-size: 24rpx;
    color: #999;
}

.record-status {
    font-size: 26rpx;
}

.status-pending {
    color: #ff9500;
}

.status-success {
    color: #34c759;
}

.status-failed {
    color: #ff3b30;
}
</style>
