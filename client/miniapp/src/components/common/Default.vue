<template>
    <view class="default-container">
        <image
          class="default-image"
          style="width: 100%;height: 100%"
          src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/card/background.png"
          mode="aspectFill"
        ></image>
        <view class="default-center">
            <view style="display: flex;justify-content: center;align-items: center">
                <image
                    class="default-robot"
                    style="width: 500rpx; height: 500rpx"
                    src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/hello2.png"
                    mode="aspectFill"
                ></image>
            </view>
            <view style="display: flex;justify-content: center;margin-top: 30rpx;font-size: 36rpx;font-weight: bold;">
                <view class="default-button" @click="handleRefresh">刷新</view>
            </view>
        </view>
    </view>
</template>

<script setup>
const emit = defineEmits(['refresh'])

function handleRefresh() {
    emit('refresh')
}
</script>

<style lang="less" scoped>
    .default-container{
        width: 100%;
        height: 100%;
    }
    .default-image{
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
    }
    .default-center{
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 0 30rpx;
    }
    .default-button{
        text-align: center;
        width: 200rpx;
        height: 84rpx;
        line-height: 80rpx;
        border-radius: 30rpx;
        background: linear-gradient(180deg, #52d8ea 0%, #ffffff 100%);
    }
</style>
