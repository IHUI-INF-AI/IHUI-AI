<template>
    <view class="settings-page">
        <SettingsPageLayout title="聊天记录">
            <view class="content-inner">
                <view v-if="chatList.length === 0" class="empty-state">
                    <text class="empty-text">暂无聊天记录</text>
                </view>
                <view v-else class="chat-list">
                    <view
                        v-for="(item, index) in chatList"
                        :key="index"
                        class="chat-item"
                    >
                        <view class="chat-content">
                            <text class="chat-summary">{{ item.summary }}</text>
                            <text class="chat-time">{{ item.time }}</text>
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

const chatList = ref([])
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

.chat-list {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
}

.chat-item {
    padding: 32rpx 24rpx;
    border-bottom: 1rpx solid #f5f5f5;

    &:last-child {
        border-bottom: none;
    }
}

.chat-content {
    display: flex;
    flex-direction: column;
}

.chat-summary {
    font-size: 28rpx;
    color: #333;
    line-height: 1.5;
    margin-bottom: 12rpx;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.chat-time {
    font-size: 24rpx;
    color: #999;
}
</style>
