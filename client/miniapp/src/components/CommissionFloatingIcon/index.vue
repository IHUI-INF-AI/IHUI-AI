/**
 * Ripple_Yu
 * 悬浮主页的分佣小图标
 * 点击跳转至 分佣计划 路由页面
 *
 */
<template>
  <movable-area class="floating-icon-container">
    <movable-view
      class="floating-icon"
      direction="all"
      :x="iconX"
      :y="iconY"
      @change="onPositionChange"
      @tap="navigateToEarnCommission"
    >
      <image class="icon-floating-image" :src="iconSrc"></image>
    </movable-view>
  </movable-area>
</template>

<script setup>
import { ref } from 'vue'

const iconSrc = ref('https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/xia/commission.png')
const iconX = ref(uni.getSystemInfoSync().windowWidth - 60)
const iconY = ref(uni.getSystemInfoSync().windowHeight / 2 - 24)

try {
  const savedPosition = uni.getStorageSync('floatingIconPosition')
  if (savedPosition) {
    const position = JSON.parse(savedPosition)
    iconX.value = position.x
    iconY.value = position.y
  }
} catch (e) {
}

function onPositionChange(e) {
  const position = {
    x: e.detail.x,
    y: e.detail.y
  }
  uni.setStorageSync('floatingIconPosition', JSON.stringify(position))
}

function navigateToEarnCommission() {
  uni.switchTab({
    url: '/pagesA/earn_commission/index',
    fail: (err) => {
      uni.navigateTo({
        url: '/pagesA/earn_commission/index',
        fail: (error) => {
          uni.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    }
  })
}
</script>

<style scoped lang="scss">
.floating-icon-container {
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 999;
}

.floating-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  box-shadow: 0 0 10px rgb(0 0 0 / 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: auto;
  overflow: hidden;
  background-color: rgb(0 0 0 / 0.6);
}

.icon-floating-image {
  width: 60%;
  height: 60%;
}
</style>
