/* 顶部导航栏 通用组件 */

<template>
	<view class="">
		
	
	
  <view v-if="viscosity === true" style="position: sticky; top: 0; z-index: 1001;" class="tab-bar" :style="{ height: topBarHeight, background: backgroundColor || '#fff' }">
	
	
	
	
    <view :style="{ height: statusBarHeight }"></view>
    <view style="display: flex; align-items: center; position: relative; padding: 0 20rpx 0 20rpx; box-sizing: border-box;" :style="{ height: titleBarHeight}">

      <!-- 左侧图标区域 - 向右移动 -->
      <view v-if="dual"  class="back back-right-moved" :style="{ width: paddingRightWidth }">

        <view v-if="image" class="back-box" style="width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; overflow: hidden;">
          <image class="backi-img" mode="heightFix" style="width: 34rpx; height: 48rpx;" :src="image" @click="packClick"></image>
        </view>

        <view v-if="image" class="back-s">

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
          <view style="padding: 20rpx 0;opacity: 0;">
            <image
              class="back-img-mm"
              src="/static/images/backf2.png"
              mode="widthFix"
            />
          </view>
        </view>
      </view>

      <view v-else class="back-bak back-right-moved" :style="{ minWidth: paddingRightWidth }">
        <!-- 侧边栏展开按钮 - 仅显示时占位，避免仅返回按钮时被推偏右 -->
        <view v-if="showMenu" style="padding: 20rpx 0; margin-right: 20rpx;">
          <image
            @click="handleMenuClick" style="width: 40rpx;height: 40rpx;"
            :src="menuSrc" mode="widthFix" />
        </view>
        <view v-if="image" style="width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; margin-right: 20rpx;">
          <image mode="heightFix" style="width: 34rpx; height: 48rpx;" :src="image" @click="packClick"></image>
        </view>
        <view style="padding: 20rpx 0;">
          <image
            v-if="showFenLei"
            @click="handleNavClick" style="width: 40rpx;height: 40rpx;"
            :src="fenLeiSrc" mode="widthFix" />
        </view>
        <view v-if="aigc" class="aigc-wrap">
          <image src="/static/images/drawer_menu4.png" mode="heightFix" style="height: 44rpx;width: 44rpx;margin-top: 0;display: block;" class="back-img-mm aigc" @click="toAigc"></image>
        </view>
        <view style="padding: 20rpx 0 20rpx 30rpx;">
          <image v-if="study" style="width: 48rpx;height: 48rpx;margin-top: 1rpx;"  src="/static/images/study_icon_add.png"
                 mode="widthFix" @click="()=>{emit('toAdd')}" />
        </view>
        <view style="padding: 20rpx 0;">
          <image v-if="sheZhi" class="back-img-mm" src="/static/images/shezhi.png"
          mode="widthFix" @click="onPackClick" />
        </view>
        <view v-if="showFeedback && checkFeedbackPermission()" class="feedback-btn-nav" @click="handleFeedback">
          <text>反馈</text>
        </view>
      </view>
      
      <!-- 分类按钮区域 -->
      <view v-if="plazaPage" class="plaza-buttons" style="display: flex; align-items: center; margin-left: 0;">
        <template v-if="(kaifaSrc !== '/static/images/add_kf.png') || showPlazaPublishButton">
          <image v-if="kaifaSrc !== '/static/images/add_kf.png'" @click.stop="toSet" class="kaifa" :src="kaifaSrc" style="opacity: 0.6; width: 50rpx; height: 50rpx; margin-right: 16rpx;" />
          <view v-else @click.stop="toSet" class="btn_join_switch" style="display: flex; align-items: center; justify-content: center;margin-right: 20rpx;">
            <image src="/static/images/step_add.svg" mode="heightFix" style="width: 42rpx; height: 42rpx;"></image>
          </view>
        </template> 
        <view v-if="!showSetPath" class="btn_join_switch" @click="setshowBottom" style="display: flex; align-items: center; justify-content: center;">
          <image src="/static/images/switch_shen.svg" mode="heightFix" style="width: 42rpx; height: 44rpx;margin-bottom: -2rpx;"></image>
        </view>
      </view>
      <!-- 中间标题区域 - 绝对居中 -->
      <view class="center-row-absolute">
        <view class="title">{{ title }}</view>
      </view>

      <!-- 右侧图标容器 -->
      <view class="right-icons-wrapper">
        <!-- 右上角：加入社区群（由页面控制是否显示） -->
        <view v-if="showJoin" class="btn_join nav-join-btn" @click.stop="emit('join-click')">
          <text>加入社区群</text>
        </view>

        <!-- 右侧搜索图标 -->
        <view class="search_part" v-if="isShowSearch" @click.stop="searchClick">
          <image class="bar_search" src="/static/images/search.svg" alt="搜索" />
        </view>

        <!-- 右侧公告图标 -->
        <view v-if="showGonggao" class="gonggao-icon" @click.stop="handleGonggaoClick">
          <image :src="gonggaoSrc" mode="widthFix" style="width: 48rpx; height: 48rpx;" />
        </view>

        <!-- 自定义右侧图标列表 -->
        <view v-if="rightIcons && rightIcons.length > 0" class="right-icons-container">
          <view 
            v-for="(icon, index) in rightIcons" 
            :key="index"
            class="right-icon-item"
            @click.stop="handleRightIconClick(icon, index)"
          >
            <image :src="icon.icon" mode="aspectFit" :style="icon.style || { width: '48rpx', height: '48rpx' }" />
          </view>
        </view>
      </view>

    </view>
	
  </view>
  <view v-else :style="{ height: topBarHeight, background: backgroundColor || '#fff' }">
    <view :style="{ height: statusBarHeight }"></view>
    <view style="display: flex; justify-content: space-between; align-items: center; padding: 0 20rpx 0 20rpx; box-sizing: border-box;"
      :style="{ height: titleBarHeight, paddingRight: paddingRightWidth }">
      <view :style="{ width: paddingRightWidth }">
        <view v-if="image" style="width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; margin-right: 20rpx;">
          <image mode="heightFix" style="width: 34rpx; height: 48rpx;" :src="image" @click="packClick"></image>
        </view>
      </view>
      <view style="width: 100%; text-align: center; font-size: 36rpx" :style="{ color: color }">{{ title }}</view>
    </view>
  </view>
  
    <!-- 字体选择弹窗 -->
    <view v-if="showFontPopup" class="font-popup-overlay" @click="showFontPopup = false">
      <view class="font-popup-content" @click.stop>
        <view class="font-popup-header">
          <text class="font-popup-title">选择字体</text>
          <text class="font-popup-close" @click="showFontPopup = false">✕</text>
        </view>
        <view class="font-list">
          <view 
            v-for="(font, index) in fontList" 
            :key="index"
            class="font-item" 
            :class="{ 'font-item-active': currentFont.name === font.name }"
            @click="selectFont(font)"
          >
            <text class="font-name">{{ font.name }}</text>
            <text v-if="currentFont.name === font.name" class="font-check">✓</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, inject } from 'vue'

