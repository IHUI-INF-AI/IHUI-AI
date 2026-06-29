<template>
    <view class="nav-bar tech-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="nav-content">
            <view class="left ripple-btn" @click="goBack" v-if="showBack">
                <text class="iconfont icon-back"></text>
            </view>
            <view class="title">
                <text class="title-text">{{title}}</text>
                <view class="title-line" v-if="title"></view>
            </view>
            <view class="right">
                <slot name="right"></slot>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
    title: {
        type: String,
        default: ''
    },
    showBack: {
        type: Boolean,
        default: true
    }
})

const statusBarHeight = ref(0)

onMounted(() => {
    const systemInfo = uni.getSystemInfoSync()
    statusBarHeight.value = systemInfo.statusBarHeight
})

function goBack() {
    uni.navigateBack({
        delta: 1
    })
}
</script>

<style lang="scss">
.nav-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 999;
    background-color: rgb(18 18 23 / 0.9);
    backdrop-filter: blur(25px);
    border-bottom: 1px solid rgb(0 242 255 / 0.15);
    box-shadow: 0 0 15px rgb(0 0 0 / 0.3);
    transition: all 0.3s ease;
    
    &.tech-glass {
        &::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(to right, 
                transparent, 
                rgb(0 242 255 / 0.7),
                rgb(139 92 246 / 0.7),
                transparent
            );
            box-shadow: 0 0 15px rgb(0 242 255 / 0.6);
        }
    }
    
    .nav-content {
        height: 44px;
        display: flex;
        align-items: center;
        padding: 0 32rpx;
        
        .left {
            width: 70rpx;
            height: 70rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            border-radius: 50%;
            border: 1px solid rgb(0 242 255 / 0.3);
            background-color: rgb(31 31 40 / 0.8);
            box-shadow: 0 0 10px rgb(0 0 0 / 0.2);
            margin-right: 10rpx;
            transition: transform 0.25s ease, background-color 0.25s ease;
            
            &:active {
                transform: scale(0.9);
                background-color: rgb(0 242 255 / 0.2);
            }
            
            .iconfont {
                font-size: 36rpx;
                color: #FFF;
                text-shadow: 0 0 8px rgb(0 242 255 / 0.5);
            }
        }
        
        .title {
            flex: 1;
            text-align: center;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            
            .title-text {
                font-size: 36rpx;
                color: #FFF;
                font-weight: 600;
                letter-spacing: 1px;
                text-shadow: 0 0 10px rgb(255 255 255 / 0.2);
            }
            
            .title-line {
                width: 60rpx;
                height: 6rpx;
                margin-top: 8rpx;
                background: linear-gradient(to right, #00F2FF, #8B5CF6);
                border-radius: 8rpx;
                opacity: 0.9;
                box-shadow: 0 0 10px rgb(0 242 255 / 0.5);
            }
        }
        
        .right {
            width: 80rpx;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: flex-end;
        }
    }
}

.ripple-btn {
    overflow: hidden;
    position: relative;
    
    &::after {
        content: '';
        display: block;
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        pointer-events: none;
        background-image: radial-gradient(circle, rgb(0 242 255 / 0.4) 10%, transparent 10.01%);
        background-repeat: no-repeat;
        background-position: 50%;
        transform: scale(10, 10);
        opacity: 0;
        transition: transform 0.5s, opacity 0.5s;
    }
    
    &:active::after {
        transform: scale(0, 0);
        opacity: 0.5;
        transition: 0s;
    }
}
</style> 
