<template>
    <view class="introduce-popup blur-background" @click="close">
        <!-- <navigation-bars color="black" viscosity="true" :image="'https://file.aizhs.top/sys-mini/default/back.svg'"
            :title="title" style="opacity: 0;" /> -->
        <view class="popup-content" :class="{ 'popup-show': showPopup }" @click.stop>
            <view class="popup-container">
                <!-- 顶部标题 -->
                <view class=""
                    style="width: 100%;    display: flex;align-items: flex-end;justify-content: space-between; ">
                    <image style="width: 370rpx;height: 45rpx;"
                        src="https://file.aizhs.top/sys-mini/headertitley.png" mode=""></image>
                    <image style="width: 288rpx;height: 25.96rpx;"
                        src="https://file.aizhs.top/sys-mini/headertitlet.png" mode=""></image>
                </view>
                <view style="display: flex;align-items: flex-end;justify-content: center;position: relative;padding-top: 20rpx;padding-bottom: 10rpx;">
                    <image style="width:245rpx;margin-top: 20rpx;position: absolute;left: 0;top: 20rpx;display: flex;align-items: center;"
                        src="https://file.aizhs.top/sys-mini/xizi-logo.jpg" mode="widthFix" />
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
                                :src="userInfoDatas.avatar ? userInfoDatas.avatar : 'https://file.aizhs.top/sys-mini/daixaodiming.png'"
                                class="avatar-image" mode="aspectFill" />
                        </view>
                    </view>

                    <image style="width:245rpx;position: absolute;right: 0;bottom: 10rpx;" src="https://file.aizhs.top/sys-mini/saomaa.jpg"
                        mode="widthFix" />
                </view>
                <view>
                    <image style="width:100%;margin-bottom:10rpx" mode="widthFix"
                        src="https://file.aizhs.top/sys-mini/celance.jpg" />
                </view>
                <!-- 标题区域 -->
                <!-- <view class="popup-header">
                    <text class="welcome-text">WELCOME</text>
                    <text class="ai-text">IKUIINF-AI</text>
                </view> -->

                <!-- 图标区域 -->
                <!-- <view class="icon-section">
                    <view class="icon-item">
                        <image src="https://file.aizhs.top/sys-mini/Vector.png" mode="aspectFit" />
                        <view>操盘手权益</view>
                    </view>
                    <image src="https://file.aizhs.top/sys-mini/Ellipse.png" class="avatar-image"
                        mode="aspectFit" />
                    <image src="https://file.aizhs.top/sys-mini/soamazixun.png" class="consult-image"
                        mode="aspectFit" />
                    <image src="https://file.aizhs.top/sys-mini/erweima.png" class="qr-image" mode="aspectFit" />
                </view> -->

                <!-- 权益列表 -->
                <view class="benefits-list" @touchmove="handleTouchMove">
                    <view class="benefit-item" style="font-family: AlimamaFangYuanTi;font-size: 33rpx;"
                        v-for="item in benefits" :key="item.id">
                        <!-- <text class="benefit-number">{{ item.id }}.</text> -->
                        <rich-text :nodes="item.content" :style="{ color: item.color }"
                            class="benefit-content"></rich-text>
                    </view>
                </view>

                <!-- 更多权益信息 -->
                <!-- <view class="more-benefits">
                    <rich-text :nodes="moreBenefitsText"></rich-text>
                </view> -->

                <!-- 底部版权信息 -->
                <!-- <view
                    style="width: 100%;text-align: center;padding-bottom: 10rpx;text-align: center;display: flex;justify-content: center;align-items: flex-end;">
                    <image style="text-align: center;width:348rpx;" src="https://file.aizhs.top/sys-mini/yejiao.png"
                    mode="widthFix" />
                </view> -->
                <!-- 底部按钮 -->
                <view style="display: flex;justify-content: center;gap: 20rpx;">
                    <view class="bottom-button" @click="showServicePopup">
                        加入我们
                    </view>
                    <!-- <view class="bottom-button dark-button" @click="closehandleOpen">
                        再咨询一下
                    </view> -->
                </view>

            </view>





        </view>
        <!-- 服务弹窗 -->
        <view v-if="isServicePopupVisible" class="service-mask" @click="hideServicePopup">
            <view class="service-popup-content" @click.stop>
                <!-- <text class="close-btn" @click="hideServicePopup">×</text> -->
                <view style="display: flex; flex-direction: column; align-items: center;">
                    <image class="card-image" src="https://file.aizhs.top/sys-mini/default/mingpian.png">
                    </image>
                    <image class="card-image2" show-menu-by-longpress="true"
                        src="https://file.aizhs.top/sys-mini/erweima.png">
                    </image>
                    <image style="margin-top: 16rpx;margin-bottom: 20rpx;"
                        src="https://file.aizhs.top/sys-mini/text-tip.jpg" mode="widthFix">
                    </image>
                </view>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { pay } from "@/utils/pay/index.js"
import NavigationBars from "@/components/navigation-bars/index.vue"

const props = defineProps({
    isShow: {
        type: Boolean,
        default: false
    },
    userInfoDatas: {
        type: Object,
    },
})

