<template>
    <view class="buy_icon" @click.stop="buyThisModel">
        <Loading v-if="loading"></Loading>
        <image class="buy_icon-body" src="/static/images/pay_icon_body.png" mode="widthFix" />
        <!-- 会员免费 -->
        <!-- <image v-if="itemData.type == 'freevip'" class="buy_icon-icon"
            src="/static/images/free_vip_icon.png" mode="widthFix" />
        <image v-if="itemData.type == 'freevip'" class="buy_icon-text"
            src="/static/images/free_vip.png" mode="widthFix" /> -->
        <!-- 免费使用 -->
        <image v-if="itemData.type == '1'" class="buy_icon-icon"
            src="/static/images/free_use_icon.png" mode="widthFix" />
        <image v-if="itemData.type == '1'" class="buy_icon-text" src="/static/images/free_use.png"
            mode="widthFix" />
        <!-- 限时免费 -->
        <image v-if="itemData.type == '2'" class="buy_icon-icon"
            src="/static/images/free_time_icon.png" mode="widthFix" />
        <image v-if="itemData.type == '2'" class="buy_icon-text" src="/static/images/free_time.png"
            mode="widthFix" />
        <!-- 已购买 -->
        <image v-if="itemData.type == '4'" class="buy_icon-icon"
            src="/static/images/hasbuy_icon.png" mode="widthFix" />
        <image v-if="itemData.type == '4'" style="width: 76rpx;right: 23rpx;" class="buy_icon-text"
            src="/static/images/hasbuy.png" mode="widthFix" />
        <!-- 每月 -->
        <image v-if="itemData.type == '3'" style="top: 12rpx;" class="buy_icon-icon"
            src="/static/images/buymonth_icon.png" mode="widthFix" />
        <image v-if="itemData.type == '3'" class="buy_icon-text" src="/static/images/buymonth.png"
            mode="widthFix" />
        <view class="pay_mask" v-if="show">

            <view class="pay_window">
                <view class="base_datas">
                    <view class="head">
                        <image class="head-image" :src="itemData.agentAvatar" mode="widthFix" lazy-load="true" />
                    </view>
                    <view class="content_main m_b">
                        <view class="title m_b" style="margin-bottom: 8rpx;">{{ itemData.agentName }}</view>
                        <view class="title-sub">{{ detail.prologue }}</view>
                    </view>
                </view>
                <view class="f_n m_b">价格：{{ price }} 元 / {{ typeChilds[detail.type_child] || '月' }}</view>

                <view class="f_n m_b">折扣：{{ discounts[detail.discount_month] || '无' }}</view>
                <view class="f_n m_b" style="display: flex; align-items: center;">
                    <text>{{ typeChilds[detail.type_child] || '月' }}：</text>
                    <image @click="() => { if (count > 1) count-- }" class="pay_icon"
                        src="/static/images/pay_delete.png" mode="widthFix" />
                    <text>{{ count }}</text>
                    <image @click="() => { count++ }" class="pay_icon"
                        src="/static/images/pay_add.png" mode="widthFix" />
                </view>
                <view class="b_f" @click.stop="toPay">
                    <text>立即支付</text>
                    <text>￥</text>
                    <text>{{ real_price }}</text>
                </view>
                <view class="discount">折扣￥{{ discount }}</view>
            </view>

        </view>
    </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getChargeInfoById, createPayHistory } from '@/service/aiModels.js'
import Loading from "@/components/loading/index.vue";
import { pay } from "@/utils/pay/index.js";

const props = defineProps({
    itemData: {
        type: Object,
        default: () => ({})
    }
})

const loading = ref(false)
const real_price = ref('')
const discount = ref('无')
const count = ref(1)
const show = ref(false)
const detail = ref({})
const typeChilds = {
    '1': '月',
    '2': '年',
    '3': '永久'
}
const price = ref(0)
const discounts = {
    '1': '8折',
    '2': '7折',
    '3': '5折'
}

