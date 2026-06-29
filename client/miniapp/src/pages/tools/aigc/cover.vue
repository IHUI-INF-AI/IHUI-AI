<template>
  <view class="container">
    <swiper @change="swiperChange" class="cont_body" :current="current" :vertical="true">
      <swiper-item v-for="(item,index) in viewList" :key="item.id" :dataset="item" class="cont_body">
        <image v-if="item.fileType == 0" :src="item.fileUrl" mode="widthFix" />
        <video
            :id="index"
            :ref="index"
            class="video"
            controls
            :play-btn-position="'center'"
            v-if="item.fileType == 1"
            :src="item.fileUrl"
            :object-fit="'contain'"
            :page-gesture="true"
            direction="90"
        ></video>
        <view class="footer" :class="{ 'footer-image': item.fileType == 0 || item.fileType == '0', 'footer-video': item.fileType == 1 || item.fileType == '1' }">
          <view class="title">{{item.title}}</view>
          <view class="content">{{item.subtitle}}</view>
          <view class="content">提示词：{{ item.context }}</view>
        </view>
      </swiper-item>
    </swiper>
    <image class="close" @click="goBack" src="/static/images/default/close_chat.png" />
  </view>
</template>
<script setup>
import { ref, getCurrentInstance, onMounted } from 'vue'

const props = defineProps({
  viewList: {
    type: Array
  },
  current: {
    type: Number
  },
  param: {
    type: Object
  }
})

const emit = defineEmits(['getMore', 'back'])

const oldCurrent = ref(props.current)

onMounted(() => {
  let video = uni.createVideoContext(props.current + "", getCurrentInstance())
  video.play()
})

function swiperChange(event) {
  let current = event.target.current

  if (current == props.viewList.length) {
    emit('getMore')
  }

  let oVideo = uni.createVideoContext(oldCurrent.value + "", getCurrentInstance())
  let nVideo = uni.createVideoContext(current + "", getCurrentInstance())

  oVideo.pause()
  nVideo.play()
  oldCurrent.value = current
}

function goBack() {
  emit('back')
}
</script>
<style scoped lang="scss">
.container {
  background-color: #000;
  height: 100vh;
  width: 100vw;
  padding: 20rpx;
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  flex: 1;
  font-family: AlimamaFangYuanTi !important;
  font-variation-settings: "BEVL" 100, "opsz" auto;
  font-feature-settings: "kern" on;

  .cont_body {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .video {
    width: 100%;
    height: calc(100% - 240rpx);
    margin-top: 150rpx;
    border-radius: 15rpx;
  }

  image {
    width: 100%;
  }

  .footer {
    position: absolute;
    left: 22rpx;
    bottom: 28rpx;
    margin: 4rpx;
    box-sizing: border-box;
    width: calc(100% - 44rpx);
    min-height: 88rpx;
    padding: 10rpx 40rpx;
    border-radius: 20rpx;

    // 图片类型背景色
    &.footer-image {
      background: rgb(240 240 240 / 0.4);
    }

    // 视频类型背景色
    &.footer-video {
      background: rgb(0 0 0 / 1);
    }

    .title {
      font-size: 28rpx;
      color: #000;
      font-weight: bold;
    }

    .content {
      margin-top: 10rpx;
      font-size: 22rpx;
      color: #2E2E2E;
    }
  }

  .close {
    position: fixed;
    top: 100rpx;
    right: 40rpx;
    width: 80rpx;
    height: 80rpx;
    border-radius: 15rpx;
    overflow: hidden;

    /* 浅灰色背景 + 玻璃质感描边效果 */
    background: rgb(245 245 245 / 0.9);
    border: 1rpx solid rgb(255 255 255 / 0.45);
    box-shadow: 0 8rpx 24rpx rgb(0 0 0 / 0.25);
    backdrop-filter: blur(10px) saturate(180%);
    -webkit-backdrop-filter: blur(10px) saturate(180%);
    object-fit: contain;
    z-index: 10000;
  }

}
</style>