const isServicePopupVisible = ref(false)
const showPopup = ref(true)
const benefits = ref([
    { id: 1, content: '<span style="font-weight: bold;">权益一:顶流人脉资源圈链接机会</span>', 'color': 'rgba(255, 79, 79,0.6)' },
    { id: 2, content: '<span style="font-weight: bold;">权益二:优质创业项目分享</span>', 'color': 'rgba(255, 79, 79,0.7)' },
    { id: 3, content: '<span style="font-weight: bold;">权益三:对接资本权益</span>', 'color': 'rgba(255, 79, 79,0.8)' },
    { id: 4, content: '<span style="font-weight: bold;">权益四:AI圈技术大佬交流学习机会</span>', 'color': 'rgba(255, 79, 79,0.9)' },
    { id: 5, content: '<span style="font-weight: bold;">权益五:AI开源技术共享</span>', 'color': 'rgba(255, 79, 79,1)' },
])

watch(() => props.isShow, (val) => {
})

function close() {
    isServicePopupVisible.value = false
    uni.navigateBack({
        delta: 1,
    })
}

function closehandleOpen() {
    close()
}

function handleTouchMove(e) {
    e.stopPropagation()
}

function showServicePopup() {
    isServicePopupVisible.value = true
}

function hideServicePopup() {
    isServicePopupVisible.value = false
}
</script>

<style scoped lang="scss">
.introduce-popup {
  -webkit-transform: translateZ(0);
  // position: fixed;
  top: 0;
  left: 0;
  width: 93%;
  height: calc(100vh - 164rpx);
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  perspective: 1200px;
//   background-image: linear-gradient(to bottom right, rgba(205, 208, 255, 0.7) 0%, rgba(253, 255, 225, 0.7) 100%);
  box-shadow: 0 0 8rpx 0 rgba(0, 0, 0, 0.1);
  margin: 0 auto 0;
  border-radius: 15rpx;
}

.popup-content {
    position: relative;
    width: 100%;
    /* max-width: 730rpx; */
    height: 100%;
    border-radius: 20rpx;
    overflow: hidden;
    transform: translateY(100vh) rotateX(5deg);
    transition: all 0.3s ease-in-out;
    opacity: 0.8;
    background: url(https://file.aizhs.top/sys-mini/default/sdh_back.jpg) no-repeat;
    background-size: 100%;
    background-position: bottom;
    /* background-attachment:fixed; */
    /* background-image: linear-gradient(to bottom right, rgba(205, 208, 255, 0.7) 0%, rgba(253, 255, 225, 0.7) 100%); */
    /* box-shadow: 0 0 15px rgba(0, 0, 0, 0.2), inset 0 -1px 2px rgba(255, 255, 255, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.7); */
}

.popup-content.popup-show {
    transform: translateY(0) rotateX(0deg);
    opacity: 1;
}

.popup-container {
    width: 100%;
    height: 100%;
    padding: 20rpx 10rpx 0;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
    box-sizing: border-box;
    // backdrop-filter: blur(1px);
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
    font-family: 'AlimamaFangYuanTi';
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
    // border: 1px solid #BFBEFF;
    // box-shadow: 0px 0px 6px 0px rgba(0, 0, 0, 0.3);
}

.avatar-image {
    width: 100%;
    height: 100%;
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
    -webkit-overflow-scrolling: touch;
    /* 增加iOS流畅滚动 */
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
    border-radius: 15rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 20rpx auto;
    font-size: 30rpx;
    font-weight: 500;
    color: #000;
    border: 1rpx solid #000;

  animation: bounce 0.5s ease-in-out infinite;
}
@keyframes bounce {
  0% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }

  50% {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    transform: translate(0, 0);
  }

  100% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }
}

.dark-button {
    background-color: #333333;
    background-image: none;
    color: #ffffff;
    border: 1rpx solid #222222;
    box-shadow: 0 0 10rpx rgba(0, 0, 0, 0.25);
}

.copyright {
    font-size: 18rpx;
    color: #999;
    text-align: center;
    margin-top: 10rpx;
}

.service-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999999;
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
}

.service-popup-content {
    padding: 20rpx;
    position: relative;
    border-radius: 30rpx;
    opacity: 1;
    background-image: linear-gradient(to bottom right, rgba(205, 208, 255, 0.7) 0%, rgba(253, 255, 225, 0.7) 100%);
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.2), inset 0 -1px 2px rgba(255, 255, 255, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(10px);
    box-shadow: 0px 0 6px 0px rgba(169, 165, 255, 0.6);
}

.card-image {
    width: 100%;
    // height: 411rpx;
    height: calc(50vh - 120rpx);
    display: block;
    margin-bottom: 20rpx;
    margin: 0 auto;
    margin-bottom: 16rpx;
    border-radius: 30rpx;
    overflow: hidden;
}

.card-image2 {
    width: 100%;
    height: calc(50vh - 148rpx);
    display: block;
    margin: 0 auto;
    border-radius: 8rpx;
    overflow: hidden;
}
</style>