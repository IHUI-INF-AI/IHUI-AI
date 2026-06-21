/** * Ripple_Yu * 轮播图组件 * 可接入点击跳转至 路由页面 * */
<template>
  <view class="carousel-container" :style="{ height: swiperHeight - 1 + 'px' }">
    <swiper class="carousel" :indicator-dots="false" :autoplay="true" :interval="3000" :duration="500" :circular="true"
      @change="onSwiperChange" :style="{ height: swiperHeight - 1 + 'px' }">
      <swiper-item v-for="(item, index) in banner" :key="index" @click="handleItemClick(index)">
        <image :src="item.img" mode="widthFix" @load="onImageLoad" @error="onImageError"></image>
      </swiper-item>
    </swiper>
    <view class="indicator">
      <view v-for="(item, index) in banner" :key="index" class="dot" :class="{ active: current === index }">
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  banner: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['item-click'])

const current = ref(0)
const swiperHeight = ref(0)
const heightCalculateTimer = ref(null)
const isCalculating = ref(false)
const loadedImages = ref(new Set())

function onSwiperChange(e) {
  try {
    if (e && e.detail && typeof e.detail.current !== 'undefined') {
      current.value = e.detail.current
    }
  } catch (error) {
  }
}

function handleItemClick(index) {
  emit('item-click', props.banner[index])
}

function onImageLoad(e) {
  try {
    let imageSrc = ''
    if (e && typeof e === 'object') {
      if (e.target && e.target.src) {
        imageSrc = e.target.src
      } else if (e.detail && e.detail.src) {
        imageSrc = e.detail.src
      }
    }
    
    if (imageSrc) {
      loadedImages.value.add(imageSrc)
    }
    
    debouncedCalculateHeight()
  } catch (error) {
    debouncedCalculateHeight()
  }
}

function onImageError(e) {
}

function debouncedCalculateHeight() {
  if (heightCalculateTimer.value) {
    clearTimeout(heightCalculateTimer.value)
  }
  
  heightCalculateTimer.value = setTimeout(() => {
    nextTick(() => {
      calculateSwiperHeight()
    })
  }, 100)
}

function calculateSwiperHeight() {
  if (isCalculating.value) {
    return
  }
  
  isCalculating.value = true
  
  const systemInfo = uni.getSystemInfoSync()
  const { screenWidth, screenHeight, pixelRatio, platform, model } = systemInfo
  
  const rpxToPx = (rpx) => {
    return (screenWidth * rpx) / 750
  }
  
  const totalMarginRpx = 40
  const marginPx = rpxToPx(totalMarginRpx)
  const containerWidth = screenWidth - marginPx
  
  let defaultAspectRatio = 9 / 21
  
  if (platform === 'ios') {
    if (screenWidth >= 414) {
      defaultAspectRatio = 10 / 21
    } else if (screenWidth >= 375) {
      defaultAspectRatio = 9.5 / 21
    }
  } else if (platform === 'android') {
    if (screenWidth >= 400) {
      defaultAspectRatio = 10 / 21
    } else if (screenWidth <= 320) {
      defaultAspectRatio = 8.5 / 21
    }
  }
  
  swiperHeight.value = Math.round(containerWidth * defaultAspectRatio)
  
  if (props.banner && props.banner.length > 0 && props.banner[0].img) {
    uni.getImageInfo({
      src: props.banner[0].img,
      success: (res) => {
        const imageAspectRatio = res.height / res.width
        let calculatedHeight = Math.round(containerWidth * imageAspectRatio)
        
        const minHeightRatio = screenWidth <= 375 ? 0.25 : 0.3
        const maxHeightRatio = screenWidth >= 414 ? 0.75 : 0.7
        
        const minHeight = Math.round(screenWidth * minHeightRatio)
        const maxHeight = Math.round(screenWidth * maxHeightRatio)
        
        calculatedHeight = Math.max(minHeight, Math.min(maxHeight, calculatedHeight))
        
        swiperHeight.value = calculatedHeight % 2 === 0 ? calculatedHeight : calculatedHeight + 1
        
        isCalculating.value = false
      },
      fail: (error) => {
        swiperHeight.value = swiperHeight.value % 2 === 0 ? swiperHeight.value : swiperHeight.value + 1
        isCalculating.value = false
      }
    })
  } else {
    swiperHeight.value = swiperHeight.value % 2 === 0 ? swiperHeight.value : swiperHeight.value + 1
    isCalculating.value = false
  }
}

watch(
  () => props.banner,
  () => {
    nextTick(() => {
      debouncedCalculateHeight()
    })
  },
  { immediate: true }
)

onMounted(() => {
  calculateSwiperHeight()
})

onBeforeUnmount(() => {
  if (heightCalculateTimer.value) {
    clearTimeout(heightCalculateTimer.value)
    heightCalculateTimer.value = null
  }
})
</script>

<style lang="scss" scoped>
.carousel-container {
  /* margin: 32rpx auto 0 auto; */
  position: relative;
  width: 100%;
  /* margin-top: 180rpx; */
  /* border-radius: 60rpx; */
  transform: translateZ(0);
}

.carousel {
  width: 100%;
  overflow: hidden;

  image {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.indicator {
  position: absolute;
  bottom: 30rpx;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  margin: 0 10rpx;
  transition: all 0.3s;
}

.dot.active {
  width: 32rpx;
  background-color: #ffffff;
  border-radius: 8rpx;
}
</style>
