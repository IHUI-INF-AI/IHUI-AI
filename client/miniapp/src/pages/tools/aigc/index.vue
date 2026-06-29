<template>
  <view class="container" style="padding: 0">
    <!-- 导航栏 -->
    <navigation-bars 
      v-show="!showFullScreen" 
      :viscosity="true" 
      color="#171717" 
      font-size-30 
      title="灵感"
      @pack="backPage"
      :image="'/static/images/back.svg'"
    />

    <!-- 分类按钮 -->
    <view class="fenlei_btn_list">
      <view 
        class="fenlei_btn" 
        :class="fenlei_active.includes(index) ? 'active' : ''" 
        v-for="(item, index) in agentMainCategory" 
        :key="index" 
        @click="fenlei_active_btn(index, item)"
      >
        <image :src="fenlei_active.includes(index) ? item.butUrl : item.url" mode="widthFix" class="fenlei_icon"></image>
        {{ item.name }}
      </view>
    </view>

    <!-- 内容列表 -->
    <scroll-view 
      ref="scrollY" 
      id="scroll_y" 
      class="scroll_y" 
      :scroll-top="0" 
      scroll-y="true" 
      lower-threshold="50" 
      @scrolltolower="scrolltolower"
    >
      <!-- 文本内容 -->
      <view v-if="currentFileType === 4" class="content-list">
        <view 
          v-for="(item, index) in viewList" 
          :key="item.id || index"
          class="content-item text-item"
        >
          <view class="content-header">
            <text class="content-title">{{ item.title || '文本内容' }}</text>
            <text class="content-time">{{ item.time || '' }}</text>
          </view>
          <view v-if="item.prompt" class="content-prompt">
            <text class="prompt-label">提示词：</text>
            <text class="prompt-text">{{ item.context }}</text>
          </view>
          <view class="content-body">
            <text class="content-text">{{ item.content }}</text>
          </view>
        </view>
        <view v-if="viewList.length === 0 && !loading" class="empty-content">
          <text>暂无文本内容</text>
        </view>
      </view>

      <!-- 音频内容 -->
      <view v-if="currentFileType === 3" class="audio-list-container">
        <view class="audio-list-grid">
          <view 
            v-for="(item, index) in viewList" 
            :key="item.id || index"
            class="audio-card-item"
          >
            <view class="audio-record-container">
              <view class="audio-record-background" :class="{ 'rotating': audioPlayStates[index] }">
                <image src="/static/images/record_back.png" mode="aspectFit" class="record-bg-image" />
                <view class="audio-cover-wrapper">
                  <image 
                    v-if="item.coverUrl" 
                    :src="item.coverUrl" 
                    mode="aspectFill" 
                    class="audio-cover-image"
                  />
                  <view v-else class="audio-cover-placeholder"></view>
                </view>
              </view>
              <image 
                src="/static/images/center_dot.png" 
                mode="aspectFit" 
                class="center-dot"
                @click="toggleAudio(index, item)"
              />
            </view>
            <view class="audio-info">
              <text class="audio-title">{{ item.title || '音频' }}</text>
              <text class="audio-duration">{{ item.duration || '0:00' }}</text>
            </view>
          </view>
        </view>
        <view v-if="viewList.length === 0 && !loading" class="empty-content">
          <text>暂无音频内容</text>
        </view>
      </view>

      <!-- 图片内容 -->
      <view v-if="currentFileType === 1" class="image-list-container">
        <view class="image-grid">
          <view 
            v-for="(item, index) in viewList" 
            :key="item.id || index"
            class="image-card-item"
            @click="previewImage(index)"
          >
            <image 
              :src="item.url || item.coverUrl" 
              mode="aspectFill" 
              class="image-cover"
            />
            <view class="image-info">
              <text class="image-title">{{ item.title || '图片' }}</text>
            </view>
          </view>
        </view>
        <view v-if="viewList.length === 0 && !loading" class="empty-content">
          <text>暂无图片内容</text>
        </view>
      </view>

      <!-- 视频内容 -->
      <view v-if="currentFileType === 2" class="video-list-container">
        <view 
          v-for="(item, index) in viewList" 
          :key="item.id || index"
          class="video-card-item"
        >
          <video 
            :src="item.url" 
            class="video-player" 
            controls 
            :poster="item.coverUrl"
          />
          <view class="video-info">
            <text class="video-title">{{ item.title || '视频' }}</text>
          </view>
        </view>
        <view v-if="viewList.length === 0 && !loading" class="empty-content">
          <text>暂无视频内容</text>
        </view>
      </view>

      <!-- 加载更多 -->
      <view v-if="loading" class="loading-more">
        <text>加载中...</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import NavigationBars from '@/components/navigation-bars/index.vue'
import { getContentList } from '@/service/aigc.js'

// 数据
const viewList = ref<any[]>([])
const loading = ref(false)
const pageNum = ref(1)
const total = ref(0)
const currentFileType = ref(4) // 1:图片, 2:视频, 3:音频, 4:文本
const showFullScreen = ref(false)

// 分类相关
const agentMainCategory = ref<any[]>([])
const fenlei_active = ref<number[]>([])

// 音频播放状态
const audioPlayStates = ref<boolean[]>([])
// 当前正在播放的音频索引
const currentAudioIndex = ref(-1)
// 音频播放上下文
const innerAudioContext = uni.createInnerAudioContext()

innerAudioContext.onEnded(() => {
  if (currentAudioIndex.value >= 0) {
    audioPlayStates.value[currentAudioIndex.value] = false
  }
  currentAudioIndex.value = -1
})
innerAudioContext.onError((err) => {
  console.error('音频播放错误:', err)
  uni.showToast({ title: '音频播放失败', icon: 'none' })
  if (currentAudioIndex.value >= 0) {
    audioPlayStates.value[currentAudioIndex.value] = false
  }
  currentAudioIndex.value = -1
})

