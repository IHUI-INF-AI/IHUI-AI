<template>
    <view class="card_body" @click.stop="toModel">
        <view class="top">
            <view class="base_datas">
                <view class="head">
                    <image class="head-image" :src="datas.agentAvatar" mode="widthFix" lazy-load="true" />
                </view>
                <view class="content_main">
                    <view class="title" style="margin-bottom: 8rpx;">{{ datas.agentName }}</view>
                    <view class="title-sub">{{ datas.agentDescription }}</view>
                </view>
                <view class="">
                    <view class="hot_number">
                        <image class="hot_number-image" src="/static/images/user_group.png"
                            mode="widthFix" />
                        <view>{{ numResult(datas.usageCount) }}</view>
                    </view>
                </view>
            </view>
            <view class="top-footer">
                <view class="footer-left">
                    <image class="footer-left-image" src="/static/images/logo.png"
                        mode="widthFix" />
                    <view>智汇社区-官方</view>
                </view>
                <view class="footer-right">
                    <!-- 提示 -->
                    <view class="footer_image" style="width: 35rpx;height: 35rpx;margin-right: 24rpx;flex: none;">
                        <image @click.stop="intelliShow"
                            style="width: 35rpx;height: 35rpx;margin-right: 24rpx;flex: none;"
                            src="/static/images/warning.png" mode="widthFix" />
                    </view>

                    <!-- 点赞 -->
                    <view style="margin-right: 24rpx;display: flex;align-items: center;">
                        <view v-if="isThumbs == 0" class="footer_image" style="width: 43rpx;height: 35rpx;flex: none;">
                            <image @click.stop="getAgentLike" style="width: 43rpx;height: 35rpx;flex: none;"
                                src="/static/images/like.png" mode="widthFix" />
                        </view>
                        <view v-else class="footer_image" style="width: 43rpx;height: 35rpx;flex: none;">
                            <image @click.stop="getAgentLike" style="width: 43rpx;height: 35rpx;flex: none;"
                                src="/static/images/like_active.png" mode="widthFix" />
                        </view>
                        <text class="good_text">{{ datas.likeCount }}</text>
                    </view>
                    <!-- 收藏 -->
                    <view style="margin-right: 24rpx;">
                        <view v-if="item.isCollect == 0" class="footer_image"
                            style="width: 43rpx;height: 35rpx;flex: none;">
                            <image @click.stop="getAgentCollect" style="width: 43rpx;height: 35rpx;flex: none;"
                                src="/static/images/shoucang.png" mode="widthFix" />
                        </view>
                        <view v-else class="footer_image" style="width: 43rpx;height: 35rpx;flex: none;">
                            <image @click.stop="getAgentCollect" style="width: 43rpx;height: 35rpx;flex: none;"
                                src="/static/images/choucang_active.png" mode="widthFix" />
                        </view>
                    </view>
                    <view class="pay_detail-body" @click="showDetail" v-if="type == 'old'">
                        <view class="pay_detail">购买详情</view>
                        <image class="pay_detail-image" src="/static/images/down.png"
                            mode="widthFix" />
                    </view>
                    <view class="buy_icon" v-if="type == 'new'">
                        <image class="buy_icon-body" src="/static/images/pay_icon_body.png"
                            mode="widthFix" />
                        <!-- 会员免费 -->
                        <image v-if="datas.userType == 'freevip'" class="buy_icon-icon"
                            src="/static/images/free_vip_icon.png" mode="widthFix" />
                        <image v-if="datas.userType == 'freevip'" class="buy_icon-text"
                            src="/static/images/free_vip.png" mode="widthFix" />
                        <!-- 免费使用 -->
                        <image v-if="datas.userType == 'freeuse'" class="buy_icon-icon"
                            src="/static/images/free_use_icon.png" mode="widthFix" />
                        <image v-if="datas.userType == 'freeuse'" class="buy_icon-text"
                            src="/static/images/free_use.png" mode="widthFix" />
                        <!-- 限时免费 -->
                        <image v-if="datas.userType == 'freetime'" class="buy_icon-icon"
                            src="/static/images/free_time_icon.png" mode="widthFix" />
                        <image v-if="datas.userType == 'freetime'" class="buy_icon-text"
                            src="/static/images/free_time.png" mode="widthFix" />
                        <!-- 已购买 -->
                        <image v-if="datas.userType == 'hasbuy'" class="buy_icon-icon"
                            src="/static/images/hasbuy_icon.png" mode="widthFix" />
                        <image v-if="datas.userType == 'hasbuy'" style="width: 76rpx;right: 23rpx;"
                            class="buy_icon-text" src="/static/images/hasbuy.png"
                            mode="widthFix" />
                        <!-- 每月 -->
                        <image v-if="datas.userType == 'buymonth'" style="top: 12rpx;" class="buy_icon-icon"
                            src="/static/images/buymonth_icon.png" mode="widthFix" />
                        <image v-if="datas.userType == 'buymonth'" class="buy_icon-text"
                            src="/static/images/buymonth.png" mode="widthFix" />
                    </view>
                </view>
            </view>
        </view>
        <view class="bottom" v-show="details">
            <view class="" style="margin-bottom: 18rpx;">关联订单号：{{ datas.connectorId }}</view>
            <view class="">购买时间：{{ datas.createdAt }}<text style="margin-left: 18rpx;">到期时间：{{ datas.updatedAt }}</text>
            </view>
            <view class="bb" style="margin-top: 18rpx;">
                <image class="bb-image" src="/static/images/paybymonth.png" mode="widthFix" />
                <view class="money">￥{{ datas.allToken }}</view>
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref } from 'vue'
import { getAgentCollect, getAgentLike } from "@/service/pay.js"

