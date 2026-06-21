<template>
  <view v-if="sourceIs" class="material-list-container chu-box" style="bottom: calc(100% + 20rpx); top: auto;" @click.stop>
    <view class="chu-inner" @click.stop>
      <view class="material-header">
        <text class="material-title">我的创作</text>
      </view>
      <view class="material-tabs" @click.stop>
        <view
          v-for="tab in tabList"
          :key="tab.id"
          class="material-tab"
          :class="{ active: activeTab === tab.id }"
          @click.stop="onTabChange(tab.id)">
          {{ tab.name }}
        </view>
      </view>
      <scroll-view
        class="chu-content chu-content-material"
        scroll-y
        @scrolltolower="onScrollToLower">
        <!-- 文本 -->
        <template v-if="activeTab === 1">
          <view
            v-for="(item, index) in textContentList"
            :key="'t-' + (item.id || index)"
            class="material-row"
            @click="onItemClick(item, 1)">
            <view class="material-row-main">
              <text class="material-row-title">{{ item.title || '文本内容' }}</text>
              <text class="material-row-time">{{ item.time || '' }}</text>
            </view>
            <text class="material-row-preview">{{ (item.content || '').slice(0, 30) }}{{ (item.content && item.content.length > 30) ? '...' : '' }}</text>
          </view>
          <view v-if="textContentList.length === 0 && !isLoading" class="empty-content">
            <text>暂无文本内容</text>
          </view>
        </template>
        <!-- 图片 -->
        <template v-if="activeTab === 2">
          <view
            v-for="(item, index) in imageContentList"
            :key="'i-' + (item.id || index)"
            class="material-row material-row-image"
            @click="onItemClick(item, 2)">
            <view class="material-row-main">
              <text class="material-row-title">{{ item.title || '图片内容' }}</text>
              <text class="material-row-time">{{ item.time || '' }}</text>
            </view>
            <view v-if="item.imageList && item.imageList[0]" class="material-thumb">
              <image :src="item.imageList[0]" mode="aspectFill" class="thumb-img" />
            </view>
          </view>
          <view v-if="imageContentList.length === 0 && !isLoading" class="empty-content">
            <text>暂无图片内容</text>
          </view>
        </template>
        <!-- 视频 -->
        <template v-if="activeTab === 3">
          <view
            v-for="(item, index) in videoContentList"
            :key="'v-' + (item.id || index)"
            class="material-row material-row-video"
            @click="onItemClick(item, 3)">
            <view class="material-row-main">
              <text class="material-row-title">{{ item.title || '视频内容' }}</text>
              <text class="material-row-time">{{ item.time || '' }}</text>
            </view>
            <view v-if="item.posterUrl || item.videoUrl" class="material-thumb">
              <image :src="item.posterUrl || item.videoUrl" mode="aspectFill" class="thumb-img" />
            </view>
          </view>
          <view v-if="videoContentList.length === 0 && !isLoading" class="empty-content">
            <text>暂无视频内容</text>
          </view>
        </template>
        <!-- 音频 -->
        <template v-if="activeTab === 4">
          <view
            v-for="(item, index) in audioContentList"
            :key="'a-' + (item.id || index)"
            class="material-row"
            @click="onItemClick(item, 4)">
            <view class="material-row-main">
              <text class="material-row-title">{{ item.title || '音频内容' }}</text>
              <text class="material-row-time">{{ item.time || '' }}</text>
            </view>
          </view>
          <view v-if="audioContentList.length === 0 && !isLoading" class="empty-content">
            <text>暂无音频内容</text>
          </view>
        </template>
        <view v-if="isLoading" class="loading-more">
          <text>加载中...</text>
        </view>
        <view v-if="!hasMore && currentListLength > 0" class="no-more">
          <text>没有更多了</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

defineOptions({
  name: 'MaterialList'
});

const props = defineProps({
  sourceIs: {
    type: Boolean,
    default: true
  },
  activeTab: {
    type: Number,
    default: 1
  },
  textContentList: {
    type: Array,
    default: () => []
  },
  imageContentList: {
    type: Array,
    default: () => []
  },
  videoContentList: {
    type: Array,
    default: () => []
  },
  audioContentList: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  hasMore: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['tab-change', 'scroll-to-lower', 'item-click']);

const tabList = ref([
  { id: 1, name: '文本' },
  { id: 2, name: '图片' },
  { id: 3, name: '视频' },
  { id: 4, name: '音频' }
]);

const currentListLength = computed(() => {
  switch (props.activeTab) {
    case 1: return props.textContentList.length;
    case 2: return props.imageContentList.length;
    case 3: return props.videoContentList.length;
    case 4: return props.audioContentList.length;
    default: return 0;
  }
});

function onTabChange(tabId) {
  emit('tab-change', tabId);
}

function onScrollToLower() {
  emit('scroll-to-lower');
}

function onItemClick(item, type) {
  emit('item-click', item, type);
}
</script>

<style lang="scss" scoped>
.material-list-container {
  width: calc(100% - 40rpx);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  position: absolute;
  z-index: 1002;
  font-family: 'AlimamaFangYuanTi';
  background: transparent;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  opacity: 0;
  transform: translateY(60rpx);
  animation: slideUp 0.3s ease forwards;
  max-height: 70vh;
  overflow: hidden;
  pointer-events: auto;
  left: 20rpx;
  right: 20rpx;
}

.chu-inner {
  width: 100%;
  border-radius: 15rpx;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.15);
}

.material-header {
  padding: 20rpx 20rpx 12rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.material-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.material-tabs {
  display: flex;
  flex-direction: row;
  padding: 12rpx 20rpx;
  gap: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.material-tab {
  padding: 8rpx 24rpx;
  font-size: 26rpx;
  color: #666;
  border-radius: 20rpx;
  background: #f5f5f5;
}

.material-tab.active {
  background: #5a85ff;
  color: #fff;
  font-weight: bold;
}

.chu-content-material {
  height: 50vh;
  max-height: 500rpx;
  padding: 10rpx 20rpx 20rpx;
}

.material-row {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.material-row:active {
  background: #f9f9f9;
}

.material-row-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6rpx;
}

.material-row-title {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-row-time {
  font-size: 22rpx;
  color: #999;
  flex-shrink: 0;
  margin-left: 12rpx;
}

.material-row-preview {
  font-size: 24rpx;
  color: #666;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-row-image,
.material-row-video {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.material-thumb {
  width: 100rpx;
  height: 100rpx;
  flex-shrink: 0;
  border-radius: 8rpx;
  overflow: hidden;
  background: #f0f0f0;
}

.thumb-img {
  width: 100%;
  height: 100%;
}

.empty-content {
  padding: 60rpx 20rpx;
  text-align: center;
  font-size: 28rpx;
  color: #999;
}

.loading-more,
.no-more {
  text-align: center;
  padding: 20rpx;
  font-size: 26rpx;
  color: #999;
}

.loading-more {
  color: #5a85ff;
}

@keyframes slideUp {
  0% {
    opacity: 0;
    transform: translateY(60rpx);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>