<template>
  <view class="model-plaza-page">
    <navigation-bars
      color="black"
      :viscosity="true"
      title="模型广场"
      @pack="backPage"
      :image="'/static/images/back.svg'"
    />
    <view class="plaza-body">
      <!-- 厂商分类：横向滚动选择 -->
      <view class="provider-section">
        <view class="section-label">选择厂商</view>
        <scroll-view class="provider-tabs" scroll-x scroll-with-animation :show-scrollbar="false">
          <view class="provider-tabs-inner">
            <view
              v-for="p in providers"
              :key="p.id"
              class="provider-tab"
              :class="{ active: providerId === p.id }"
              @click="providerId = p.id"
            >
              <image class="provider-tab-icon" :src="p.icon" mode="aspectFit" />
              <text class="provider-tab-text">{{ p.name }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
      <!-- 厂商头部 -->
      <view class="provider-header">
        <view class="provider-name">{{ currentProvider.name }}</view>
        <view class="provider-meta">共 {{ listByProvider.length > 0 ? filteredList.length : currentProvider.total }} 个模型<text v-if="listByProvider.length > 0 && listByProvider.length < currentProvider.total" class="meta-hint">（已同步 {{ listByProvider.length }} 条）</text></view>
        <view class="provider-desc">{{ currentProvider.desc }}</view>
      </view>
      <!-- 分类 tabs：全部 / 文本 / 图像 -->
      <view class="type-tabs">
        <view
          v-for="tab in typeTabs"
          :key="tab.value"
          class="type-tab"
          :class="{ active: typeFilter === tab.value }"
          @click="typeFilter = tab.value"
        >
          {{ tab.label }}
        </view>
      </view>
      <!-- 模型列表：卡片式，风格与项目列表一致 -->
      <scroll-view class="model-list" scroll-y>
        <view
          v-for="(item, index) in filteredList"
          :key="(item.providerId || '') + '-' + item.id"
          class="model-card chu-row"
        >
          <view class="card-top">
            <view class="model-name">{{ item.name }}</view>
            <view class="model-type-tag" :class="item.type === '图像' ? 'type-image' : (item.type === '音视频' ? 'type-av' : 'type-text')">
              {{ item.type }}
            </view>
          </view>
          <view class="card-price">
            <text class="price-label">Input</text>
            <text class="price-value">¥{{ item.inputPrice }}{{ item.outputPrice && item.outputPrice !== '-' ? '/M' : '' }}</text>
            <template v-if="item.outputPrice && item.outputPrice !== '-'">
              <text class="price-divider">|</text>
              <text class="price-label">Output</text>
              <text class="price-value">¥{{ item.outputPrice }}/M</text>
            </template>
            <text v-else class="price-extra">（按次/视图计费）</text>
          </view>
          <view v-if="item.desc" class="card-desc">{{ item.desc }}</view>
          <view v-if="item.tags && item.tags.length" class="card-tags">
            <text
              v-for="(tag, i) in item.tags"
              :key="i"
              class="tag-item"
            >{{ tag }}</text>
          </view>
          <view class="card-footer">
            <text class="pay-mode">{{ item.payMode }}</text>
          </view>
        </view>
        <view v-if="filteredList.length === 0" class="empty-wrap">
          <view class="empty-tip">{{ emptyTip }}</view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import NavigationBars from '@/components/navigation-bars/index.vue'
import { PROVIDERS, MODEL_LIST } from './modelPlazaData.js'

const providers = PROVIDERS
const modelList = MODEL_LIST
const providerId = ref('OpenAI')
const typeFilter = ref('all')
const typeTabs = [
  { label: '全部', value: 'all' },
  { label: '文本', value: '文本' },
  { label: '图像', value: '图像' },
  { label: '音视频', value: '音视频' }
]

const currentProvider = computed(() => {
  return providers.find(p => p.id === providerId.value) || providers[0] || { name: '-', total: 0, desc: '' }
})

const listByProvider = computed(() => {
  return modelList.filter((m: any) => m.providerId === providerId.value)
})

const filteredList = computed(() => {
  let list = listByProvider.value
  if (typeFilter.value !== 'all') list = list.filter((m: any) => m.type === typeFilter.value)
  return list
})

const emptyTip = computed(() => {
  if (listByProvider.value.length === 0) return '暂无该厂商模型数据'
  return '暂无该类型模型'
})

function backPage() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/table/aiIndex/ai_index' }) })
}
</script>

