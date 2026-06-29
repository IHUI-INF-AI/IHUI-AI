<template>
    <view class="" @click.stop="handleClick()">
        <view v-if="status.payCrowd == 1 && isVip && isVip > 0" class="vip_label">
            <image src="https://file.aizhs.top/sys-mini/default/vip_label.png" mode="widthFix" class="label_icon">
            </image>
            <text class="label_title">会员免费</text>
        </view>
        <view v-if="status.payType == 0" class="vip_label">
            <image style="margin-top: 2rpx;" src="https://file.aizhs.top/sys-mini/default/mian_label.png"
                mode="widthFix" class="label_icon"></image>
            <text class="label_title" style="color: #80BEFF;">免费使用</text>
        </view>
        <view v-if="status.payType == 1 && status.payCrowd == 0" class="vip_label">
            <image style="margin-top: 2rpx;" src="https://file.aizhs.top/sys-mini/default/xian_label.png"
                mode="widthFix" class="label_icon"></image>
            <text class="label_title" style="color: #FF8A8A;">限时免费</text>
        </view>
        <view
            v-if="((status.payType == 1 && status.payCrowd == 1) || (status.payType == 2 && status.payCrowd == 1)) && isVip == 0"
            class="vip_label">
            <image style="margin-top: 2rpx;width: 22rpx;" src="https://file.aizhs.top/sys-mini/default/yue_label.png"
                mode="widthFix" class="label_icon"></image>
            <text class="label_title" style="color: #FF1818;overflow: auto;">{{
                status.amount ? (status.amount / 100).toFixed(2) : ''
            }}</text>
        </view>
        <view v-if="status.payType == 2 && !status.payCrowd" class="vip_label" style="background-color: #5E56FF;">
            <image src="https://file.aizhs.top/sys-mini/default/yibuy_label.png" mode="widthFix" class="label_icon">
            </image>
            <text class="label_title" style="color: #FFF;">已购买</text>
        </view>
    </view>
</template>
<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
    pay: Object
})

const emit = defineEmits(['showPay'])

const userInfo = ref(null)
const isVip = ref(false)
const status = ref({})

watch(() => props.pay, (n) => {
    if (n) {
        nextTick(() => {
            userInfo.value = uni.getStorageSync('data');
            console.log('userInfo', userInfo.value)
            isVip.value = userInfo.value.isVip

            status.value = n
            console.log('pay', status.value, isVip.value)
        })
    }
}, { immediate: true })

function handleClick() {
    emit('showPay')
}
</script>
<style lang="scss" scoped>
.vip_label {
    background-color: #000;
    border-radius: 12rpx;
    height: 32rpx;
    z-index: 2;
    font-size: 24rpx;
    width: calc(4em + 46rpx);
    padding: 0;
    box-sizing: border-box;
    display: flex;
    justify-content: center;

    .label_icon {
        height: 28rpx;
        width: 28rpx;
        display: block;
        float: left;
        margin-top: 2rpx;
        margin-right: 0;
    }

    .label_title {
        font-size: 24rpx;
        color: #F8B34E;
        font-weight: bold;
        line-height: 32rpx;
        width: calc(4em + 8rpx);
        text-align: center;
        white-space: nowrap;
    }
}
</style>
