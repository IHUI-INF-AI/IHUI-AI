/* 顶部导航栏 通用组件 */

<template>
	<view class="">
		
	
	
  <view v-if="viscosity === true" style="position: sticky; top: 0; z-index: 999; padding: 0 20rpx 0 20rpx;" class="tab-bar" :style="{ height: topBarHeight, background: backgroundColor || '#fff' }">
	
	
	
	
    <view :style="{ height: statusBarHeight }"></view>
    <view style="display: flex; align-items: center; position: relative"
      :style="{ height: titleBarHeight}">

      <!-- 左侧图标区域 - 向右移动 -->
      <view v-if="dual"  class="back back-right-moved" :style="{ width: paddingRightWidth }">
        <view v-if="showMenu">
          <image src="/static/images/menu.svg" style="width: 40rpx;height: 40rpx;margin-left: 5rpx;" @click="handleMenuClick" mode="widthFix"></image>
        </view>
        <view v-if="image" class="back-box" style="width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; overflow: hidden;">
          <image class="backi-img" mode="heightFix" style="width: 30rpx; height: 48rpx;" :src="image" @click="packClick"></image>
        </view>

        <view v-if="image" class="back-s">

        </view>

        <view class="back-img">
          <image
            v-if="showFenLei"
            class="back-img-mm"
            @click="handleNavClick"
            :src="newFenLeiSrc"
            mode="widthFix"
          />
          <image v-if="sheZhi" class="back-img-mm" src="/static/images/shezhi.png"
          mode="widthFix" @click="onPackClick" />
          
          <view style="padding: 20rpx 0;opacity: 0;">
            <image
              class="back-img-mm"
              src="/static/images/backf2.png"
              mode="widthFix"
            />
          </view>
        </view>
      </view>

      <view v-else class="back-bak back-right-moved">
        <!-- 侧边栏展开按钮 - 放在最左侧，并与分类按钮保持足够间距 -->
        <view v-if="showMenu" style="padding: 20rpx 0; margin-right: 20rpx;">
          <image src="/static/images/menu.svg" style="width: 40rpx;height: 40rpx;" @click="handleMenuClick" mode="widthFix"></image>
        </view>
        <!-- 返回按钮（如果有） -->
        <image v-if="image" mode="heightFix" style="width: 30rpx; height: 48rpx;padding: 0 20rpx;" :src="image" @click="packClick">
        </image>
        <!-- 分类按钮，与菜单按钮保持视觉间距 -->
        <view v-if="showFenLei" style="padding: 20rpx 0;">
          <image
            @click="handleNavClick"
            style="width: 40rpx;height: 40rpx;"
            :src="fenLeiSrc" mode="widthFix" />
        </view>

        <image v-if="sheZhi" class="back-img-mm" src="/static/images/shezhi.png"
        mode="widthFix" @click="onPackClick" />

          <view style="padding: 20rpx 0;opacity: 0;">
            <image
              class="back-img-mm"
              src="/static/images/backf2.png"
              mode="widthFix"
            />
          </view>
      </view>
      <view v-if="aigc">
        <image :src="aigcIcon" style="margin-left: 0;" class="back-img-mm aigc" @click="toAigc"></image>
      </view>
      <!-- 中间标题区域 - 绝对居中 -->
      <view class="center-row-absolute">
        <view class="title border_bottom"  style="margin-right: 80rpx;color: #8389FF;" @click="handlenavclicktitle(0)">每日资讯</view>
        <view class="title" @click="handlenavclicktitle(1)">排行榜</view>
      </view>

      <view v-if="distribution">
        <image src="/static/images/roblogo.png" class="distribution"></image>
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
      </view>
      <view style="width: 100%; text-align: center; font-size: 32rpx" :style="{ color: color }">{{ title }}1</view>
    </view>
  </view>
  
  <!-- <view class="" style="width: 100%;
  	height: 1rpx;
  	background: linear-gradient(to right,#ffffff 0%,#b7a7ff 20%,#5e4fff 50%,#bab3ff 80%,#ffffff 100%);">
  	
  </view> -->
  </view>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, inject } from 'vue'

