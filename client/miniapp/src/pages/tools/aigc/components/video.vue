<template>
  <view class="video_outer">
    <video
        class="video"
        :controls="false"
        :src="url"
        object-fit="contain"
        autoplay
        loop
        muted="muted"
        @waiting="waiting"
        @error="error"
        @loadedmetadata="loadedmetadata"
        @tap="toggleMute"
    ></video>
    <!-- <view class="volume-icon" v-if="isMuted" @tap.stop="toggleMute">
      <image src="/static/images/mute.png" mode="aspectFit"/>
    </view> -->
  </view>
</template>
<script setup>
import { ref, getCurrentInstance, nextTick, onMounted } from 'vue'

defineOptions({ name: 'VideoPlayer' })

const props = defineProps({
  url: {
    type: String,
  },
  item: {
    type: Object,
  }
})

const isMuted = ref(true)
const videoContext = ref(null)

onMounted(() => {
  const instance = getCurrentInstance()
  nextTick(() => {
    videoContext.value = uni.createVideoContext('video-' + instance.uid)
  })
})

function loadedmetadata() {
  if (videoContext.value) {
    videoContext.value.muted(true)
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value
  if (videoContext.value) {
    videoContext.value.muted(isMuted.value)
  }
}

function waiting() {
}

function error() {
}
</script>
<style scoped lang="scss">
.video_outer {
  width: 100%;
  position: relative;
  /* 使用padding-bottom实现9:16的宽高比 */
  padding-bottom: 177.78%; /* 16/9 * 100% = 177.78% */
  height: 0;
}
.video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.volume-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80rpx;
  height: 80rpx;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  image {
    width: 50rpx;
    height: 50rpx;
  }
}
</style>