<style lang="scss" scoped>
.model-plaza-page {
  min-height: 100vh;
  background: #f8f9fa;
}

.plaza-body {
  padding: 24rpx;
}

.provider-section {
  margin-bottom: 24rpx;

  .section-label {
    font-size: 26rpx;
    color: #666;
    margin-bottom: 16rpx;
  }

  .provider-tabs {
    white-space: nowrap;
    width: 100%;
  }

  .provider-tabs-inner {
    display: inline-flex;
    gap: 16rpx;
    padding: 4rpx 0;
  }

  .provider-tab {
    display: inline-flex;
    align-items: center;
    gap: 12rpx;
    padding: 18rpx 28rpx;
    font-size: 28rpx;
    color: #666;
    background: #fff;
    border: 1rpx solid #eee;
    border-radius: 32rpx;
    flex-shrink: 0;

    .provider-tab-icon {
      width: 36rpx;
      height: 36rpx;
      flex-shrink: 0;
      opacity: 0.85;
    }

    .provider-tab-text {
      flex-shrink: 0;
    }

    &.active {
      color: #1888ee;
      background: rgba(24, 136, 238, 0.08);
      border-color: rgba(24, 136, 238, 0.3);
      font-weight: 500;

      .provider-tab-icon {
        opacity: 1;
      }
    }
  }
}

.provider-header {
  background: #fff;
  border: 1rpx solid #eee;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 24rpx;

  .provider-name {
    font-size: 36rpx;
    font-weight: 600;
    color: #171717;
    margin-bottom: 8rpx;
  }

  .provider-meta {
    font-size: 26rpx;
    color: #999;
    margin-bottom: 12rpx;

    .meta-hint {
      color: #bbb;
      font-size: 24rpx;
    }
  }

  .provider-desc {
    font-size: 26rpx;
    color: #666;
    line-height: 1.5;
  }
}

.type-tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.type-tab {
  padding: 16rpx 28rpx;
  font-size: 28rpx;
  color: #666;
  background: #fff;
  border: 1rpx solid #eee;
  border-radius: 32rpx;

  &.active {
    color: #1888ee;
    background: rgba(24, 136, 238, 0.08);
    border-color: rgba(24, 136, 238, 0.3);
    font-weight: 500;
  }
}

.model-list {
  height: calc(100vh - 320rpx);
}

.model-card {
  background: #fff;
  border: 1rpx solid #eee;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;

  .model-name {
    font-size: 30rpx;
    font-weight: 600;
    color: #171717;
  }

  .model-type-tag {
    font-size: 22rpx;
    padding: 6rpx 14rpx;
    border-radius: 8rpx;

    &.type-text {
      background: #e8f4fd;
      color: #1888ee;
    }

    &.type-image {
      background: #fde8f5;
      color: #c41e7a;
    }

    &.type-av {
      background: #e8f5e9;
      color: #2e7d32;
    }
  }
}

.card-price {
  font-size: 26rpx;
  color: #333;
  margin-bottom: 12rpx;

  .price-label {
    color: #999;
    margin-right: 6rpx;
  }

  .price-value {
    color: #1888ee;
    font-weight: 500;
  }

  .price-divider {
    margin: 0 12rpx;
    color: #ddd;
  }

  .price-extra {
    font-size: 22rpx;
    color: #999;
    margin-left: 8rpx;
  }
}

.card-desc {
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
  margin-bottom: 12rpx;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 8rpx;

  .tag-item {
    font-size: 22rpx;
    color: #888;
    background: #f0f0f0;
    padding: 6rpx 12rpx;
    border-radius: 6rpx;
  }
}

.card-footer {
  .pay-mode {
    font-size: 22rpx;
    color: #999;
  }
}

.empty-wrap {
  text-align: center;
  padding: 60rpx 24rpx;
}

.empty-tip {
  color: #999;
  font-size: 28rpx;
}
</style>
