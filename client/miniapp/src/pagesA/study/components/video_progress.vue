<template>
    <view class="">
        <view class="modal_overlay"></view>
        <view class="agent-content agent-content1" style="padding-bottom: 4rpx; z-index: 1002;">
            <view class="agent_content_box">
                <view class="agent_back"></view>
                <scroll-view class="agent_content thinking-scroll-view" ref="thinkingContent" scroll-y="true"
                    :scroll-top="scrollTopVal">
                    <view class="agent_content_title">
                        <view class="agent_content_title_top">
                            <image src="https://file.aizhs.top/sys-mini/default/sikao.png"
                                class="agent_content_title_top_img" mode="widthFix"></image>
                            <text style="color: #000;">视频上传中</text>
                            <div class="loader-container">
                                <div class="loader-dot"></div>
                                <div class="loader-dot"></div>
                                <div class="loader-dot"></div>
                                <div class="loader-dot"></div>
                            </div>
                        </view>

                        <view class="thinking-progress-container" style="position: relative;">
                            <view class="thinking-progress-bar" :style="{ width: thinkingProgress + '%' }"></view>
                            <view class="thinking-progress-text">
                                {{ Math.floor(thinkingProgress) }}%
                            </view>
                        </view>
                    </view>
                </scroll-view>
            </view>
        </view>
    </view>
</template>
<script setup>
import { computed } from 'vue'

const props = defineProps({
    totalSize: Number,
    overSize: Number,
    totalCount: Number,
    voerCount: Number,
    title: {
        type: String,
        default: '视频上传中'
    }
})

const thinkingProgress = computed(() => {
    return (props.overSize * 100 / props.totalSize).toFixed(1)
})
</script>
<style lang="scss" scoped>
/* 蒙层样式 */
.modal_overlay {
    position: fixed;
    z-index: 1001;
    inset: 0;
    background: rgb(0 0 0 / 0.3);
}

.agent-content {
    height: auto;
    z-index: 999;
    box-sizing: border-box;
    white-space: pre-wrap;
    word-wrap: break-word;
    word-break: break-all;
    font-family: AlimamaFangYuanTi;
}

.agent-content>view::after {
    content: '';
    display: block;
    clear: both;
}

.agent-content1 {
    position: fixed;
    height: auto !important;
    max-height: calc(50vh);
    z-index: 1001;
    top: calc((100vh - 50vh) / 2);
    left: 60rpx;
    box-shadow: 0 0 10rpx 0 rgb(0 0 0 / 0.3);
    border-radius: 20rpx;
    overflow: hidden;
    background: linear-gradient(101deg, rgb(255 255 255 / 1) 4%, rgb(255 255 225 / 1) 104%);
    width: calc(100% - 80rpx);
}

.agent_content_box {
    position: relative;
    height: 100%;
    width: 100%;
    opacity: 0.4;
}

@keyframes rotate {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.agent_back {
    background: linear-gradient(to right, #f691ff 30%, #090df6 50%, #3EFFBE 70%);
    position: absolute;
    inset: -300rpx;
    animation: rotate 5s linear infinite;
}

.agent_content {
    position: relative;
    inset: 4rpx;
    background-color: rgb(226 226 226);
    border-radius: 20rpx;
    overflow-y: auto;
    z-index: 9;
    width: calc(100% - 8rpx) !important;
    height: auto !important;
    box-sizing: border-box;
    margin: 0 !important;
    opacity: 1;
    padding: 20rpx !important;
}

/* 思考滚动视图 */
.thinking-scroll-view {
    font-size: 28rpx;
    color: #666;
    padding: 0 20rpx;
    max-height: calc(50vh - 8rpx);
    width: calc(100% - 8rpx);
    margin: 3rpx;
    box-sizing: border-box;
    background-color: #fff;
    margin-bottom: 4rpx !important;
}

/* 进度条样式 */
.thinking-progress-container {
    width: 100%;
    height: 36rpx;
    background-color: #f0f0f0;
    border-radius: 12rpx;
    margin: 15rpx 0;
    overflow: hidden;
}

.thinking-progress-bar {
    height: 100%;
    background: linear-gradient(214deg, #8B0BFF 3%, #FFF200 30%, #f00 55%, #FFF200 75%, #9014FF 96%);
    background-size: 200% 100%;
    border-radius: 12rpx;
    transition: width 0.3s ease;
    animation: progressAnimation 2s infinite;
}

/* 进度条动画效果 */
@keyframes progressAnimation {
    0% {
        background-position: 0% 50%;
    }

    50% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0% 50%;
    }
}

/* 思考进度条文本 */
.thinking-progress-text {
    position: absolute;
    left: 50%;
    line-height: 36rpx;
    transform: translateX(-50%);
    color: #000;
    top: 0;
}

.agent_content_title_top_img {
    width: 30rpx;
    height: 30rpx;
    margin-right: 10rpx;
}

.agent_content_title {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
}

.agent_content_title_top {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    .loader-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 3.75em;
        transform: scale(0.8);
    }
}

.loader-dot {
    height: 0.8125em;
    width: 1.25em;
    margin-right: 0.625em;
    border-radius: 0.625em;
    background-color: #ae44d1;
    animation: loaderpulse 1.5s infinite ease-in-out;
}

@keyframes loaderpulse {
    0% {
        transform: scale(0.8);
        background-color: #d7b3fc;
        box-shadow: 0 0 0 0 rgb(196 178 252 / 0.7);
    }

    50% {
        transform: scale(1.2);
        background-color: #ae44d1;
        box-shadow: 0 0 0 0.625em rgb(178 212 252 / 0);
    }

    100% {
        transform: scale(0.8);
        background-color: #d7b3fc;
        box-shadow: 0 0 0 0 rgb(196 178 252 / 0.7);
    }
}

.loader-dot:last-child {
    margin-right: 0;
}

.loader-dot:nth-child(1) {
    animation-delay: -0.1875s;
}

.loader-dot:nth-child(2) {
    animation-delay: -0.0625s;
}

.loader-dot:nth-child(3) {
    animation-delay: 0.0625s;
}

.agent_content_con {
    width: 100%;
    overflow: hidden;
    white-space: initial;
    color: transparent;
    background-image: linear-gradient(to bottom, transparent 50%, rgb(0 0 0 / 0.5) 50%);
    -webkit-background-clip: text;
    background-clip: text;
}

.agent-content-item {
    white-space: pre-wrap;
    word-wrap: break-word;
    word-break: break-all;
    background-color: #fff;
    border-radius: 30rpx;
    opacity: 1;
    background: #F6F6F6;
    box-sizing: border-box;
    border: 1px solid #EEE;
    width: 100%;
    float: left;
    margin-top: 20rpx;
    padding: 20rpx;
    font-size: 22rpx;
    font-weight: normal;
    line-height: 28rpx;
    letter-spacing: 0.02em;
    color: #333;
}

.agent-content-item-question {
    background: #9A99F3;
    box-sizing: border-box;
    border: 2rpx solid;
    border-image: linear-gradient(275deg, rgb(252 255 77 / 0.5) -32%, rgb(76 32 116 / 0) 5%, rgb(54 16 88 / 0) 98%, rgb(54 16 88 / 0.5) 129%) 2;
    border-radius: 15rpx;
    float: right;
    margin-top: 20rpx;
    padding: 20rpx;
    font-size: 22rpx;
    font-weight: normal;
    line-height: 28rpx;
    letter-spacing: 0.02em;
    font-variation-settings: "BEVL" 100, "opsz" auto;
    color: #FFF;
}
</style>