const props = defineProps({
    datas: {
        type: Object,
        default: () => ({})
    },
    type: {
        type: String,
        default: 'old'
    }
})

const emit = defineEmits(['intelliShow', 'getAgentLike', 'getAgentCollect'])

const details = ref(false)
const isCollect = ref(0)
const isThumbs = ref(0)

function intelliShow() {
    emit('intelliShow', props.datas.prologue)
}

function getAgentLikeHandler() {
    getAgentLike(props.datas.id).then(res => {
        if (res.message == '点赞成功') {
            props.datas.likeCount += 1
            props.datas.isThumbs = 1
        } else {
            props.datas.likeCount -= 1
            props.datas.isThumbs = 0
        }
    })
    emit('getAgentLike', props.datas.botId)
}

function getAgentCollectHandler() {
    getAgentCollect(props.datas.id).then(res => {
        if (res.success == true) {
            isCollect.value = isCollect.value == 0 ? 1 : 0
        }
    })
    emit('getAgentCollect', props.datas.botId)
}

function showDetail() {
    details.value = !details.value
}

function toModel() {
    let userInfodata = uni.getStorageSync('data')
    if (!userInfodata) {
        userInfodata = uni.getStorageSync('userInfo')
    }
    if (!userInfodata) {
        uni.showToast({
            title: '请先登录',
            icon: 'none'
        })
        return
    }
}

function numResult(num) {
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + '万'
    } else {
        return num
    }
}
</script>
<style lang="scss" scoped>
.card_body {
    border-radius: 30rpx;
    border: 1rpx solid #DADADA;
    width: calc(100vw - 36rpx);
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
                    font-family: AlimamaFangYuanTi !important;
                }

                .title-sub {
                    font-size: 20rpx;
                    color: #414141;
                    font-weight: normal;
                    font-family: AlimamaFangYuanTi !important;
                }
            }

            .hot_number {
                display: flex;
                align-items: center;
                color: #000;
                font-size: 20rpx;

                .hot_number-image {
                    width: 22rpx;
                    height: 19rpx;
                    margin-right: 5rpx;
                }
            }
        }

        .top-footer {
            display: flex;
            justify-content: space-between;
            margin-top: 30rpx;

            .footer-left {
                display: flex;
                align-items: center;
                color: #7B7B7B;
                font-size: 20rpx;
                font-family: AlimamaFangYuanTi !important;

                .footer-left-image {
                    margin-right: 12rpx;
                    width: 46rpx;
                    height: 46rpx;
                }
            }

            .footer-right {
                display: flex;
                align-items: center;

                .footer_image {
                    overflow: hidden;
                }

                .good_text {
                    font-family: AlimamaFangYuanTi !important;
                    font-size: 20rpx;
                    font-weight: 600;
                    color: #373737;
                }

                .pay_detail-body {
                    display: flex;
                    align-items: center;

                    .pay_detail-image {
                        width: 18rpx;
                    }
                }

                .pay_detail {
                    font-family: AlimamaFangYuanTi !important;
                    color: #7B61FF;
                    border-bottom: 1rpx solid #7B61FF;
                }
            }
        }
    }

    .bottom {
        border-top: 1rpx solid #DADADA;
        padding: 14rpx 30rpx;
        color: #3D3D3D;
        font-size: 20rpx;
        font-family: AlimamaFangYuanTi !important;

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
</style>
