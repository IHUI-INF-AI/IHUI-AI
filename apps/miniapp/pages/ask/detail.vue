<template>
  <view class="page">
    <view class="head" v-if="data.title">
      <text class="title">{{ data.title }}</text>
      <view class="meta">
        <image class="avatar" :src="data.avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <text class="author">{{ data.author }}</text>
        <text class="time">{{ data.createTime }}</text>
      </view>
      <view class="content">{{ data.content }}</view>
    </view>
    <view class="answers" v-if="answers.length">
      <view class="answers-title">{{ answers.length }}个回答</view>
      <view class="answer" v-for="(a, i) in answers" :key="i">
        <view class="a-head">
          <image class="avatar" :src="a.avatar || '/static/default-avatar.png'" mode="aspectFill" />
          <text class="a-author">{{ a.author }}</text>
          <text class="a-time">{{ a.time }}</text>
        </view>
        <view class="a-content">{{ a.content }}</view>
      </view>
    </view>
    <view class="footer">
      <input class="input" v-model="answer" placeholder="写下你的回答" />
      <button class="btn" size="mini" @tap="onAnswer" :disabled="!answer">回答</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getAskDetail, type Ask } from '@/api'

const data = ref<Ask>({} as Ask)
const answers = ref<Array<{ author: string; avatar?: string; time: string; content: string }>>([])
const answer = ref('')

onLoad(async (q: any) => {
  if (!q.id) return
  try { data.value = await getAskDetail(q.id) } catch (e) {}
})
function onAnswer() {
  if (!answer.value) return
  answers.value.push({ author: '我', time: '刚刚', content: answer.value })
  answer.value = ''
  uni.showToast({ title: '回答成功', icon: 'success' })
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.head { background: #fff; padding: 32rpx; margin-bottom: 24rpx; }
.title { font-size: 36rpx; color: #333; font-weight: 700; line-height: 1.4; }
.meta { display: flex; align-items: center; margin-top: 24rpx; }
.avatar { width: 50rpx; height: 50rpx; border-radius: 50%; background: #f5f5f5; }
.author { margin-left: 16rpx; font-size: 24rpx; color: #666; }
.time { margin-left: auto; font-size: 22rpx; color: #999; }
.content { margin-top: 24rpx; font-size: 28rpx; color: #333; line-height: 1.8; }
.answers { background: #fff; padding: 32rpx; }
.answers-title { font-size: 28rpx; color: #333; font-weight: 600; margin-bottom: 24rpx; }
.answer { padding: 24rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.a-head { display: flex; align-items: center; }
.a-author { margin-left: 16rpx; font-size: 24rpx; color: #666; }
.a-time { margin-left: auto; font-size: 22rpx; color: #999; }
.a-content { margin-top: 16rpx; font-size: 28rpx; color: #333; line-height: 1.6; }
.footer { position: fixed; bottom: 0; left: 0; right: 0; display: flex; align-items: center; padding: 16rpx 24rpx; background: #fff; border-top: 2rpx solid #f5f5f5; }
.input { flex: 1; height: 72rpx; padding: 0 24rpx; background: #f7f8fa; border-radius: 36rpx; font-size: 26rpx; }
.btn { margin-left: 16rpx; background: #007aff; color: #fff; font-size: 24rpx; }
.btn[disabled] { background: #ccc; }
</style>