const props = defineProps({
  viscosity: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ""
  },
  image: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: '#000000'
  },
  rightIcon: {
    type: String,
    default: ''
  },
  isShowTitle: {
    type: Boolean,
    default: true
  },
  showUser: {
    type: Boolean,
    default: false
  },
  userIcon: {
    type: String,
    default: ''
  },
  backgroundColor: {
    type: String,
    default: "#fff"
  },
  showFenLei: {
    type: Boolean,
    default: false
  },
  tagWrapShow: {
    type: Boolean,
    default: false
  },
  showMenu: {
    type: Boolean,
    default: false
  },
  sheZhi: {
    type: Boolean,
    default: false
  },
  dual: {
    type: Boolean,
    default: false
  },
  plazaPage: {
    type: Boolean,
    default: false
  },
  kaifaSrc: {
    type: String,
    default: '/static/images/add_kf.png'
  },
  showPlazaPublishButton: {
    type: Boolean,
    default: true
  },
  showSetPath: {
    type: Boolean,
    default: false
  },
  showBack: {
    type: Boolean,
    default: true
  },
  aigc: {
    type: Boolean,
    default: false
  },
  distribution: {
    type: Boolean,
    default: false
  },
  study: {
    type: Boolean,
    default: false
  },
  isbackindex: {
    type: Boolean,
    default: false
  },
  isShowSearch: {
    type: Boolean,
    default: false
  },
  showJoin: {
    type: Boolean,
    default: false
  },
  showFeedback: {
    type: Boolean,
    default: false
  },
  userInfo: {
    type: Object,
    required: false,
    default: null
  },
  showGonggao: {
    type: Boolean,
    default: false
  },
  gonggaoSrc: {
    type: String,
    default: '/static/images/gonggao.png'
  },
  rightIcons: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['clicksearch', 'nav-click', 'menu-click', 'pack', 'toSet', 'setshowBottom', 'toAdd', 'feedback-click', 'gonggao-click', 'right-icon-click', 'join-click'])

const $styleVariables = inject('styleVariables', {})

const fenLeiSrc = ref('/static/images/backf2.png')
const menuSrc = ref('/static/images/menu.svg')
const newFenLeiSrc = ref('/static/images/backf2.png')
const aigcIcon = ref('/static/images/aigc.png')
const showBottom = ref(false)
const showFontPopup = ref(false)
const fontList = ref([])
const currentFont = ref({})

const topBarHeight = computed(() => $styleVariables["--app-top-bar-height"])
const titleBarHeight = computed(() => $styleVariables["--app-nav-bar-height"])
const statusBarHeight = computed(() => $styleVariables["--app-status-bar-height"])
const paddingRightWidth = computed(() => $styleVariables["--app-nav-bar-width"])

