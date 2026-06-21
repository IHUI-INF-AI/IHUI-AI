<template>
    <view class="introduce-popup blur-background" v-if="isShow" @click="close">
        <view class="popup-content" :class="{ 'popup-show': showPopup }" @click.stop>
            <view class="popup-container">
                <view class=""
                    style="width: 100%;    display: flex;align-items: flex-end;justify-content: space-between; ">
                    <image style="width: 370rpx;height: 45rpx;"
                        src="/static/images/headertitley.png" mode=""></image>
                    <image style="width: 288rpx;height: 25.96rpx;"
                        src="/static/images/headertitlet.png" mode=""></image>
                </view>
                <view>
                    <image style="width:245rpx;margin-top: 20rpx;"
                        src="/static/images/xizi-logo.jpg" mode="widthFix" />
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
                                :src="userInfoDatas.avatar ? userInfoDatas.avatar : '/static/images/daixaodiming.png'"
                                class="avatar-image" mode="aspectFill" />
                        </view>
                    </view>

                    <image style="width:245rpx;" src="/static/images/saomaa.jpg"
                        mode="widthFix" />
                </view>
                <view>
                    <image style="width:100%;margin-bottom:40rpx" mode="widthFix"
                        src="/static/images/celance.jpg" />
                </view>

                <view class="benefits-list" @touchmove="handleTouchMove">
                    <view class="benefit-item" style="font-family: FZZJ-LongYTJW;font-size: 33rpx;"
                        v-for="item in benefits" :key="item.id">
                        <rich-text :nodes="item.content" :style="{ color: item.color }"
                            class="benefit-content"></rich-text>
                    </view>
                </view>

                <view class="copyright">
                    COPYRIGHT © 2024 IKUIINE-AI ALL RIGHTS RESERVED.
                </view>
                <view style="display: flex;justify-content: center;gap: 20rpx;">
                    <view class="bottom-button" @click="showServicePopup">
                        加入我们
                    </view>
                </view>

            </view>


            <view v-if="isServicePopupVisible" class="service-mask" @click="hideServicePopup">
                <view class="service-popup-content" @click.stop>
                    <view style="display: flex; flex-direction: column; align-items: center;">
                        <image class="card-image" src="/static/images/default/mingpian.png">
                        </image>
                        <image class="card-image2" show-menu-by-longpress="true"
                            src="/static/images/erweima.png">
                        </image>
                        <image style="margin-top: 16rpx;margin-bottom: 20rpx;"
                            src="/static/images/text-tip.jpg" mode="widthFix">
                        </image>
                    </view>
                </view>
            </view>



        </view>
    </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { pay } from "@/utils/pay/index.js"

defineOptions({
  name: 'IntroducePopups'
})

const props = defineProps({
    isShow: {
        type: Boolean,
        default: false
    },
    userInfoDatas: {
        type: Object,
    },
})

const emit = defineEmits(['close'])

const isServicePopupVisible = ref(false)
const showPopup = ref(false)
const benefits = ref([
    { id: 1, content: '<span style="font-weight: bold;">权益一:顶流人脉资源圈链接机会</span>', 'color': 'rgba(255, 79, 79,0.6)' },
    { id: 2, content: '<span style="font-weight: bold;">权益二:优质创业项目分享</span>', 'color': 'rgba(255, 79, 79,0.7)' },
    { id: 3, content: '<span style="font-weight: bold;">权益三:对接资本权益</span>', 'color': 'rgba(255, 79, 79,0.8)' },
    { id: 4, content: '<span style="font-weight: bold;">权益四:AI圈技术大佬交流学习机会</span>', 'color': 'rgba(255, 79, 79,0.9)' },
    { id: 5, content: '<span style="font-weight: bold;">权益五:AI开源技术共享</span>', 'color': 'rgba(255, 79, 79,1)' },
])

watch(
  () => props.isShow,
  (val) => {
    if (val) {
      setTimeout(() => {
        showPopup.value = true
      }, 50)
    } else {
      showPopup.value = false
    }
  }
)

const close = () => {
    showPopup.value = false
    isServicePopupVisible.value = false
    setTimeout(() => {
        emit('close')
    }, 300)
}

const handleOpen = async () => {
}

const closehandleOpen = () => {
    close()
}

const handleTouchMove = (e) => {
    e.stopPropagation()
}

const showServicePopup = () => {
    isServicePopupVisible.value = true
}

const hideServicePopup = () => {
    isServicePopupVisible.value = false
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
    height: 72vh;
    border-radius: 20rpx;
    overflow: hidden;
    transform: translateY(100vh) rotateX(5deg);
    transition: all 0.3s ease-in-out;
    opacity: 0.8;
    background-size: 100% 100%;
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
    background-color: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
}

.service-popup-content {
    padding: 20rpx;
    position: relative;
    border-radius: 30rpx;
    opacity: 1;
    background-image: linear-gradient(to bottom right, rgba(205, 208, 255, 0.7) 0%, rgba(253, 255, 225, 0.7) 100%);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2), inset 0 -1px 2px rgba(255, 255, 255, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(10px);
    box-shadow: 0px 6px 6px 0px rgba(169, 165, 255, 0.6);
}

.card-image {
    width: 100%;
    height: 411rpx;
    display: block;
    margin-bottom: 20rpx;
    margin: 0 auto;
    margin-bottom: 16rpx;
    border-radius: 30rpx;
    overflow: hidden;
}

.card-image2 {
    width: 100%;
    display: block;
    margin: 0 auto;
    border-radius: 8rpx;
    overflow: hidden;
}
</style>