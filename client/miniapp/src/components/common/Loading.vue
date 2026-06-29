<template>
    <view class="loading" :class="{ 'loading-full': fullscreen }">
        <view class="loading-spinner">
            <view class="spinner-item"></view>
            <view class="spinner-item"></view>
            <view class="spinner-item"></view>
        </view>
        <text class="loading-text" v-if="text">{{text}}</text>
    </view>
</template>

<script setup>
defineProps({
    text: {
        type: String,
        default: '加载中...'
    },
    fullscreen: {
        type: Boolean,
        default: false
    }
})
</script>

<style lang="scss">
.loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: $uni-spacing-large;
    
    &.loading-full {
        position: fixed;
        inset: 0;
        background-color: rgba($background-color, 0.8);
        z-index: 999;
    }
    
    .loading-spinner {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: $spacing-base;
        
        .spinner-item {
            width: 20rpx;
            height: 20rpx;
            background-color: $primary-color;
            border-radius: $border-radius-circle;
            margin: 0 6rpx;
            animation: loading 1.4s infinite ease-in-out;
            
            &:nth-child(1) {
                animation-delay: -0.32s;
            }
            
            &:nth-child(2) {
                animation-delay: -0.16s;
            }
        }
    }
    
    .loading-text {
        font-size: $font-size-base;
        color: $text-color-light;
    }
}

@keyframes loading {
    0%, 80%, 100% {
        transform: scale(0);
    }

    40% {
        transform: scale(1);
    }
}
</style>
