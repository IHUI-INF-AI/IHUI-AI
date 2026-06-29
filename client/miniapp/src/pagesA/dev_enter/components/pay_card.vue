<template>
    <view class="card_body">
        <view class="font_title margin_bottom">关联订单号：{{ datas.order_no }}</view>
        <view class="font_title margin_bottom">下单时间：{{ datas.create_time.replace("T", " ") }}</view>
        <view class="base_info margin_bottom">
            <image class="base_image" :src="datas.agent_avatar" mode="widthFix" />
            <view class="">
                <view class="title margin_bottom">{{ datas.agent_name }}</view>
                <view class="sub font_nomal">{{ datas.prologue }}</view>
            </view>
        </view>
        <view class="font_nomal margin_bottom">价格：{{ datas.accountType }}</view>
        <view class="font_nomal">折扣：{{ datas.discount_month_desc || '无' }}</view>
        <view class="right_top">
            <view class="model_icon_body" v-if="datas.withdrawal == 1">
                <view class="font_title">已购买</view>
            </view>
            <view class="model_icon_body_unbuy" v-else>
                <view class="font_title">已购买</view>
            </view>
            <view class="font_nomal margin_bottom" v-if="datas.settlement == 1">已结算</view>
            <view class="font_nomal margin_bottom pay_end" v-else>待结算</view>
            <view class="has_num">×{{ datas.total }}</view>
        </view>
        <view class="right_bottom">￥{{ datas.groupAccount }}</view>
    </view>
</template>
<script setup>
import { computed } from 'vue'

const props = defineProps({
    datas: {
        type: Object,
        default: () => { return {} }
    }
})

const typeChilds = {
    '1': '月',
    '2': '年',
    '3': '永久'
}

const discounts = {
    '1': '8折',
    '2': '7折',
    '3': '5折'
}

const accountType = computed(() => {
    return typeChilds[props.datas.type] ? props.datas.price + typeChilds[props.datas.type] : '永久'
})

const discount_month_desc = computed(() => {
    return discounts[props.datas.discount] || '无'
})
</script>
<style lang="scss" scoped>
.card_body {
    margin: 0 30rpx;
    padding: 25rpx;
    background-color: #FFF;
    border-radius: 15rpx;
    position: relative;
    margin-bottom: 20rpx;
    box-shadow: 0 4rpx 10rpx 0 rgb(0 0 0 / 0.1);

    .font_title {
        font-family: AlimamaFangYuanTi !important;
        font-size: 26rpx;
        font-weight: normal;
        color: #000;
    }

    .font_nomal {
        font-family: AlimamaFangYuanTi !important;
        font-size: 24rpx;
        font-weight: normal;
        color: #000;
    }

    .margin_bottom {
        margin-bottom: 15rpx;
    }

    .base_info {
        display: flex;
        align-items: center;
    }

    .base_image {
        width: 120rpx;
        height: 120rpx;
        border-radius: 15rpx;
        margin-right: 20rpx;
    }

    .title {
        font-family: AlimamaFangYuanTi !important;
        font-size: 28rpx;
        font-weight: normal;
        color: #000;
    }

    .sub {
        font-family: AlimamaFangYuanTi !important;
        font-size: 20rpx;
        font-weight: normal;
        color: #979797;
    }

    .right_top {
        position: absolute;
        top: 30rpx;
        right: 25rpx;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }

    .model_icon_body {
        background-color: #F5F5F5;
        width: 120rpx;
        height: 50rpx;
        border-radius: 30rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 10rpx;
    }

    .model_icon_body_unbuy {
        background-color: #F5F5F5;
        width: 120rpx;
        height: 50rpx;
        border-radius: 30rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 10rpx;
    }

    .pay_end {
        color: #FF6B00;
    }

    .has_num {
        background-color: #7B61FF;
        width: 40rpx;
        height: 40rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: AlimamaFangYuanTi !important;
        font-size: 20rpx;
        font-weight: normal;
        color: #FFF;
    }

    .right_bottom {
        position: absolute;
        bottom: 25rpx;
        right: 25rpx;
        font-family: AlimamaFangYuanTi !important;
        font-size: 30rpx;
        font-weight: normal;
        color: #FF6B00;
    }
}
</style>