<template>
  <view class="my-ai-model-page">
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="nav-title">我的AI模型</text>
    </view>

    <view class="content">
      <view v-if="modelList.length === 0" class="empty-state">
        <image class="empty-icon" src="/static/images/empty.png" mode="aspectFit" />
        <text class="empty-text">暂无AI模型</text>
      </view>

      <view v-else class="model-list">
        <view v-for="(model, index) in modelList" :key="index" class="model-card" @click="onModelClick(model)">
          <image class="model-icon" :src="model.img || '/static/images/default_model.png'" mode="aspectFit" />
          <view class="model-info">
            <text class="model-name">{{ model.source || model.name }}</text>
            <text class="model-desc">{{ model.remark || '暂无描述' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCozeApiList } from '@/service/aiModels.js'

const modelList = ref<any[]>([])

onMounted(() => {
  loadModels()
})

function loadModels() {
  getCozeApiList().then((res: any) => {
    if (res && res.data) {
      modelList.value = res.data
    }
  }).catch((err: unknown) => {
    console.error('加载模型列表失败:', err)
  })
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}

function onModelClick(model: any) {
  uni.showToast({ title: model.source || model.name, icon: 'none' })
}
</script>

<style lang="scss" scoped>
.my-ai-model-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 88rpx;
  background: #fff;
  display: flex;
  align-items: center;
  padding-top: var(--status-bar-height);
  z-index: 100;
}

.nav-back {
  padding: 20rpx;
}

.back-icon {
  font-size: 40rpx;
  color: #333;
}

.nav-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.content {
  padding: 20rpx;
  padding-top: calc(var(--status-bar-height) + 88rpx);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}

.empty-icon {
  width: 200rpx;
  height: 200rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.model-list {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.model-card {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }
}

.model-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 12rpx;
  margin-right: 20rpx;
}

.model-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.model-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.model-desc {
  font-size: 26rpx;
  color: #999;
}
</style>
