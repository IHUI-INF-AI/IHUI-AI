<template>
    <view class="loading-mask">
        <view class="loading-container">
            <view class="loading-spinner"></view>
            <text class="loading-text">加载中...</text>
        </view>
    </view>
</template>

<script setup>
</script>

<style lang="scss" scoped>
.loading-mask {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 991;
    /* 确保足够高的z-index覆盖所有元素 */
}

.loading-container {
    background-color: #ffffff;
    padding: 40rpx;
    border-radius: 20rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 0 20rpx rgba(0, 0, 0, 0.1);
}

.loading-spinner {
    width: 100rpx;
    height: 100rpx;
    border: 6rpx solid #f3f3f3;
    border-top: 6rpx solid #8278F0;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.loading-text {
    margin-top: 30rpx;
    font-size: 32rpx;
    font-weight: bold;
    color: #666;
}
</style>
