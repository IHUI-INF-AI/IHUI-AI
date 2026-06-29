<template>
  <view v-if="false" class="scrollable-button-group button-group z_index_1000" :style="{ bottom: isShowIcon ? imgsList.length > 0 ? '512rpx' : pageAgentVariables.length > 0 ? 280+(agentcanLength*50) + 'rpx':'352rpx' : imgsList.length > 0 ? '332rpx' : pageAgentVariables.length > 0 ? 110+(agentcanLength*50) + 'rpx':'182rpx' }">
    <view class="toggle-button" @click.stop="toggleSuperAgent" :class="indexc == 0 ? 'toggle_btn' : ''">
        <view class="toggle_back"></view>
        <view class="toggle-button_back_bot">
            <view class="toggle-button_back" >
                <image v-if="indexc != 0" src="/static/images/default/home/xiaofang_icon.png"
                        style="width: 35rpx;height: 30rpx;margin-right: 0;" mode="aspectFit" class="toggle-button-img"></image>
                <image v-if="indexc == 0" src="/static/images/xtk/active.png"
                        style="width: 34rpx;height: 34rpx;margin-right: 0;" mode="widthFix" class="toggle-button-img"></image>
                <view class="toggle-button-text">
                    <view class="toggle-button-text-top">超级</view>
                    <view class="toggle-button-text-bottom" style="font-size: 20rpx !important;">智能体</view>
                </view>
            </view>
        </view>
    </view>
    <view class="toggle-button" @click.stop="toggleMCP" :class="indexc == 1 ? 'toggle_btn' : ''">
        <view class="toggle_back"></view>
        <view class="toggle-button_back_bot">
            <view class="toggle-button_back" >
                <image v-if="indexc != 1" src="/static/images/default/home/setting_icon.png"
                        style="width: 30rpx;height: 24rpx;margin-right: 0;" mode="aspectFit" class="toggle-button-img"></image>
                <image v-if="indexc == 1" src="/static/images/xtk/active.png"
                        style="width: 34rpx;height: 34rpx;margin-right: 0;" mode="widthFix" class="toggle-button-img"></image>
                <view class="toggle-button-text">
                    <view class="toggle-button-text-top">MCP</view>
                    <view class="toggle-button-text-bottom" style="font-size: 16rpx;color: #909090;line-height: 18rpx;">Tool</view>
                </view>
            </view>
        </view>
    </view>
    <view class="toggle-button" @click.stop="toggleKnowledgeBase" :class="currentIndexActive ? 'toggle_btn' : ''">
        <view class="toggle_back"></view>
        <view class="toggle-button_back_bot">
            <view class="toggle-button_back" >
                <image v-if="currentIndexActive" src="/static/images/xtk/active.png"
                style="width: 34rpx;height: 34rpx;margin-right: 0;" mode="widthFix" class="toggle-button-img"></image>
                <image v-else src="/static/images/default/home/zhishi_icon.png"
                        style="width: 30rpx;height: 30rpx;margin-right: 0;" mode="aspectFit" class="toggle-button-img"></image>
                <view class="toggle-button-text">
                    <view class="toggle-button-text-top">知识库</view>
                </view>
            </view>
        </view>
    </view>
    <view class="toggle-button" @click.stop="togglePermanentMemory" :class="currentIndexaActive ? 'toggle_btn' : ''">
        <view class="toggle_back"></view>
        <view class="toggle-button_back_bot">
            <view class="toggle-button_back" >
              <image v-if="currentIndexaActive" src="/static/images/xtk/active.png"
              style="width: 34rpx;height: 34rpx;margin-right: 0;" mode="widthFix" class="toggle-button-img"></image>
                <image v-else src="/static/images/default/home/jiyi_icon.png"
                        style="width: 30rpx;height: 30rpx;margin-right: 0;" mode="aspectFit" class="toggle-button-img"></image>
                <view class="toggle-button-text">
                    <view class="toggle-button-text-top">永久记忆</view>
                </view>
            </view>
        </view>
    </view>
    <view class="toggle-button" @click.stop="togglePermanentMemorya" :class="indexc == 4 ? 'toggle_btn' : ''">
        <view class="toggle_back"></view>
        <view class="toggle-button_back_bot">
            <view class="toggle-button_back" >
              <image v-if="indexc == 4" src="/static/images/xtk/active.png"
                        style="width: 34rpx;height: 34rpx;margin-right: 0;" mode="widthFix" class="toggle-button-img"></image>
                <image v-else src="/static/images/default/home/tel_icon.png"
                        style="width: 24rpx;height: 24rpx;margin-right: 0;" mode="aspectFit" class="toggle-button-img"></image>
                <view class="toggle-button-text">
                    <view class="toggle-button-text-top">语音通话</view>
                </view>
            </view>
        </view>
    </view>
    <view class="toggle-button" @click.stop="togglePermanentMemoryb" :class="indexc == 5 ? 'toggle_btn' : ''">
        <view class="toggle_back"></view>
        <view class="toggle-button_back_bot">
            <view class="toggle-button_back" >
              <image v-if="indexc == 5" src="/static/images/xtk/active.png"
                        style="width: 34rpx;height: 34rpx;margin-right: 0;" mode="widthFix" class="toggle-button-img"></image>
                <image v-else src="/static/images/default/home/video_icon.png"
                        style="width: 30rpx;height: 22rpx;margin-right: 0;" mode="aspectFit" class="toggle-button-img"></image>
                <view class="toggle-button-text">
                    <view class="toggle-button-text-top">视频通话</view>
                </view>
            </view>
        </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  pageAgentVariables: Array,
  isShowIcon: {
    type: Boolean,
    default: false,
  },
  imgsList: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['toggle-super-agent', 'toggle-super-agentfu', 'toggle-mcp', 'toggle-knowledge-base', 'toggle-permanent-memory'])

