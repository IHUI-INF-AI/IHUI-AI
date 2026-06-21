<template>
  <view class="pops" v-show="isShow" @click.self="close">
    <!-- 使用 v-show 而不是 v-if -->
    <view class="pops-item" :class="{ show: showPopup, hide: !showPopup }" @touchmove="handleTouchMove" @scroll="handleScroll" :style="{ '--blur-amount': blurAmount + 'px' }">
      <view class="item-center">
        <view style="width: 20rpx"></view>
        <view style="font-weight: bold; font-size: 34rpx">{{ title }}</view>
        <view class="" style="width: 100%;    display: flex;align-items: flex-end;justify-content: space-between; ">
          <image style="width: 370rpx;height: 45rpx;" src="/static/images/headertitley.png"
            mode=""></image>
          <image style="width: 288rpx;height: 25.96rpx;" src="/static/images/headertitlet.png"
            mode=""></image>
        </view>
        <!-- <text class="login-popup-title">WELCOME <text class="login-popup-sub">IHUI INF.AI</text></text> -->
        <view @click.self="close">
          <image style="width: 40rpx; height: 40rpx"
            src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/删除.png" mode="widthFit" />
        </view>
      </view>
      <slot name="center"> </slot>
      <slot name="bottom"> </slot>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  isShow: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "",
  },
})

const emit = defineEmits(['close'])

const showPopup = ref(false)
const blurAmount = ref(0)
const scrollTop = ref(0)

watch(() => props.isShow, (val) => {
  if (val) {
    nextTick(() => {
      setTimeout(() => {
        showPopup.value = true
      }, 20)
    })
  } else {
    showPopup.value = false
  }
})

function close() {
  showPopup.value = false
  setTimeout(() => {
    emit("close")
  }, 300)
}

function handleTouchMove(e) {
  if (e.touches && e.touches.length > 0) {
    const touch = e.touches[0]
    const scrollY = touch.clientY
    blurAmount.value = Math.min(Math.max(scrollY / 10, 0), 20)
  }
}

function handleScroll(e) {
  const st = e.detail ? e.detail.scrollTop : 0
  scrollTop.value = st
  blurAmount.value = Math.min(Math.max(st / 10, 0), 20)
}
</script>

<style>
.pops {
  position: fixed;
  z-index: 1001;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  width: 100%;
  height: 100%;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  backdrop-filter: blur(0px);
  transition: backdrop-filter 0.3s ease;
}

.pops-item {
  display: flex;
  padding-bottom: 30rpx;
  flex-direction: column;
  justify-content: space-between;
  z-index: 999;
  width: 100%;
  border-radius: 80rpx 80rpx 0 0;
  overflow-y: auto;
  transform: translateY(100%);
  transition: transform 0.3s ease-in-out;
  border-color: #D0D0D0;
  background-color: #fff;
  border-radius: 30px 30px 0px 0px;
  border: 1px solid rgba(251, 255, 203, 0.08);
  box-shadow: 0px 0 20px 0px rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(var(--blur-amount, 0px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 0px));
  transition: backdrop-filter 0.3s ease, -webkit-backdrop-filter 0.3s ease;
}

.pops-item.show {
  transform: translateY(0);
  /* 弹出动画 */
}

.pops-item.hide {
  transform: translateY(100%);
  /* 隐藏动画 */
}

.item-center {
  padding: 30rpx 10rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: black;
}

.login-popup-title {
  font-size: 70rpx;
  font-family: 'AlimamaFangYuanTi';
  letter-spacing: 4rpx;
  color: #222;
  font-weight: bold;
}

.login-popup-sub {
  color: #9694ff;
  font-size: 40rpx;
  margin-left: 12rpx;
}
</style>
