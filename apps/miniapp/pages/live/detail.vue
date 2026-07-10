<template>
  <view class="page" v-if="live">
    <!-- 播放区 -->
    <view class="player">
      <video
        v-if="live.playUrl"
        class="video"
        :src="live.playUrl"
        :autoplay="true"
        :controls="true"
        object-fit="contain"
      />
      <view v-else class="player-cover">
        <image class="cover" :src="live.coverUrl" mode="aspectFill" />
        <view class="living-mask" v-if="live.status === 'living'">
          <view class="living-btn" @tap="enterLive"><text>进入直播</text></view>
        </view>
        <view class="ended-tip" v-else-if="live.status === 'ended'">
          <text>直播已结束</text>
        </view>
        <view class="upcoming-tip" v-else>
          <text>直播未开始</text>
          <text class="time" v-if="live.startTime">{{ live.startTime }}</text>
        </view>
      </view>
    </view>

    <!-- 直播信息 -->
    <view class="info">
      <text class="title">{{ live.title }}</text>
      <view class="meta">
        <text class="anchor" v-if="live.anchor">主播：{{ live.anchor }}</text>
        <text class="watch" v-if="live.watchCount !== undefined">{{ live.watchCount }}人观看</text>
      </view>
    </view>
  </view>

  <view class="loading-page" v-else><text>加载中...</text></view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getLiveDetail, type Live } from '@/api'

const live = ref<Live | null>(null)
const liveId = ref<string | number>('')

onLoad((options) => {
  liveId.value = options?.id || ''
  loadDetail()
})

async function loadDetail() {
  try {
    live.value = await getLiveDetail(liveId.value)
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function enterLive() {
  uni.showToast({ title: '正在连接直播间...', icon: 'loading' })
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; }

.player { width: 100%; height: 420rpx; background: #000; }
.video { width: 100%; height: 100%; }
.player-cover { position: relative; width: 100%; height: 100%; }
.cover { width: 100%; height: 100%; opacity: 0.6; }

.living-mask { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.living-btn { padding: 20rpx 56rpx; background: #dd524d; color: #fff; border-radius: 40rpx; font-size: 30rpx; }

.ended-tip, .upcoming-tip { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-size: 30rpx; }
.upcoming-tip .time { margin-top: 16rpx; font-size: 26rpx; opacity: 0.8; }

.info { padding: 24rpx 32rpx; }
.title { font-size: 34rpx; color: #333; font-weight: 600; }
.meta { display: flex; justify-content: space-between; margin-top: 16rpx; }
.anchor { font-size: 26rpx; color: #007aff; }
.watch { font-size: 26rpx; color: #999; }

.loading-page { display: flex; align-items: center; justify-content: center; height: 100vh; color: #999; }
</style>