const agentcanLength = computed(() => {
  return props.pageAgentVariables?.reduce((acc, item) => acc + (item.components?.length || 0), 0) || 0
})

const indexc = ref(-1)
const currentIndexActive = ref(uni.getStorageSync('currentIndexActive'))
const currentIndexaActive = ref(uni.getStorageSync('currentIndexaActive'))

function toggleSuperAgent() {
  if (indexc.value == 0) {
    indexc.value = -1
    emit('toggle-super-agentfu')
  } else {
    indexc.value = 0
    emit('toggle-super-agent')
  }
}

function toggleMCP() {
  if (indexc.value == 1) {
    indexc.value = -1
  } else {
    indexc.value = 1
  }
  emit('toggle-mcp')
}

function toggleKnowledgeBase() {
  if (indexc.value == 2) {
    indexc.value = -1
  } else {
    indexc.value = 2
  }
  let val = uni.getStorageSync('currentIndexActive')
  uni.setStorageSync('currentIndexActive', !val)
  currentIndexActive.value = !val
  emit('toggle-knowledge-base')
}

function togglePermanentMemory() {
  if (indexc.value == 3) {
    indexc.value = -1
  } else {
    indexc.value = 3
  }
  let val = uni.getStorageSync('currentIndexaActive')
  uni.setStorageSync('currentIndexaActive', !val)
  currentIndexaActive.value = !val
  emit('toggle-permanent-memory')
}

function togglePermanentMemorya() {
  if (indexc.value == 4) {
    indexc.value = -1
  } else {
    indexc.value = 4
  }
  emit('toggle-permanent-memory')
}

function togglePermanentMemoryb() {
  if (indexc.value == 5) {
    indexc.value = -1
  } else {
    indexc.value = 5
  }
  uni.navigateTo({
    url: '/pages/tools/ai_teacher'
  })
  emit('toggle-permanent-memory')
}
</script>

<style lang="scss" scoped>

.button-group {
  display: flex;
  justify-content: space-between;
  margin: 10rpx auto -5rpx;

  // width: calc(100% - 100rpx);
  width: calc(100% - 44rpx);
  gap: 16rpx;
  position: static;
  bottom: 110rpx;
  left: 0;
  right: 0;
  z-index: 1;
  padding-top: 15rpx;
}

.button-group-box {
  display: flex;
  justify-content: space-between;
  margin: 10rpx auto 8rpx;
  width: calc(100% - 100rpx);
  gap: 16rpx;
  position: fixed;
  bottom: 170rpx;
  left: 0;
  right: 0;
  z-index: 1;
}

.toggle-button {
  width: calc(25% - 21rpx);
  padding:1rpx;
  background:#fff;
  border-width: 2rpx;
  margin: 0 8rpx 0 0;
  border-radius: 15rpx;
  font-size: 28rpx;
  transition: background-color 0.3s;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  box-shadow: none;
  -webkit-tap-highlight-color: transparent;
  tap-highlight-color: transparent;
  outline: none;
  overflow:hidden;
  border: 1px solid #c4c4c4;

//   background: linear-gradient(263deg, #D19EFF 8%, rgba(255, 242, 0, 0.3) 33%, rgba(146, 146, 146, 0.3) 52%, rgba(255, 242, 0, 0.3) 72%, #CD96FF 91%);
}

.toggle_btn {
    position: relative;
    overflow: hidden;

    // box-shadow: 1rpx 1rpx 0rpx 0rpx rgba(0, 0, 0, 0.3),0rpx 6rpx 20rpx 0rpx rgba(255, 255, 255, 0.8);
    border-color: #518dfd;
    background-color: #d9e6fd;
    color: #033a9e !important;

    view{
      color: #0105ff !important;
    }
}

