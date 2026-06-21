<template>
    <view class="card_body">
        <view class="top">
            <view class="base_datas">
                <view class="head">
                    <image class="head-image" src="" mode="widthFix" lazy-load="true" />
                </view>
                <view class="content_main">
                    <view class="title" style="margin-bottom: 8rpx;">{{ datas.name }}</view>
                    <view class="title-sub">{{ datas.subname }}</view>
                </view>
                <view class="" v-if="root == 'group'">
                    <view class="hot_number">
                        <image class="hot_number-image" src="/static/images/xtk/user_group.png"
                            mode="widthFix" />
                        <view>{{ datas.mumber }}</view>
                    </view>
                </view>
            </view>
            <view class="top_footer" style="margin-top: 30rpx;" v-if="root == 'group'">
                <view class="footer-left">
                    <image class="footer-left-image" src="/static/images/xtk/logo.png"
                        mode="widthFix" />
                    <view>智汇社区-官方</view>
                </view>
                <view class="footer-right">
                    <image class="icons" src="/static/images/xtk/warning.png" mode="widthFix" />
                    <image class="icons" src="/static/images/xtk/unlike.png" mode="widthFix" />
                    <image class="icons" src="/static/images/xtk/unstore.png" mode="widthFix" />
                    <image class="icons" src="/static/images/xtk/uninfo.png" mode="widthFix" />
                    <image class="icons" src="/static/images/xtk/unshare.png" mode="widthFix" />
                    <view class="pay_detail-body" @click="showDetail" v-if="type == 'view'">
                        <view class="pay_detail">购买详情</view>
                        <image class="pay_detail-image" src="/static/images/xtk/down.png"
                            mode="widthFix" />
                    </view>
                    <view class="buy_icon" v-if="type == 'buy'">
                        <image class="buy_icon-body" src="/static/images/xtk/pay_icon_body.png"
                            mode="widthFix" />
                        <image v-if="datas.userType == 'freevip'" class="buy_icon-icon"
                            src="/static/images/xtk/free_vip_icon.png" mode="widthFix" />
                        <image v-if="datas.userType == 'freevip'" class="buy_icon-text"
                            src="/static/images/xtk/free_vip.png" mode="widthFix" />
                        <image v-if="datas.userType == 'freeuse'" class="buy_icon-icon"
                            src="/static/images/xtk/free_use_icon.png" mode="widthFix" />
                        <image v-if="datas.userType == 'freeuse'" class="buy_icon-text"
                            src="/static/images/xtk/free_use.png" mode="widthFix" />
                        <image v-if="datas.userType == 'freetime'" class="buy_icon-icon"
                            src="/static/images/xtk/free_time_icon.png" mode="widthFix" />
                        <image v-if="datas.userType == 'freetime'" class="buy_icon-text"
                            src="/static/images/xtk/free_time.png" mode="widthFix" />
                        <image v-if="datas.userType == 'hasbuy'" class="buy_icon-icon"
                            src="/static/images/xtk/hasbuy_icon.png" mode="widthFix" />
                        <image v-if="datas.userType == 'hasbuy'" style="width: 76rpx;right: 23rpx;"
                            class="buy_icon-text" src="/static/images/xtk/hasbuy.png"
                            mode="widthFix" />
                        <image v-if="datas.userType == 'buymonth'" style="top: 12rpx;" class="buy_icon-icon"
                            src="/static/images/xtk/buymonth_icon.png" mode="widthFix" />
                        <image v-if="datas.userType == 'buymonth'" class="buy_icon-text"
                            src="/static/images/xtk/buymonth.png" mode="widthFix" />
                    </view>
                </view>
            </view>
            
        </view>
        <view class="top_footer-model" v-if="root == 'model'">
            <view class="top_footer-model-image_body">
                <image class="top_footer-model-image" src="/static/images/xtk/model_card_btn_bg.png" mode="widthFix" lazy-load="false"></image>
                <view class="top_footer-model-text_icon">
                    {{ '设置' }}
                </view>
            </view>
            <view class="top_footer-model-text">
                <text ></text>
            </view>
        </view>
        <view class="bottom" v-show="details">
            <view class="" style="margin-bottom: 18rpx;">关联订单号：{{ datas.payid }}</view>
            <view class="">购买时间：{{ datas.startTime }}<text style="margin-left: 18rpx;">到期时间：{{ datas.endTime }}</text>
            </view>
            <view class="bb" style="margin-top: 18rpx;">
                <image class="bb-image" src="/static/images/xtk/paybymonth.png" mode="widthFix" />
                <view class="money">￥{{ datas.money }}</view>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
    datas: {
        type: Object,
        default: () => {
            return {}
        }
    },
    type: {
        type: String,
        default: 'view'
    },
    root: {
        type: String,
        default: 'group',
        validator: (val) => {
            return ['group', 'model'].includes(val)
        }
    }
})