watch(count, (n) => {
    let priceVal = (price.value * count.value).toFixed(2)
    if (detail.value.discount_month) {
        if (detail.value.discount_month == '1') {
            real_price.value = (priceVal * 0.8).toFixed(2)
        }
        if (detail.value.discount_month == '2') {
            real_price.value = (priceVal * 0.7).toFixed(2)
        }
        if (detail.value.discount_month == '3') {
            real_price.value = (priceVal * 0.5).toFixed(2)
        }
        discount.value = priceVal - real_price.value

    } else {
        real_price.value = priceVal
        discount.value = '无'
    }
})

function buyThisModel() {
    loading.value = true

    getChargeInfoById(props.itemData.agentId).then(res => {
        loading.value = false
        show.value = true
        detail.value = res.data
        price.value = (res.data.account / 100).toFixed(2)
    }).finally(() => {
        loading.value = false
    })
}

function toPay() {
    loading.value = true
    if (!real_price.value) {
        real_price.value = (price.value * count.value).toFixed(2) * 100
    } else {
        real_price.value = real_price.value + 100
    }
    const userInfo = uni.getStorageSync("data");
    let params = {
        agent_id: props.itemData.agentId || '',
        agent_name: props.itemData.agentName || '',
        agent_order_uuid: detail.value.create_uuid || '',
        bug_uuid: userInfo.uuid || '',
        bug_name: userInfo.nickname || '',
        category_id: detail.value.id || '',
        discount: detail.value.discount_month || 100,
        real_price: real_price.value || '',
        price: detail.value.account || '',
        count: count.value || '',
        prologue: detail.value.prologue || ''
    }
    createPayHistory(params).then(res => {
        loading.value = false
        show.value = false
        pay("", "", res.data.id, 0, 4)

    })
}
</script>

<style lang="scss" scoped>
.buy_icon {
    position: relative;

    .buy_icon-body {
        width: 150rpx;
        height: 40rpx;
        display: block;
        
    }

    .buy_icon-icon {
        width: 24rpx;
        height: 21rpx;
        position: absolute;
        top: 15rpx;
        left: 20rpx;
    }

    .buy_icon-text {
        width: 82rpx;
        height: 20rpx;
        position: absolute;
        top: 15rpx;
        right: 20rpx;
    }
}

.pay_mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    // background-color: rgba(0, 0, 0, 0.3);

}

.pay_window {
    // width: 750rpx;
    width: 600rpx;
    height: 400rpx;
    box-sizing: border-box;
    padding-left: 26rpx;
    position: relative;
    background-color: #fff;
    position: fixed;

}

.pay_icon {
    width: 30rpx;
    height: 30rpx;
}

.discount {
    position: absolute;
    top: 20rpx;
    right: 6rpx;
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 24rpx;
    font-weight: bold;
    color: #8B91FF;
}

.base_datas {
    display: flex;

    .head {
        margin-right: 18rpx;

        .head-image {
            width: 84rpx;
            height: 84rpx;
            border-radius: 15rpx;
        }
    }

    .content_main {
        flex: 1;

        .title {
            text-shadow: 0rpx 4rpx 10rpx #D3D3D3;
            color: #517BFF;
            font-size: 30rpx;
            font-weight: normal;
            font-family: "AlimamaFangYuanTi" !important;
        }

        .title-sub {
            font-size: 24rpx;
            color: #414141;
            font-weight: normal;
            font-family: "AlimamaFangYuanTi" !important;
        }
    }
}

.b_f {
    width: calc(100% - 52rpx);
    box-sizing: border-box;
    background: linear-gradient(98deg, rgba(205, 208, 255, 0.3) 4%, rgba(253, 255, 225, 0.3) 104%);
    box-shadow: 0rpx 4rpx 10rpx 0rpx rgba(0, 0, 0, 0.3), 0rpx -6rpx 20rpx 0rpx rgba(255, 255, 255, 0.8);
    height: 100rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    // margin-right: 26rpx;
    color: #000;
}

.f_n {
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 24rpx;
    font-weight: normal;
    color: #3D3D3D;
}

.m_b {
    margin-bottom: 18rpx;
}
</style>