.toggle_btn .toggle_back{
    position: absolute;
    inset:-75rpx 0 0;
    height: 200rpx;
    background: linear-gradient(263deg, #9ec8ff 8%, rgb(81 255 0 / 0.3) 33%, rgb(146 146 146 / 0.3) 52%, rgb(0 255 149 / 0.3) 72%, #96aeff 91%);

    // background: linear-gradient(263deg, #D19EFF 8%, rgba(255, 242, 0, 0.3) 33%, rgba(146, 146, 146, 0.3) 52%, rgba(255, 242, 0, 0.3) 72%, #CD96FF 91%);
    animation: rotate 3s linear infinite;
    display: none;
}

@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.toggle-button_back_bot {
  width:100%;
  height: 100%;
  background:none;
  border-radius: 15rpx;
  position: relative;
  z-index:1;
}

// .toggle-button_back_bot::before {
//     content: "";
//     position: absolute;
//     top: 5px;
//     left: 5px;
//     right: -5px;
//     bottom: -5px;
//     background-color: rgba(0, 0, 0, 0.1);
//     border-radius: 20px;
//     z-index: -1;
//     filter: blur(5px);
// }

.toggle-button_back{
    border-radius: 15rpx;
    font-size: 28rpx;
    transition: background-color 0.3s;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    box-shadow: none;

    // padding-left: 10rpx;
    -webkit-tap-highlight-color: transparent;
    tap-highlight-color: transparent;
    outline: none;

    // background: linear-gradient(106deg, rgba(20, 20, 20, 0) 4%, rgba(42, 43, 41, 0) 104%);
    // background: linear-gradient(106deg, rgba(205, 208, 255, 0.3) 4%, rgba(253, 255, 225, 0.3) 104%);
    width:100%;
    height: 100%;

    image {
      margin-left: 10rpx;
    }
}

.toggle-button:last-child {
  margin-right: 0;
}

.toggle-button-text {
  display: block;
  color: #000;
  text-align: center;
  width: calc(100% - 30rpx);
  font-family: AlimamaFangYuanTi;
}

.toggle-button-text-top {
  font-size: 20rpx;
  line-height: 22rpx;
  font-family: AlimamaFangYuanTi;
}

.toggle-button-text-bottom {
  // font-size: 10rpx !important;
  line-height: 22rpx;
  font-family: AlimamaFangYuanTi;
}

.button-group-box-inner {
  color: #000;
  font-size: 18rpx;
  font-family: AlimamaFangYuanTi;
}

.button-group-box-inner:first-child {
  color: rgb(0 0 0 / 0.6);
}

// .custom-carousel-wrapper {


//   // border: 4rpx solid #e0e0e0;
//   // box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.08);
//   // border-width: 4rpx;
//   border: 1px solid rgba(156, 156, 156, 0.3);
//   // border-image: linear-gradient(235deg, #D19EFF 6%, rgba(255, 242, 0, 0.3) 31%, rgba(146, 146, 146, 0.3) 52%, rgba(255, 242, 0, 0.3) 73%, #CD96FF 93%) 1;
//   box-shadow: 0px 0px 6px 0px rgba(21, 0, 255, 0.3);
//   box-sizing: border-box;
//   border-radius: 30rpx;
//   overflow: hidden;

//   // background: #fff;
// }

.carousel-img {
  width: 100%;
  height: 100%;
  border-radius: 30rpx; /* 和外层一致 */
  display: block;
}

// .gradient-border {
//   position: relative;
//   border-radius: 30rpx;
//   padding: 4rpx; /* 边框宽度 */
//   background: linear-gradient(235deg, #D19EFF 6%, rgba(255, 242, 0, 0.3) 31%, rgba(146, 146, 146, 0.3) 52%, rgba(255, 242, 0, 0.3) 73%, #CD96FF 93%);
//   /* 可选阴影 */
//   box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.08);
// }

.carousel-inner {
  border-radius: 30rpx; /* 比外层略小 */
  overflow: hidden;
  background: #fff; /* 内层背景 */
}

.search-input {
  font-family: AlimamaFangYuanTi;

  /* 其他样式 */
}

.icon-imagea {
  width: 70rpx;
  height: 70rpx;
  margin-bottom: 12rpx;
}

.icon-text {
  font-size: 20rpx;
  line-height: 40rpx;
  color: rgb(0 0 0 / 0.9);
  font-family: AlimamaFangYuanTi;
}

.search-box2-img {
  transition: transform 0.5s ease; /* 添加过渡效果 */
}

.rotate-icon {
  transform: rotate(45deg); /* 旋转45度 */
}

.scrollable-button-group {
  display: flex;
  overflow-x: auto; /* 允许水平滚动 */
  white-space: nowrap; /* 防止子元素换行 */
  // padding: 25rpx 15rpx;
  margin: 0 auto;
  padding: 15rpx 0 0;
}

.toggle-button {
  display: flex; /* 确保按钮在一行内 */
//   width: 130rpx;
  margin-right: 8rpx;
  flex: none;

  /* 其他样式 */
}
</style>
