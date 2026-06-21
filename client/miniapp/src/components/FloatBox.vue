<template>
  <view>
    <view v-if="!isOpen" class="float-mask" @click="toggleBox" />
    <view class="float-box" :class="{ 'float-box--open': isOpen }">
      <view class="float-arrow" v-if="isOpen" :class="{ 'float-arrow--open': !isOpen }" @click="toggleBox">
        <image src="/static/images/zhankaiH.png" class="arrow-img" />
      </view>
      <view class="float-content">
        <view>
          <button class="float-item" open-type="share" @click="onShare">
            <image src="/static/images/tuiguang.png" mode="heightFix" class="icon" />
            <text class="item-text" style="color: #ff0000;">赚 米</text>
          </button>
        </view>
        <view>
          <button class="float-item" @click="showServicePopup">
            <image src="/static/images/kf.png" mode="heightFix" class="icon" />
            <text class="item-text">客 服</text>
          </button>
        </view>
        <view>
          <button class="float-item" @click="onFankui">
            <image src="/static/images/yijianfankui.png" mode="heightFix" class="icon" />
            <text class="item-text">反 馈</text>
          </button>
        </view>
      </view>
    </view>
    <view v-if="isServicePopupVisible" class="service-mask" @click="hideServicePopup">
      <view class="service-popup-content" @click.stop>
        <view style="display: flex; flex-direction: column; align-items: center;">
          <image class="card-image" src="/static/images/mingpian.png" mode="widthFix">
          </image>
          <image class="card-image2" show-menu-by-longpress="true"
            src="/static/images/erweima.png" mode="widthFix">
          </image>
          <image style="margin-top: 16rpx;" src="/static/images/text-tip.jpg" mode="widthFix">
          </image>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { shareConfig } from "@/utils/shareConfig.js"

defineOptions({
  name: 'FloatBox'
})

const isOpen = ref(true)
const isServicePopupVisible = ref(false)

const hide_float = () => {
  isOpen.value = true
}

const toggleBox = () => {
  isOpen.value = !isOpen.value
}

const showServicePopup = () => {
  uni.openCustomerServiceChat({
    extInfo: {url: 'https://work.weixin.qq.com/kfid/kfc254db5f8a4face57'},
    corpId: 'ww6b2e8c6e8e3a6812',
    success(res) {}
  })
}

const hideServicePopup = () => {
  isServicePopupVisible.value = false
}

const onShare = () => {
}

const onFankui = () => {
  uni.navigateTo({
    url: '/pagesA/fankui/index',
  })
}

const getShareInfo = () => {
  const baseShareInfo = shareConfig.getShareInfo()
  return {
    ...baseShareInfo,
    path: `/pages/table/aiIndex/ai_index?${shareConfig.sourceParam}=${shareConfig.sourceValue}&${shareConfig.inviteCodeParam}=${baseShareInfo.path.includes(shareConfig.inviteCodeParam) ? baseShareInfo.path.split(`${shareConfig.inviteCodeParam}=`)[1].split('&')[0] : ''}`,
  }
}

defineExpose({
  hide_float,
  getShareInfo
})
</script>

<style lang="scss" scoped>
.float-mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1004;
  background: transparent;
}

.float-box {
  position: fixed;
  right: 20rpx;
  bottom: 9%;
  width: 118rpx;
  min-height: 340rpx;
  background-color: #fff;
  border-radius: 30rpx;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: right 0.35s cubic-bezier(0.4, 1.3, 0.6, 1);
  z-index: 1005;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.float-box--open {
  right: -240rpx;
}

.float-arrow {
  width: 40rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: -161rpx;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  z-index: 10000;
  transition: left 0.3s;
}

.arrow-img {
  width: 40rpx;
  height: 80rpx;
  object-fit: contain;
  margin-right: 3rpx;
}

.float-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14rpx 0;
  box-sizing: border-box;
  justify-content: center;
}

.float-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 5rpx 0;
}

.icon {
  width: 72rpx;
  height: 72rpx;
  margin-bottom: 6rpx;
  object-fit: contain;
}

.item-text {
  font-size: 28rpx;
  font-weight: bold;
  color: #222;
  letter-spacing: 2rpx;
}

button {
  background: none;
  border: none;
  box-shadow: none;
  padding: 0;
  margin: 0;
  border-radius: 0;
  outline: none;
  color: inherit;
  font: inherit;
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
  z-index: 9999;
  background-color: rgba(0, 0, 0, 0.4);
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
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.qr-code-image {
  width: 100%;
  border-radius: 15rpx;
}

.close-btn {
  position: absolute;
  top: -60rpx;
  right: -60rpx;
  font-size: 50rpx;
  color: #fff;
  z-index: 1000;
  padding: 10rpx;
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.3);
}

.service-text {
  font-size: 32rpx;
  background: linear-gradient(180deg, #B4B7F9 0%, #5E66FF 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: 'AlimamaFangYuanTi';
  font-weight: 700;
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
.float-arrow--open{
  left: -37rpx !important;
}
</style>