const details = ref(false)

const showDetail = () => {
    details.value = !details.value
}
</script>

<style lang="scss" scoped>
.card_body {
    border-radius: 30rpx;
    border: 1rpx solid #DADADA;
    width: calc(100vw - 40rpx);
    margin-bottom: 18rpx;

    .top {
        padding: 21rpx;

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
                    font-family: AlimamaFangYuanTi;
                }

                .title-sub {
                    font-size: 24rpx;
                    color: #414141;
                    font-weight: normal;
                    font-family: AlimamaFangYuanTi;
                }
            }

            .hot_number {
                display: flex;
                align-items: center;
                color: #000000;
                font-size: 20rpx;

                .hot_number-image {
                    width: 22rpx;
                    height: 19rpx;
                    margin-right: 5rpx;
                }
            }
        }

    }

    .bottom {
        border-top: 1rpx solid #DADADA;
        padding: 14rpx 30rpx;
        color: #3D3D3D;
        font-size: 20rpx;
        font-family: AlimamaFangYuanTi;

        .bb {
            display: flex;
            align-items: center;
            justify-content: space-between;

            .bb-image {
                width: 150rpx;
                height: 40rpx;
                margin-left: -13rpx;
            }

            .money {
                color: #7B61FF;
                font-size: 30rpx;
            }
        }
    }
}

.buy_icon {
    position: relative;

    .buy_icon-body {
        width: 150rpx;
        height: 40rpx;
        margin-bottom: -14rpx;
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

.top_footer {
    display: flex;
    justify-content: space-between;

    .footer-left {
        display: flex;
        align-items: center;
        color: #7B7B7B;
        font-size: 20rpx;
        font-family: AlimamaFangYuanTi;

        .footer-left-image {
            margin-right: 12rpx;
            width: 46rpx;
            height: 46rpx;
        }
    }

    .footer-right {
        display: flex;
        align-items: center;

        .icons {
            margin-right: 24rpx;
            width: 35rpx;
            height: 35rxp;
        }

        .pay_detail-body {
            display: flex;
            align-items: center;

            .pay_detail-image {
                width: 18rpx;
            }
        }

        .pay_detail {
            font-family: AlimamaFangYuanTi;
            color: #7B61FF;
            border-bottom: 1rpx solid #7B61FF;
        }
    }
}

.top_footer-model {
    display: flex;
    border-width: 1rpx 0 0 0;
    border-style: solid;
    border-color: #DADADA;
    position: relative;
    flex-direction: row-reverse;

    .top_footer-model-image {
        width: 140rpx;
        height: 60rpx;
    }

    .top_footer-model-text_icon {
        position: absolute;
        bottom: 20rpx;
        right: 40rpx;
    }

    .top_footer-model-image_body {
        display: flex;
        align-items: center;
    }

    .top_footer-model-text {
        flex: 1;
        display: flex;
        align-items: center;

        color: #3D3D3D;
        font-size: 24rpx;
        font-family: AlimamaFangYuanTi;
        font-weight: 500;
    }
}
</style>