<template>
  <view class="container">
    <video
      id="myVideo"
      :src="videoUrl"
      controls
      :enable-play-gesture="true"
      :show-progress="true"
      :show-fullscreen-btn="true"
      :show-play-btn="true"
      :enable-progress-gesture="true"
      autoplay
      @play="onPlay"
      @pause="onPause"
      @timeupdate="onTimeUpdate"
      class="video-player"
    ></video>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const videoUrl = ref('https://file.aizhs.top/sys-backs/2025/09/06/1757124515307/5ff9LbytJXfmc4af0c2a72b01e20d1e917d3772e3e18.mp4')
const currentTime = ref(0)
let videoContext = null

onReady(() => {
  videoContext = uni.createVideoContext('myVideo')
  const savedTime = uni.getStorageSync('videoCurrentTime')
  if (savedTime) {
    currentTime.value = savedTime
    console.log('视频组件', videoContext)
    videoContext.seek(savedTime)
  }
})

function onPlay() {
  console.log('视频开始播放')
}

function onPause() {
  console.log('视频暂停播放')
  uni.setStorageSync('videoCurrentTime', currentTime.value)
}

function onTimeUpdate(e) {
  currentTime.value = e.detail.currentTime
}

onUnload(() => {
  uni.setStorageSync('videoCurrentTime', currentTime.value)
})
</script>

<style>
.container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.video-player {
  width: 100%;
  height: 400rpx;
}
</style>
