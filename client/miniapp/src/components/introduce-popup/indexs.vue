<template>
    <view class="introduce-popup blur-background" v-if="isShow" @click="close">
        <view class="popup-content" :class="{ 'popup-show': showPopup }" @click.stop>
            <view class="popup-container">
                <!-- <image src="https://file.aizhs.top/sys-mini/caopanshouqy.png" mode="widthFix" style="width: 100%;" /> -->
                <view class=""
                    style="width: 100%;    display: flex;align-items: flex-end;justify-content: space-between; ">
                    <image style="width: 370rpx;height: 45rpx;"
                        src="/static/images/headertitley.png" mode=""></image>
                    <image style="width: 288rpx;height: 25.96rpx;"
                        src="/static/images/headertitlet.png" mode=""></image>
                </view>
                <view style="display: flex;align-items: flex-end;justify-content: space-between;">
                    <image style="width:237rpx;"
                        src="/static/images/cps.jpg" mode="widthFix" />
                    <view class="avatar-section-wrapper">
                        <image class="avatar-section-top"
                            v-if="userInfoDatas.isVIP == 1 && userInfoDatas.identityTypy == 0"
                            src="/static/images/danshuzhiq.png" mode="widthFix" />
                        <image class="avatar-section-top"
                            v-else-if="userInfoDatas.isVIP == 1 && userInfoDatas.identityTypy == 1"
                            src="/static/images/danshuzhiq.png" mode="widthFix" />
                        <image class="avatar-section-top"
                            v-else-if="userInfoDatas.isVIP == 0 && userInfoDatas.identityTypy == 0"
                            src="/static/images/pt-head.png" mode="widthFix" />
                        <view class="avatar-section">
                            <image
                                :src="avatarPic ? avatarPic : '/static/images/daixaodiming.png'"
                                class="avatar-image" mode="aspectFill" />
                        </view>
                    </view>

                    <image style="width:245rpx;" src="/static/images/saomaa.jpg"
                        mode="widthFix" />
                </view>
                <!-- 标题区域 -->
                <!-- <view class="popup-header">
                    <text class="welcome-text">WELCOME</text>
                    <text class="ai-text">IKUIINF-AI</text>
                </view> -->

                <!-- 图标区域 -->
                <!-- <view class="icon-section">
                    <view class="icon-item">
                        <image src="/static/images/Vector.png" mode="aspectFit" />
                        <view>操盘手权益</view>
                    </view>
                    <image src="/static/images/Ellipse.png" class="avatar-image"
                        mode="aspectFit" />
                    <image src="/static/images/soamazixun.png" class="consult-image"
                        mode="aspectFit" />
                    <image src="/static/images/erweima.png" class="qr-image" mode="aspectFit" />
                </view> -->

                <!-- 权益列表 -->
                <view class="benefits-list" @touchmove="handleTouchMove">
                    <view class="benefit-item" v-for="item in benefits" :key="item.id">
                        <text class="benefit-number">{{ item.id }}.</text>
                        <rich-text :nodes="item.content" class="benefit-content"></rich-text>
                    </view>
                </view>

                <!-- 更多权益信息 -->
                <view class="more-benefits">
                    <rich-text :nodes="moreBenefitsText"></rich-text>
                </view>

                <!-- 底部版权信息 -->
                <view class="copyright">
                    COPYRIGHT © 2024 IKUIINE-AI ALL RIGHTS RESERVED.
                </view>
                <!-- 底部按钮 -->
                <view style="display: flex;justify-content: center;gap: 20rpx;">
                    <view class="bottom-button" @click="handleOpen">
                        加入我们
                    </view>
                    <view class="bottom-button dark-button" @click="closehandleOpen">
                        再咨询一下
                    </view>
                </view>

            </view>
        </view>
    </view>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { pay } from "@/utils/pay/index.js";

const props = defineProps({
    isShow: {
        type: Boolean,
        default: false
    },
    dataInfo: {
        type: Object,
        default: () => ({})
    },
    userInfoDatas: {
        type: Object,
    },
})

const emit = defineEmits(['close'])

const showPopup = ref(false)
const benefits = ref([
    { id: 1, content: '享受大额分销资格，<span style="font-weight: bold;">入驻</span>社区服务商名列' },
    { id: 2, content: '会员等级拉满，享受<span style="font-weight: bold;">全部</span>满级折扣等权益' },
    { id: 3, content: '二级分销权益，快速扩张<span style="font-weight: bold;">团队</span>及收益，创办一人公司' },
    { id: 4, content: '最新研发前沿<span style="font-weight: bold;">agentic</span>内测免费使用资格<span style="font-weight: bold;">一年</span>' },
    { id: 5, content: '插队定制独家定制<span style="font-weight: bold;">agent</span>功能<span style="font-weight: bold;">8</span>折优惠' },
    { id: 6, content: '创始人<span style="font-weight: bold;">一对一</span>随时答疑陪跑' },
    { id: 7, content: '<span style="font-weight: bold;">AI</span>深度认知课/<span style="font-weight: bold;">AI</span>专家一对一陪跑教学/升维课程/深度商业课/流量全链路打法课程/免费观看' },
    { id: 8, content: '<span style="font-weight: bold;">AI</span>+垂类账号孵化优先陪跑机会/加入<span style="font-weight: bold;">MCN</span>机会' },
    { id: 9, content: '公司总部入驻及线下学习实操机会' },
    { id: 10, content: '插队<span style="font-weight: bold;">AI</span>分身/<span style="font-weight: bold;">AI</span>客服定制开通' }
])
const moreBenefitsText = ref('............约 <span style="font-weight: bold;">20</span> 项权益, 且持续增加 ↑')
const avatarPic = ref('')