onMounted(() => {
  loadContent()
})

// 加载内容
async function loadContent() {
  loading.value = true
  try {
    // gc_type 映射：1=图片 2=视频 3=音频 4=文本，与 currentFileType 一致
    const res = await getContentList(pageNum.value, 10, currentFileType.value)
    if (res && (res.code === 0 || res.code === 200 || res.code === undefined)) {
      const list = Array.isArray(res.data) ? res.data : (res.data && res.data.list) || []
      if (pageNum.value === 1) {
        viewList.value = list
      } else {
        viewList.value = [...viewList.value, ...list]
      }
      total.value = res.total || (res.data && res.data.total) || 0
    }
  } catch (error) {
    console.error('加载内容失败:', error)
    uni.showToast({ title: '加载内容失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 分类点击
function fenlei_active_btn(index: number, item: any) {
  const idx = fenlei_active.value.indexOf(index)
  if (idx > -1) {
    fenlei_active.value.splice(idx, 1)
  } else {
    fenlei_active.value = [index]
  }
  // 切换文件类型
  if (item.fileType) {
    currentFileType.value = item.fileType
  }
  pageNum.value = 1
  viewList.value = []
  loadContent()
}

// 滚动加载
function scrolltolower() {
  if (viewList.value.length < total.value) {
    pageNum.value++
    loadContent()
  }
}

// 切换音频播放
function toggleAudio(index: number, item: any) {
  // 当前正在播放此音频 -> 暂停
  if (currentAudioIndex.value === index) {
    innerAudioContext.pause()
    audioPlayStates.value[index] = false
    currentAudioIndex.value = -1
    return
  }
  // 停止上一个正在播放的音频
  if (currentAudioIndex.value >= 0) {
    innerAudioContext.stop()
    audioPlayStates.value[currentAudioIndex.value] = false
  }
  const src = item.url || item.fileUrl || item.audioUrl || ''
  if (!src) {
    uni.showToast({ title: '音频地址无效', icon: 'none' })
    return
  }
  // 设置新的播放源并播放
  innerAudioContext.src = src
  currentAudioIndex.value = index
  audioPlayStates.value[index] = true
  innerAudioContext.play()
}

// 预览图片
function previewImage(index: number) {
  const urls = viewList.value.map((item: any) => item.url || item.coverUrl)
  uni.previewImage({
    current: index,
    urls: urls,
  })
}

// 返回上一页
function backPage() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.fenlei_btn_list {
  display: flex;
  flex-wrap: wrap;
  padding: 20rpx;
  background: #fff;
}

.fenlei_btn {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  margin: 0 16rpx 16rpx 0;
  background: #f5f5f5;
  border-radius: 30rpx;
  font-size: 26rpx;
  color: #333;

  &.active {
    background: #007aff;
    color: #fff;
  }

  .fenlei_icon {
    width: 36rpx;
    height: 36rpx;
    margin-right: 8rpx;
  }
}

.scroll_y {
  height: calc(100vh - 200rpx);
  padding: 20rpx;
}

.content-list {
  .content-item {
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx;
    margin-bottom: 20rpx;
  }

  .content-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16rpx;
  }

  .content-title {
    font-size: 30rpx;
    font-weight: bold;
    color: #333;
  }

  .content-time {
    font-size: 24rpx;
    color: #999;
  }

  .content-prompt {
    background: #f5f5f5;
    padding: 16rpx;
    border-radius: 8rpx;
    margin-bottom: 16rpx;
  }

  .prompt-label {
    font-size: 24rpx;
    color: #999;
  }

  .prompt-text {
    font-size: 26rpx;
    color: #666;
  }

  .content-body {
    font-size: 28rpx;
    color: #333;
    line-height: 1.6;
  }
}

.audio-list-container {
  .audio-list-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .audio-card-item {
    width: 48%;
    background: #fff;
    border-radius: 16rpx;
    padding: 20rpx;
    margin-bottom: 20rpx;
  }

  .audio-record-container {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .audio-record-background {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #333;
    position: relative;
    overflow: hidden;

    &.rotating {
      animation: rotate 3s linear infinite;
    }
  }

  .record-bg-image {
    width: 100%;
    height: 100%;
  }

  .audio-cover-wrapper {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40%;
    height: 40%;
    border-radius: 50%;
    overflow: hidden;
  }

  .audio-cover-image {
    width: 100%;
    height: 100%;
  }

  .audio-cover-placeholder {
    width: 100%;
    height: 100%;
    background: #666;
  }

  .center-dot {
    position: absolute;
    width: 40rpx;
    height: 40rpx;
    z-index: 10;
  }

  .audio-info {
    text-align: center;
    margin-top: 16rpx;
  }

  .audio-title {
    font-size: 26rpx;
    color: #333;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .audio-duration {
    font-size: 22rpx;
    color: #999;
  }
}

.image-list-container {
  .image-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .image-card-item {
    width: 48%;
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    margin-bottom: 20rpx;
  }

  .image-cover {
    width: 100%;
    height: 300rpx;
  }

  .image-info {
    padding: 16rpx;
  }

  .image-title {
    font-size: 26rpx;
    color: #333;
  }
}

.video-list-container {
  .video-card-item {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    margin-bottom: 20rpx;
  }

  .video-player {
    width: 100%;
    height: 400rpx;
  }

  .video-info {
    padding: 16rpx;
  }

  .video-title {
    font-size: 28rpx;
    color: #333;
  }
}

.empty-content {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 28rpx;
}

.loading-more {
  text-align: center;
  padding: 20rpx 0;
  color: #999;
  font-size: 24rpx;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
