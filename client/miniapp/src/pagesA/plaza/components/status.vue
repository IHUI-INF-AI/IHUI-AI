<template>
    <view class="status_tab_body">
        <view class="f_n" @click="change(2)" v-if="value == 2">
            <image class="icon" style="margin-bottom: 6rpx;height: 58rpx;" mode="heightFix" src="https://file.aizhs.top/sys-mini/xtk/plaza_icon11.png" />
            <view class="font_color">待接单</view>
        </view>
        <view class="f_n" @click="change(2)" v-else>
            <image class="icon" style="margin-bottom: 6rpx;height: 58rpx;" mode="heightFix" src="https://file.aizhs.top/sys-mini/xtk/plaza_icon01.png" />
            <view class="font_nomal">待接单</view>
        </view>
        <view class="f_n" @click="change(4)" v-if="value == 4">
            <image class="icon" style="width: 50rpx;height: 58rpx;margin-bottom: 6rpx;margin-top: 4rpx;"
                src="https://file.aizhs.top/sys-mini/xtk/plaza_icon12.png" mode="heightFix" />
            <view class="font_color">开发中</view>
        </view>
        <view class="f_n" @click="change(4)" v-else>
            <image class="icon" style="width: 50rpx;height: 58rpx;margin-bottom: 6rpx;margin-top: 4rpx;"
                src="https://file.aizhs.top/sys-mini/xtk/plaza_icon02.png" mode="heightFix" />
            <view class="font_nomal">开发中</view>
        </view>
        <view class="f_n" @click="change(6)" v-if="value == 6">
            <image class="icon" style="width: 56rpx;height: 58rpx;margin-bottom: 6rpx;" mode="heightFix" src="https://file.aizhs.top/sys-mini/xtk/plaza_icon13.png" />
            <view class="font_color">已完成</view>
        </view>
        <view class="f_n" @click="change(6)" v-else>
            <image class="icon" style="width: 56rpx;height: 58rpx;margin-bottom: 6rpx;" mode="heightFix" src="https://file.aizhs.top/sys-mini/xtk/plaza_icon03.png" />
            <view class="font_nomal">已完成</view>
        </view>
        <view class="f_n" @click="change(9)" v-if="value == 9">
            <image class="icon" style="width: 58rpx;height: 58rpx;margin-bottom: 6rpx;" mode="heightFix"
                src="https://file.aizhs.top/sys-mini/xtk/plaza_icon14.png" />
            <view class="font_color">我的任务</view>
        </view>
        <view class="f_n" @click="change(9)" v-else>
            <image class="icon" style="width: 58rpx;height: 58rpx;margin-bottom: 6rpx;" mode="heightFix"
                src="https://file.aizhs.top/sys-mini/xtk/plaza_icon04.png" />
            <view class="font_nomal">我的任务</view>
        </view>
        <!-- <view>
            <image v-if="!showSetPath" @click.stop="toSet" class="kaifa" mode="heightFix"
            src="https://file.aizhs.top/sys-mini/xtk/add_kf.png" style="opacity: 0.6;height: 58rpx;margin: 0 auto 6rpx;" />
            <view v-if="!showSetPath" class="change_info_btn f_c" @click="() => { showBottom = true }">
                <text>切换身份</text>
            </view>
        </view> -->
    </view>
</template>
<script setup>
import { ref } from 'vue'

const emit = defineEmits(['change'])

const value = ref(2)

const change = (val) => {
    value.value = val
    emit('change', val)
}
</script>
<style lang="scss" scoped>
.status_tab_body {
    display: flex;
    align-items: center;
    justify-content: space-around;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 0;

    .icon {
        width: 67rpx;
        height: 67rpx;
    }

    .f_n {
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 26rpx;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .font_nomal {
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 26rpx;
        color: #bbbbbb;
    }

    .font_color {
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 26rpx;
        font-weight: bold;
        color: #787AFF;
    }
}

.kaifa {
    // position: fixed;
    // right: 36rpx;
    // bottom: 182rpx;
    width: 116rpx;
    height: 116rpx;
    z-index: 100;
    background-color: rgba(255, 255, 255, 0.5);
    border-radius: 8rpx;
    backdrop-filter: blur(10px);
    display: block;
}
.change_info_btn {
    width: 166rpx;
    height: 48rpx;
    width: 116rpx;
    border-radius: 15rpx;
    background: #f4f4f4;
    box-shadow: 0rpx 0rpx 4rpx 0rpx rgba(0, 0, 0, 0.6);
    font-family: "AlimamaFangYuanTi";
    font-size: 26rpx;
    font-weight: bold;
    color: rgba(0, 0, 0, 0.9804);
    border-width: 2px;
    border-style: solid;
    border-color: rgba(195, 158, 255, 0.938);
    box-sizing: border-box;
    right: 36rpx;
    bottom: 120rpx;
}

</style>