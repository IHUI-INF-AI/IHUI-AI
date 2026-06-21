<template>
    <view class="plaza_head">
        <view class="" style="height: 60rpx;"></view>
        <view class="content">
            <image class="go_back_image" @click="goBack" src="https://file.aizhs.top/sys-mini/default/back.svg"
                mode="widthFix" />
            <image class="menu_image" @click="menu" src="https://file.aizhs.top/sys-mini/backf2.png"
                mode="widthFix" />
            <!-- <image class="menu_image" @click="menu" src="https://file.aizhs.top/sys-mini/fl.pic.jpg"
                mode="widthFix" /> -->
            <view class="title">
                <text>发布广场</text>
            </view>
        </view>
    </view>
</template>
<script setup>
const emit = defineEmits(['goBack'])

const goBack = () => {
    emit('goBack')
}

const menu = () => { }
</script>
<style lang="scss" scoped>
.plaza_head {
    box-sizing: border-box;
    width: 100%;
    height: 108rpx;

    .content {
        display: flex;
        box-sizing: border-box;
        align-items: center;
    }

    .title {
        flex: 1;
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 40rpx;
        font-weight: normal;
        color: #000000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .go_back_image {
        width: 32rpx;
        height: 23rpx;
        margin-left: 32rpx;
    }

    .menu_image {
        width: 36rpx;
        height: 36rpx;
        margin-left: 24rpx;
    }
}
</style>