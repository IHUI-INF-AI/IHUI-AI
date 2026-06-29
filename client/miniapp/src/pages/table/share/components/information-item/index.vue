<template>
  <view v-if="informationLists.length > 0" class="timeline-container">
    <view v-for="(item, index) in informationLists" :key="item.id">
      <!-- 日期 -->
      <view class="timeline-date">
        <text class="timeline-dot"></text>
        {{ item.date }}
      </view>
      <!-- 时间轴内容 -->
      <view class="timeline-list">
        <view v-for="(items, idx) in item.list" :key="idx" class="timeline-item">
          <!-- 左侧竖线和圆点 -->
          <view class="timeline-left">
            <view class="timeline-vertical"></view>
            <view class="timeline-circle"></view>
          </view>
          <!-- 右侧内容 -->
          <view class="timeline-contenta">
            <view :id="'content-' + idx" @ready="measureHeight(idx)" class="timeline-content">
              <view class="timeline-item-title" v-html="items.title"></view>
              <view class="timeline-item-desc" v-html="items.content"></view>
              <view class="timeline-item-desc" style="display: flex;align-items: center;">
                <view>{{items.sourceName === 'Not_Support' ? '来源:网络' : `来源:${items.sourceName?items.sourceName:'网络'}`}}</view>
                <view class="copy_body" :class=" isClick ? 'copy_body_active' : '' " @click.stop="copyHandle(items.title,items.content,idx,index)">
                  <image class="agent-content-item-img" src="/static/images/copy.png" mode="widthFix" style="width: 36rpx;height: 36rpx;display: block;margin-bottom: -2rpx;margin-left:10rpx;"></image>
                </view>
                <view style="display: inline-block;position: relative;margin-left: 20rpx;margin-bottom: -2rpx;">
                  <button open-type="share" style="opacity: 0;position: relative;z-index: 1;width: 36rpx;height: 36rpx;">分享</button>
                  <image class="agent-content-item-img" src="/static/images/agentshare.png" mode="widthFix" style="width: 36rpx;height: 36rpx;display: inline-block;position: absolute;left: 0;top: -2rpx;"></image>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
    <!-- 没有更多了 -->
    <view v-if="noMore">
      <view
        style="width: 100%;padding-bottom: 10rpx;text-align: center;display: flex;justify-content: center;align-items: flex-end;">
        <image style="text-align: center;width:348rpx;" src="/static/images/yejiao.png"
          mode="widthFix" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'

const props = defineProps({
  informationLists: {
    type: Array,
    default() {
      return []
    }
  },
  noMore: {
    type: Boolean,
    default: false
  }
})

const newsList = ref([])
const contentHeight = ref([])
const isClick = ref(false)

watch(() => props.informationLists, (newVal) => {
  if (newVal !== props.informationLists) {
    nextTick(() => {
      newsList.value = [...newVal]
    })
  }
}, { deep: true })

function copyHandle(title, content, idx, index) {
  nextTick(() => {
    uni.setClipboardData({
      data: props.informationLists[index].list[idx].title + '\n' + props.informationLists[index].list[idx].content,
      success: () => {
        uni.showToast({
          title: '复制成功',
          icon: 'success'
        })
      }
    })
  })
}

function share() {
  uni.share({
    title: 'AI智汇社',
    path: `/pages/table/share/index?source=share`,
    success: function (res) {
      uni.showToast({
        title: '分享成功',
        icon: 'success'
      })
    },
    fail: function (res) {
      uni.showToast({
        title: '分享失败',
        icon: 'none'
      })
    }
  })
}

function measureHeight(index) {
  const query = uni.createSelectorQuery()
  query.select(`#content-${index}`).boundingClientRect().exec()
}

function formatWithTimezone(timestamp, timezoneOffset = 8) {
  if (!timestamp) return "N/A"
  const date = new Date(Number(timestamp))
  const targetTime = new Date(
    date.getTime() +
      timezoneOffset * 3600000 -
      date.getTimezoneOffset() * 60000
  )
  return targetTime.toISOString().replace("T", " ").substring(0, 19).replace(/-/g, "/")
}
</script>

<style scoped>
.copy_body {
  width: 50rpx;
  display: flex;
  justify-content: center;
}

.timeline-container {
  height: 100%;
}

.timeline-title {
  font-size: 44rpx;
  font-weight: bold;
  color: #111;
  text-align: center;
  margin-top: 24rpx;
  margin-bottom: 18rpx;
}

.timeline-title-image {
  max-width: 215rpx;
  height: auto;
}

.timeline-date {
  display: flex;
  align-items: center;
  color: #a48cf0;
  font-size: 26rpx;
  margin-bottom: 18rpx;
  font-weight: 500;
}

.timeline-dot {
  display: inline-block;
  width: 16rpx;
  height: 16rpx;
  background: #a48cf0;
  border-radius: 50%;
  margin-right: 12rpx;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  position: relative;
  min-height: 60rpx;
}

.timeline-left {
  width: 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.timeline-vertical {
  position: absolute;
  left: 17rpx;
  width: 2rpx;
  height: calc(100% - 16rpx);
  height: 100%;
  border-left: 2rpx dashed #a48cf0;
  z-index: 0;
}

.timeline-vertical.last {
  display: none;
}

.timeline-circle {
  width: 16rpx;
  height: 16rpx;
  background: #a48cf0;
  border-radius: 50%;
  margin-top: 8rpx;
  margin-bottom: 8rpx;
  z-index: 1;
  position: relative;
}

.timeline-content {
  padding-left: 0;
  background: rgb(248 249 252 / 0.65);
  border-radius: 20rpx;
  padding: 10rpx;
}

.timeline-contenta{
  flex: 1;
  border-radius: 20rpx;
  margin-top: -15rpx;
  margin-bottom: 25rpx;
  background: #f3f3f3;
  padding: 0;
}

.timeline-item-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #222;
  margin-bottom: 8rpx;
  line-height: 1.5;
  background: #fff;
  border-radius: 20rpx;
  padding: 0 10rpx;
}

.bold-black {
  color: #4b99fe;
  font-weight: bold;
}

.timeline-item-desc {
  font-size: 25rpx;
  color: #444;
  line-height: 1.7;
  word-break: break-all;
}

.source {
  color: #a48cf0;
  font-size: 24rpx;
  margin-left: 8rpx;
}

.no-more-text {
  margin: 0 20rpx;
  color: #767676;
  font-size: 24rpx;
}

.no-more-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 40rpx 0 0rpx;
}

.line {
  flex: 1;
  height: 1rpx;
  background-color: #e0e0e0;
}

.no-more-text {
  margin: 0 20rpx;
  color: #767676;
  font-size: 24rpx;
}

.website-container {
  text-align: center;
}

.website-text {
  font-size: 28rpx;
  color: rgb(89 97 255 / 0.55);
  font-weight: 700;
}

.copyright-container {
  padding: 10rpx 0;
  text-align: center;
  color: rgb(0 0 0 / 0.4);
  line-height: 18rpx;
  font-size: 20rpx;
}

.copyright-text {
  display: block;
  font-size: 20rpx;
  color: rgb(0 0 0 / 0.4);
  line-height: 1.5;
  font-family: "Lilita One";
}
</style>