const props = defineProps({
  image: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    default: "标题",
  },
  color: {
    type: String,
    default: "#ffffff",
  },
  viscosity: {
    type: Boolean,
    default: false,
  },
  backgroundColor: {
    type: String,
    default: "transparent",
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
    default: false
  },
  distribution: {
    type: Boolean,
    default: false
  },
  tagWrapShow: {
    type: Boolean,
    default: false
  },
  categoryActive: {
    type: Boolean,
    default: false
  },
  showMenu: {
    type: Boolean,
    default: false
  },
})

const emit = defineEmits(['menu-click', 'active_nav', 'nav-click', 'pack'])

const $styleVariables = inject('styleVariables', {})

const fenLeiSrc = ref('/static/images/backf2.png')
const newFenLeiSrc = ref('/static/images/backf2.png')
const aigcIcon = ref('/static/images/aigc.png')

const topBarHeight = computed(() => $styleVariables["--app-top-bar-height"])
const titleBarHeight = computed(() => $styleVariables["--app-nav-bar-height"])
const statusBarHeight = computed(() => $styleVariables["--app-status-bar-height"])
const paddingRightWidth = computed(() => $styleVariables["--app-nav-bar-width"])

function updateFenLeiSrc() {
  const active = (props.tagWrapShow || props.categoryActive)
  const activeSrc = '/static/images/fl.pic.jpg'
  const inactiveSrc = '/static/images/backf2.png'
  fenLeiSrc.value = active ? activeSrc : inactiveSrc
  newFenLeiSrc.value = active ? activeSrc : inactiveSrc
}

watch(() => props.tagWrapShow, () => {
  updateFenLeiSrc()
})

watch(() => props.categoryActive, () => {
  updateFenLeiSrc()
})

uni.$on('trigger-nav-click', handleNavClick)
updateFenLeiSrc()

onBeforeUnmount(() => {
  uni.$off('trigger-nav-click', handleNavClick)
})

function handleMenuClick() {
  emit('menu-click', true)
}

function toAigc() {
  uni.navigateTo({
    url: '/pages/tools/aigc/index'
  })
}

function handlenavclicktitle(index) {
  if(index == 0){
    emit('active_nav', 0)
  } else {
    emit('active_nav', 1)
  }
}

function handleNavClick() {
  emit('nav-click', !props.tagWrapShow)
}

function packClick() {
  if(props.showBack){
    const pages = getCurrentPages();
    if (pages.length <= 1) {
      uni.switchTab({
        url: '/pages/table/aiIndex/ai_index'
      });
      return;
    }
    uni.navigateBack({
      delta: 1,
    });
  }
  emit("pack")
}

function NavClick() {
}

function onPackClick() {
  return;
  uni.navigateTo({
    url: "/pagesA/set/index",
  });
}
</script>

<style scoped lang="scss">
.tab-bar {
  /* background: linear-gradient(to right, #D0CDFF, #FBFFE7, #FFFFFF); */
  background: #E9F0FD;
  /* #E9F7FD */
  /* ---#E9F0FD */
  
  /* box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); */
      /* box-shadow: 0rpx 2rpx 6rpx rgba(4, 0, 255, 0.5); */
  /* box-shadow: 0rpx 4rpx 8rpx rgba(4, 0, 255, 0.25); */
}

.img {
  width: 95rpx;
  height: 95rpx;
}

.back {
  display: flex;
  /* align-items: center; */
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
  margin-left: 0; /* 向右移动 */
}

.title {
  font-size: 36rpx;
  color: #000;
  font-family: "AlimamaFangYuanTi";
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
.border_bottom{
  position: relative;
  font-weight: bold;

  &::after{
    content: "";
    width: 100%;
    height: 4rpx;
    background-color: #9ea3fd;
    position: absolute;
    bottom: -16rpx;
    left: 0;
    right: 0;
    border-radius: 100rpx;
  }
}
</style>
