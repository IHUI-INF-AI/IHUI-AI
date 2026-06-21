<template>
  <view class="floating-window" :style="windowStyle" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
    <button class="float-btn" @click="onClick">点我</button>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const x = ref(300)
const y = ref(500)
const dragging = ref(false)
const startX = ref(0)
const startY = ref(0)
const offsetX = ref(0)
const offsetY = ref(0)

const windowStyle = computed(() => {
  return `position: fixed; left: ${x.value}px; top: ${y.value}px; z-index: 9999;`
})

function onTouchStart(e) {
  dragging.value = true
  const touch = e.touches[0]
  startX.value = touch.clientX
  startY.value = touch.clientY
  offsetX.value = x.value
  offsetY.value = y.value
}

function onTouchMove(e) {
  if (!dragging.value) return
  const touch = e.touches[0]
  x.value = offsetX.value + (touch.clientX - startX.value)
  y.value = offsetY.value + (touch.clientY - startY.value)
}

function onTouchEnd() {
  dragging.value = false
}

function onClick() {
  uni.showToast({
    title: '你点击了悬浮窗!',
    icon: 'none',
  })
}
</script>

<style scoped>
.floating-window {
  width: 80px;
  height: 80px;
  background: rgba(0, 153, 255, 0.85);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 8px rgba(0,0,0,0.15);
}
.float-btn {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #fff;
  color: #0099ff;
  font-weight: bold;
  border: none;
  outline: none;
}
</style>
