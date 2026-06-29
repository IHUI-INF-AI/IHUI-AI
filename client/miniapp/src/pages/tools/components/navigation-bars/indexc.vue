/* 顶部导航栏 通用组件 */

<template>
	<view class="">
		
		
		
  <view v-if="viscosity === true" style="position: sticky; top: 0; z-index: 999; padding: 0 20rpx;background: #fff;" class="tab-bar">
	
	
	
	
    <view :style="{ height: statusBarHeight }"></view>
    <view style="display: flex; align-items: center; position: relative"
      :style="{ height: titleBarHeight}">

      <!-- 左侧图标区域 - 向右移动 -->
      <view v-if="dual"  class="back back-right-moved" :style="{ width: paddingRightWidth }">

        <view class="back-box">
          <view style="padding: 0;">
            <image class="backi-img" v-if="image" mode="heightFix" style="width: 40rpx;height: 40rpx;" :src="image" @click="packClick">
            </image>
          </view>
        </view>

        <view class="back-s">

        </view>

        <view class="back-img">
          <view style="padding: 20rpx 0;">
            <image
              v-if="showFenLei"
              class="back-img-mm"
              @click="handleNavClick"
              :src="newFenLeiSrc"
              mode="widthFix"
            />
          </view>
          <view style="padding: 20rpx 0;">
            <image v-if="sheZhi" class="back-img-mm" src="/static/images/shezhi.png"
            mode="widthFix" @click="onPackClick" />
          </view>
        </view>
      </view>

      <view v-else class="back-bak back-right-moved">
        <view style="padding: 0;">
          <image v-if="image" mode="heightFix" style="width: 34rpx; height: 48rpx;" :src="image" @click="packClick">
          </image>
        </view>
        <view style="padding: 20rpx 0;">
          <image
            v-if="showFenLei"
            @click="handleNavClick" style="width: 40rpx;height: 40rpx;"
            :src="fenLeiSrc" mode="widthFix" />
        </view>
        <view style="padding: 20rpx 0;">
          <image v-if="sheZhi" class="back-img-mm" src="/static/images/shezhi.png"
          mode="widthFix" @click="onPackClick" />
        </view>
      </view>
      <view v-if="aigc">
        <view style="padding: 20rpx 0;">
          <image :src="aigcIcon" style="margin-left: 0;" class="back-img-mm aigc" @click="toAigc"></image>
        </view>
      </view>
      <!-- 中间标题区域 - 绝对居中 -->
      <view class="center-row-absolute">
        <image :src="logo" mode="widthFix" style="width: 40rpx;height: 40rpx;margin-right: 10rpx;border-radius: 8rpx;"></image>
        <view class="title">{{ title }}</view>
      </view>

      <view v-if="false">
        <image src="/static/images/roblogo.png" mode="heightFix" class="distribution"></image>
      </view>

    </view>
	
  </view>
  <view v-else :style="{ height: topBarHeight }">
    <view :style="{ height: statusBarHeight }"></view>
    <view style="display: flex; justify-content: space-between; align-items: center"
      :style="{ height: titleBarHeight, paddingRight: paddingRightWidth }">
      <view :style="{ width: paddingRightWidth }">
        <image v-if="image" mode="heightFix" style="width: 30rpx; height: 30rpx" :src="image" @click="packClick">
        </image>
        <image v-else="image" mode="heightFix" style="width: 50rpx; height: 50rpx" :src="image"></image>
      </view>
      <view style="width: 100%; text-align: center; font-size: 32rpx" :style="{ color: color }">{{ title }}</view>
    </view>
  </view>
  
  <!-- <view class="" style="width: 100%;
  	height: 1rpx;
  	background: linear-gradient(to right,#ffffff 0%,#b7a7ff 20%,#5e4fff 50%,#bab3ff 80%,#ffffff 100%);">
  	
  </view> -->
  </view>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  image: {
    type: String,
    default: '',
  },
  logo: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '标题',
  },
  color: {
    type: String,
    default: '#ffffff',
  },
  viscosity: {
    type: Boolean,
    default: false,
  },
  backgroundColor: {
    type: String,
    default: 'transparent',
  },
  showFenLei: {
    type: Boolean,
    default: false,
  },
  sheZhi: {
    type: Boolean,
    default: false,
  },
  dual: {
    type: Boolean,
    default: false,
  },
  showBack: {
    type: Boolean,
    default: true,
  },
  aigc: {
    type: Boolean,
    default: false,
  },
  distribution: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['nav-click', 'pack'])

const tagWrapShow = ref(false)
const fenLeiSrc = ref('/static/images/menu.svg')
const newFenLeiSrc = ref('/static/images/backf2.png')
const aigcIcon = ref('/static/images/aigc.png')

const topBarHeight = computed(() => {
  return uni.getStorageSync('--app-top-bar-height') || '0px'
})

const titleBarHeight = computed(() => {
  return uni.getStorageSync('--app-nav-bar-height') || '0px'
})

const statusBarHeight = computed(() => {
  return uni.getStorageSync('--app-status-bar-height') || '0px'
})

const paddingRightWidth = computed(() => {
  return uni.getStorageSync('--app-nav-bar-width') || '0px'
})

watch(tagWrapShow, (newVal) => {
  fenLeiSrc.value = '/static/images/menu.svg'
})

function handleNavClickFn() {
  tagWrapShow.value = !tagWrapShow.value
  emit('nav-click', tagWrapShow.value)
}

uni.$on('trigger-nav-click', handleNavClickFn)

onUnmounted(() => {
  uni.$off('trigger-nav-click', handleNavClickFn)
})

function toAigc() {
  uni.navigateTo({ url: '/pages/tools/aigc/index' })
}

function handleNavClick() {
  tagWrapShow.value = !tagWrapShow.value
  emit('nav-click', tagWrapShow.value)
}

function packClick() {
  if (props.showBack) {
    const pages = getCurrentPages()
    if (pages.length <= 1) {
      uni.switchTab({ url: '/pages/table/aiIndex/ai_index' })
      return
    }
    uni.navigateBack({ delta: 1 })
  }
  emit('pack')
}

function onPackClick() {
  return
  uni.navigateTo({ url: '/pagesA/set/index' })
}
</script>

<style scoped>
.tab-bar {
  background: #E9F0FD;
}

.img {
  width: 95rpx;
  height: 95rpx;
}

.back {
  display: flex;
  justify-content: space-evenly;
  border: 1rpx solid #838383;
  border-radius: 8rpx;
}

.center-row {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.center-row-absolute {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-right-moved {
  margin-left: 0;
}

.title {
  font-size: 36rpx;
  color: #000;
  font-family: AlimamaFangYuanTi;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400rpx;
}

.back-box{
	padding: 10rpx;width: 40rpx;height: 40rpx;display: flex;justify-content: center;align-items: center; 
	
}

.backi-img{
		width: 40rpx; height: 40rpx;
	}

.back-s{
	margin: 10rpx;width: 1rpx;height: 40rpx;background-color: #838383;
}

.back-img{
	padding: 10rpx;width: 40rpx;height: 40rpx;display: flex;justify-content: center;align-items: center;
}

.back-img-mm{
	width: 40rpx;height: 40rpx;
}

.back-bak{
	display: flex;
	align-items: center;
}

.aigc {
  margin-left: 15px;
  margin-top: 2px;
}

.distribution {
  width: 60rpx;
  height: 55rpx;
  position: absolute;
  right: 210rpx;
  top: 24rpx;
}
</style>
