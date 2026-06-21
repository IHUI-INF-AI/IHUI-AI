<template>
    <view class="type-container">
        <view class="type-bottom">
            <view class="type-bottom-top">
                <view>
                    <image style="width: 100rpx; height: 100rpx"
                        src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/xuancai@2x.png"
                        mode="aspectFill"></image>
                </view>
                <view style="width: 100%;padding-left: 24rpx">
                    <view style="padding-top: 24rpx;font-size: 34rpx;font-weight: bold;color:black">AI智汇社 | 私董会创始人 | 李总
                    </view>
                    <view style="color:">为您推荐</view>
                </view>
            </view>
            <view style="margin-top: 20rpx;padding: 20rpx 40rpx;color:brown;font-size: 32rpx;font-weight: bold;">
                扫描下方二维码,可免费进入智汇社社群,
                群内定期免费分享AI信息并有专属客服为您服务</view>
            <view style="display: flex;justify-content: center;align-items: center">
                <image class="type-ewm" style="width: 380rpx; height: 380rpx"
                    src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/ewm@2x.png"
                    mode="aspectFill"></image>
            </view>
            <!-- <view style="display: flex;justify-content: center;margin-top: 30rpx;font-size: 36rpx;font-weight: bold;">
                <view class="type-button">购买¥18888</view>
            </view> -->
        </view>
    </view>
</template>
<style lang="less" scoped>
.type-container {
    width: 100vw;
    height: 100vh;
    background-color: #fff;
}

.type-image {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

.type-title {
    width: 100%;
    position: fixed;
    top: 20rpx;
    color: white;
    font-size: 32rpx;
    font-weight: bold;
    text-align: center;
}

.type-bottom {
    position: fixed;
    top: 100rpx;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0 30rpx 60rpx 30rpx;
}

.type-bottom-top {
    padding: 10rpx 30rpx;
    display: flex;
    justify-content: space-between;
    border-top-left-radius: 30rpx;
    border-top-right-radius: 30rpx;
    background: linear-gradient(180deg, #f4f4fb 0%, #9395e4 100%);
}

.type-button {
    text-align: center;
    width: 250rpx;
    height: 84rpx;
    line-height: 80rpx;
    border-radius: 15rpx;
    background: linear-gradient(180deg, #ea5252 0%, #2a1280 100%);
}
</style>