watch(() => props.isShow, (val) => {
    if (val) {
        setTimeout(() => {
            showPopup.value = true
        }, 50)
    } else {
        showPopup.value = false
    }
})

onMounted(() => {
    avatarPic.value = uni.getStorageSync('avatarPic')
    uni.$on('setAvatarPic', (data) => {
        avatarPic.value = data
    })
})

function close() {
    showPopup.value = false
    setTimeout(() => {
        emit("close")
    }, 300)
}

async function handleOpen() {
    try {
        uni.showLoading({
            title: '支付中...',
            mask: true
        })

        const result = await pay("", props.dataInfo.amount, props.dataInfo.id, 1, 2)

        setTimeout(() => {
            uni.hideLoading()
            close()
            uni.showToast({
                title: '支付成功',
                icon: 'success',
                duration: 2000
            })
        }, 1000)

        return result
    } catch (error) {
        uni.hideLoading()
        uni.showToast({
            title: '支付失败或已取消',
            icon: 'none',
            duration: 2000
        })
    }
}

function closehandleOpen() {
    close()
}

function handleTouchMove(e) {
    e.stopPropagation()
}
</script>

<style>
.introduce-popup {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    z-index: 99999;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    perspective: 1200px;
}

.popup-content {
    position: relative;
    width: 100%;
    /* max-width: 730rpx; */
    height: 80vh;
    border-radius: 20rpx;
    overflow: hidden;
    transform: translateY(100vh) rotateX(5deg);
    transition: all 0.3s ease-in-out;
    opacity: 0.8;
    background-image: linear-gradient(to bottom right, rgba(205, 208, 255, 0.7) 0%, rgba(253, 255, 225, 0.7) 100%);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2), inset 0 -1px 2px rgba(255, 255, 255, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.7);
}

.popup-content.popup-show {
    transform: translateY(0) rotateX(0deg);
    opacity: 1;
}

.popup-container {
    width: 100%;
    height: 100%;
    padding: 40rpx 30rpx;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
    box-sizing: border-box;
    backdrop-filter: blur(3px);
}

.popup-header {
    display: flex;
    align-items: center;
    margin-bottom: 20rpx;
    gap: 20rpx;
    justify-content: center;
}

.welcome-text {
    font-size: 40rpx;
    font-weight: bold;
    letter-spacing: 2rpx;
    color: #000;
    font-family: monospace;
}

.ai-text {
    font-size: 26rpx;
    color: #8257e6;
    font-weight: bold;
    margin-top: 5rpx;
}

.icon-section {
    display: flex;
    justify-content: space-around;
    align-items: center;
    margin: 20rpx 0 40rpx;
    padding: 0 20rpx;
    color: #FFF98F;
}

.icon-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 150rpx;
    height: 130rpx;
    margin-right: 0rpx;
}


.avatar-image {
    width: 100%;
    height: 100%;
    border-radius: 50%;
}

.consult-image {
    width: 100rpx;
    height: 130rpx;
}

.qr-image {
    width: 130rpx;
    height: 130rpx;
}

.benefits-list {
    flex: 1;
    overflow-y: auto;
    margin-bottom: 20rpx;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
    -webkit-overflow-scrolling: touch; /* 增加iOS流畅滚动 */
}

.benefit-item {
    display: flex;
    align-items: flex-start;
    border: 1px solid #f3f4f6;
    padding: 8rpx;
    border-radius: 15rpx;
    font-size: 28rpx;
    color: #1f2937;
}

.benefit-number {
    font-weight: bold;
    padding-right: 8rpx;
}

.benefit-content {
    flex: 1;
}

.more-benefits {
    text-align: center;
    font-size: 26rpx;
    color: #D94646;
}

.bottom-button {
    width: 356rpx;
    height: 80rpx;
    background-color: #fff;
    border-radius: 30rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 20rpx auto;
    font-size: 30rpx;
    font-weight: 500;
    color: #333;
    border: 1rpx solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 1);
    background-image: linear-gradient(to bottom, #ffffff, #f9f9f9);
}

.dark-button {
    background-color: #333333;
    background-image: none;
    color: #ffffff;
    border: 1rpx solid #222222;
    box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.25);
}

.copyright {
    font-size: 18rpx;
    color: #999;
    text-align: center;
    margin-top: 10rpx;
}
.avatar-section-wrapper {
    display: inline-block;
    position: relative;
}

.avatar-section-top {
    top: -13%;
    z-index: 100;
    position: absolute;
    width: 154rpx;
}

.avatar-section {
    width: 176rpx;
    height: 176rpx;
    border-radius: 50%;
    overflow: hidden;
    border: 1px solid #BFBEFF;
    box-shadow: 0px 0px 6px 0px rgba(0, 0, 0, 0.3);
}
</style>
