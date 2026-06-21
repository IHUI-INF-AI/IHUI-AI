<template>
    <view class="color_bg">
        <view class="color_cont f_n">
            <image class="icon_tip" src="https://file.aizhs.top/sys-mini/xtk/study_icon_tip.png" />
            <view class="scroll-container">
                <view class="tip-text-wrapper">
                    <text class="tip-text">智汇AI 云教育/短视频  欢迎所有AI相关视频上传分享</text>
                    <text class="tip-text">智汇AI 云教育/短视频  欢迎所有AI相关视频上传分享</text>
                </view>
            </view>
            <view class="my_model f_c" @click="toMyModel()">
                <text>我的合集</text>
            </view>
        </view>
    </view>
</template>
<script setup>
const emit = defineEmits(['toMyModel'])

function toMyModel() {
    emit('toMyModel')
}
</script>
<style lang="scss" scoped>
.icon_tip {
    width: 48rpx;
    height: 48rpx;
    margin-right: 12rpx;
}

.scroll-container {
    flex: 1;
    overflow: hidden;
    position: relative;
    height: 40rpx;
    display: flex;
    align-items: center;
}

.tip-text-wrapper {
    position: absolute;
    display: flex;
    align-items: center;
    white-space: nowrap;
    animation: scroll-left 8s linear infinite;
}

.tip-text {
    font-family: Alimama FangYuanTi VF !important;
    font-size: 28rpx;
    font-weight: bold;
    color: #666666;
    white-space: nowrap;
    padding-right: 20rpx;
}

@keyframes scroll-left {
    0% {
        transform: translateX(0);
    }
    100% {
        transform: translateX(-50%);
    }
}

.my_model {
    width: 144rpx;
    box-sizing: border-box;
    color: #000;
    border-radius: 12rpx;
    border: 1px solid #518dfd !important;
    box-shadow: 0 0 5rpx 0 rgba(0, 0, 0, 0.3);
    background: #d9e6fd !important;
    backdrop-filter: blur(10px);
    font-weight: bold;
    margin-right: 4rpx;
}

.color_bg {
    background: #d9e6fd;
    padding: 2rpx;
    border-radius: 15rpx;
    overflow: hidden;
    width: 100%;
    margin-bottom: 18rpx;

    .color_cont {
        width: 100%;
        background-color: #eee;
        background-size: 100% 100%;
        background-repeat: no-repeat;
        border-radius: 15rpx;
        height: auto;
        box-sizing: border-box;
        padding: 4rpx 6rpx;
    }
}

.f_n {
    display: flex;
    align-items: center;
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