watch(() => props.tagWrapShow, (newVal) => {
  const activeSrc = '/static/images/fl.pic.jpg'
  const inactiveSrc = '/static/images/backf2.png'
  const src = newVal ? activeSrc : inactiveSrc
  fenLeiSrc.value = src
  newFenLeiSrc.value = src
})

function handleNavClickEvent() {
  uni.$on('trigger-nav-click', handleNavClick)
}
handleNavClickEvent()

onBeforeUnmount(() => {
  uni.$off('trigger-nav-click', handleNavClick)
})

function navigateToUser() {
  uni.switchTab({
    url: '/pages/table/user/index'
  })
}

function toAigc() {
  uni.navigateTo({
    url: '/pages/tools/aigc/index'
  })
}

function searchClick() {
  emit('clicksearch')
}

function handleNavClick() {
  emit('nav-click', !props.tagWrapShow)
}

function handleMenuClick() {
  emit('menu-click')
}

function packClick() {
  if(props.showBack){
    if(props.isbackindex){
      const pages = getCurrentPages();
      if (pages.length <= 1) {
        uni.switchTab({
          url: '/pages/table/aiIndex/ai_index'
        });
        return;
      }
    } else {
      uni.navigateBack({
        delta: 1
      });
    }
  }
  emit("pack")
}

function NavClick() {
}

function toSet() {
  emit('toSet')
}

function setshowBottom() {
  emit('setshowBottom')
}

function checkFeedbackPermission() {
  const allowedPhones = ['19944894487', '18643389808', '19944895160', '17549549976'];
  
  const userInfoData = props.userInfo;
  let phone = userInfoData?.phone;
  
  if (!phone) {
    const cachedUser = uni.getStorageSync("data");
    if (cachedUser) {
      phone = cachedUser.authInfo?.phone || cachedUser.phone;
    }
  }
  
  const phoneStr = String(phone || '').trim();
  
  return allowedPhones.includes(phoneStr);
}

function handleFeedback() {
  emit('feedback-click')
}

function handleGonggaoClick() {
  emit('gonggao-click')
}

function handleRightIconClick(icon, index) {
  emit('right-icon-click', icon, index)
  if (icon.click) {
    icon.click()
  }
}
</script>

<style scoped>
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

.right-icons-wrapper {
  display: flex;
  align-items: center;
  position: absolute;
  right: 20rpx;
  gap: 10rpx;
}

.search_part {
    display: flex;
    align-items: center;
    color: #666666;
}

.bar_search {
    width: 48rpx;
    height: 48rpx;
    margin-left: 10rpx;
    margin-bottom: 6rpx;
}

.gonggao-icon {
  display: flex;
  align-items: center;
}

.back-right-moved {
  margin-left: 0; /* 向右移动 */
}

.title {
  font-size: 36rpx;
  color: #000;
  font-family: "AlimamaFangYuanTi";
  font-weight: bold;
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

/* 灵感图标容器：左侧与其它图标留空，右侧与标题区留空 */
.aigc-wrap {
  padding: 20rpx 0;
  margin-left: 24rpx;
  margin-right: 24rpx;
}

.aigc {
  margin-left: 0;
  margin-top: 0;
}

.distribution {
  width: 60rpx;
  height: 55rpx;
  position: absolute;
  right: 210rpx;
  top: 24rpx;
}

.btn_join {
  font-size: 24rpx;
  font-weight: bold;
  color: #000;
  text-transform: uppercase;
  padding: 0 5rpx;
  border-radius: 8rpx;
  border: 3rpx solid #000;
  background: #fff;
  /* box-shadow: 3rpx 3rpx 5rpx 0 #6d6d6d; */
  margin: 0;
  height: 42rpx;
  box-sizing: border-box;
}
.nav-join-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48rpx;
  padding: 0 14rpx;
  line-height: 1;
  white-space: nowrap;
}
.btn_join_switch{
  font-size: 24rpx;
  font-weight: bold;
  color: #000;
  text-transform: uppercase;
  padding: 0;
  border-radius: 0;
  border: 0 solid #000;
  background: #fff;
  /* box-shadow: 3rpx 3rpx 5rpx 0 #6d6d6d; */
  margin: 0;
  height: 46rpx;
  box-sizing: border-box;
}

.right-icons-container {
  display: flex;
  align-items: center;
  gap: 16rpx;
  position: absolute;
  right: 20rpx;
}

.right-icon-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10rpx;
  cursor: pointer;
}

.feedback-btn-nav {
  border: 1px solid #000;
  color: #000;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  background: #fff;
  font-size: 24rpx;
  line-height: 1.4;
  white-space: nowrap;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: 10rpx;
  /* 适配安全区域 */
  margin-left: calc(10rpx + constant(safe-area-inset-left));
  margin-left: calc(10rpx + env(safe-area-inset-left));
}

</style>
