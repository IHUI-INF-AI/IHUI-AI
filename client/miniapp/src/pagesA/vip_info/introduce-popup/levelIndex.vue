<template>
    <view class="introduce-popup blur-background" @click="close">
        <view class="popup-content" :class="{ 'popup-show': showPopup }" @click.stop>
            <view class="popup-container">
                <view class=""
                    style="width: 100%;    display: flex;align-items: flex-end;justify-content: space-between; ">
                    <image style="width: 370rpx;height: 45rpx;"
                        src="https://file.aizhs.top/sys-mini/headertitley.png" mode=""></image>
                    <image style="width: 288rpx;height: 25.96rpx;"
                        src="https://file.aizhs.top/sys-mini/headertitlet.png" mode=""></image>
                </view>
                <!-- 图标区域 -->
                <view style="display: flex;align-items: flex-end;justify-content: center;position: relative;padding-top: 20rpx;padding-bottom: 10rpx;">
                    <view class="view_content" style="position: absolute;left: 0;top: 20rpx;display: flex;align-items: center;">
                        <image src="https://file.aizhs.top/sys-mini/default/zuan.png" mode="widthFix" style="width: 111rpx;height: 111rpx;"></image>
                        <image src="https://file.aizhs.top/sys-mini/default/zuan_title.png" mode="widthFix" style="width: 111rpx;height: 111rpx;"></image>
                    </view>
                    <view style="position: absolute;left: 0;bottom: 10rpx;display: flex;align-items: center;flex-direction: column;color: #f00;">
                        <view>会员等级升级机制</view>
                        <view>1¥=1点成长值</view>
                    </view>
                    <view class="avatar-section-wrapper">
                        <image class="avatar-section-top"
                            v-if="userInfoDatas.isVIP == 1 && userInfoDatas.identityTypy == 0"
                            src="https://file.aizhs.top/sys-mini/danshuzhiq.png" mode="widthFix" />
                        <image class="avatar-section-top"
                            v-else-if="userInfoDatas.isVIP == 1 && userInfoDatas.identityTypy == 1"
                            src="https://file.aizhs.top/sys-mini/danshuzhiq.png" mode="widthFix" />
                        <image class="avatar-section-top"
                            v-else-if="userInfoDatas.isVIP == 0 && userInfoDatas.identityTypy == 0"
                            src="https://file.aizhs.top/sys-mini/pt-head.png" mode="widthFix" />
                        <view class="avatar-section">
                            <image
                                :src="avatarPic ? avatarPic : 'https://file.aizhs.top/sys-mini/daixaodiming.png'"
                                class="avatar-image" mode="aspectFill" />
                        </view>
                    </view>
                    <image style="width:245rpx;position: absolute;right: 0;bottom: 10rpx;" src="https://file.aizhs.top/sys-mini/saomaa.jpg"
                        mode="widthFix" />
                </view>
                <view class="benefit-item" style="margin-bottom: 6rpx;">
                    <view class="level-text">0级:智域访客,升级会员享受折扣包含全部课程/算力/自动化智能体/知识库/定制服务等,持续增加功能</view>
                </view>
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
                <view
                    style="width: 100%;padding-bottom: 10rpx;text-align: center;display: flex;justify-content: center;align-items: flex-end;">
                    <image style="text-align: center;width:348rpx;" src="https://file.aizhs.top/sys-mini/yejiao.png"
                    mode="widthFix" />
                </view>
                <!-- 底部按钮 -->
                <view  class="bottom-button" @click="handleOpen">
                    去开通
                </view>

            </view>
        </view>
    </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { pay } from "@/utils/pay/index.js"
import { getvipPrice } from "@/service/vip.js"

const props = defineProps({
    isShow: {
        type: Boolean,
        default: false
    },
    btnFlag: {
        type: Boolean,
        default: false
    },
    userInfoDatas: {
        type: Object,
    },
})

const emit = defineEmits(['openPopup'])

const showPopup = ref(true)
const benefits = ref([
    { id: 1, content: '限时消费<span style="font-weight: bold;color: #FF0000;">588</span>开通会员,获赠<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">1级:算法萌芽</span>' },
    { id: 2, content: '达到<span style="font-weight: bold;color: #FF0000;">1500</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">2级:数智启源</span>，享受<span style="font-weight: bold;color: #FF0000;">9.8</span>折' },
    { id: 3, content: '达到<span style="font-weight: bold;color: #FF0000;">3000</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">3级:模型初阶</span>，享受<span style="font-weight: bold;color: #FF0000;">9.5</span>折' },
    { id: 4, content: '达到<span style="font-weight: bold;color: #FF0000;">4500</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">4级:智探先驱</span>，享受<span style="font-weight: bold;color: #FF0000;">9.2</span>折' },
    { id: 5, content: '达到<span style="font-weight: bold;color: #FF0000;">6000</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">5级:算构初阶</span>，享受<span style="font-weight: bold;color: #FF0000;">8.9</span>折' },
    { id: 6, content: '达到<span style="font-weight: bold;color: #FF0000;">7500</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">6级:数据专家</span>，享受<span style="font-weight: bold;color: #FF0000;">8.6</span>折' },
    { id: 7, content: '达到<span style="font-weight: bold;color: #FF0000;">9000</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">7级:智垒中枢</span>，享受<span style="font-weight: bold;color: #FF0000;">8.3</span>折' },
    { id: 8, content: '达到<span style="font-weight: bold;color: #FF0000;">10500</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">8级:智能领航</span>，享受<span style="font-weight: bold;color: #FF0000;">8</span>折' },
    { id: 9, content: '达到<span style="font-weight: bold;color: #FF0000;">12000</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">9级:量子智脑</span>，享受<span style="font-weight: bold;color: #FF0000;">7.7</span>折' },
    { id: 10, content: '达到<span style="font-weight: bold;color: #FF0000;">18888</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">10级:超维先知</span>，享受<span style="font-weight: bold;color: #FF0000;">7</span>折' }
])
const moreBenefitsText = ref('')
const dataInfo = ref({})
const showFlag = ref(false)
const avatarPic = ref('')

function close() {
    uni.navigateBack({ delta: 1 })
}

function handleOpen() {
    emit("openPopup")
}

function handleTouchMove(e) {
    e.stopPropagation()
}

onMounted(() => {
    avatarPic.value = uni.getStorageSync('avatarPic')
    uni.$on('setAvatarPic', (data) => {
        avatarPic.value = data
    })
    const systemInfo = uni.getSystemInfoSync()
    if (systemInfo.osName == "ios") {
        showFlag.value = false
    } else {
        showFlag.value = true
    }
})
</script>

<style>
.introduce-popup {
    -webkit-transform: translateZ(0);
    top: 0;
    left: 0;
    width: 93%;
    height: auto;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    perspective: 1200px;
    background-image: linear-gradient(to bottom right, rgb(205 208 255 / 0.7) 0%, rgb(253 255 225 / 0.7) 100%);
    box-shadow: 0 0 8rpx 0 rgb(0 0 0 / 0.1);
    margin: 40rpx auto 0;
    border-radius: 15rpx;
}

.popup-content {
    position: relative;
    width: 100%;
    height: auto;
    border-radius: 20rpx;
    overflow: hidden;
    transform: translateY(100vh) rotateX(5deg);
    transition: all 0.3s ease-in-out;
    opacity: 0.8;
}

.popup-content.popup-show {
    transform: translateY(0) rotateX(0deg);
    opacity: 1;
}

.popup-container {
    width: 100%;
    height: 100%;
    padding: 20rpx 10rpx;
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
    font-family: AlimamaFangYuanTi;
}

.ai-text {
    font-size: 26rpx;
    color: #8257e6;
    font-weight: bold;
    margin-top: 5rpx;
}

.icon-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 0 20rpx;
    padding: 0 0rpx 0 20rpx;
    color: #FFF98F;
}

.icon-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 130rpx;
    height: 130rpx;
    margin-right: 50rpx;
}

.tips {
    width: 225rpx;
    color: #F00;
    margin-top: 10rpx;
    margin-left: 10rpx;
}

.level-text {
    color: #8D83FF;
    font-size: 24rpx;
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
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 6rpx;
    -webkit-overflow-scrolling: touch;
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
    height: 64rpx;
    background-color: #fff;
    border-radius: 15rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 auto;
    font-size: 48rpx;
    font-weight: bold;
    color: #333;
    border: 1rpx solid rgb(255 255 255 / 0.8);
    box-shadow: 0 0 10rpx rgb(0 0 0 / 0.15), inset 0 0 0 rgb(255 255 255 / 1);
    background-image: linear-gradient(to bottom, #fff, #f9f9f9);
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
}
</style>
