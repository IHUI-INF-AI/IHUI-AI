<template>
  <view class="page">
    <view class="chat-area">
      <view class="msg" v-for="(m, i) in messages" :key="i" :class="m.role">
        <text class="msg-text">{{ m.content }}</text>
      </view>
      <view class="msg assistant" v-if="loading">
        <text class="msg-text">正在思考...</text>
      </view>
    </view>
    <view class="input-bar">
      <view class="voice-btn" :class="{ recording }" @tap="onVoice">
        <text>{{ recording ? '松开发送' : '🎤 按住说话' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { voiceChat, type ChatMessage } from '@/api'

const messages = ref<ChatMessage[]>([
  { role: 'assistant', content: '您好，我是AI语音助手，按住下方按钮开始对话' }
])
const recording = ref(false)
const loading = ref(false)

function onVoice() {
  if (recording.value) {
    // 停止录音并发送
    recording.value = false
    loading.value = true
    messages.value.push({ role: 'user', content: '[语音消息]' })
    // 实际应上传录音文件后调用接口
    voiceChat({ audio: 'demo' })
      .then(res => {
        messages.value.push({ role: 'assistant', content: res.reply })
      })
      .catch(() => {})
      .finally(() => { loading.value = false })
  } else {
    recording.value = true
    uni.showToast({ title: '开始录音', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; display: flex; flex-direction: column; }
.chat-area { flex: 1; padding: 24rpx; overflow-y: auto; }
.msg { display: flex; margin-bottom: 24rpx; }
.msg.user { justify-content: flex-end; }
.msg-text { max-width: 70%; padding: 20rpx 24rpx; border-radius: 16rpx; font-size: 28rpx; line-height: 1.6; }
.msg.assistant .msg-text { background: #fff; color: #333; }
.msg.user .msg-text { background: #007aff; color: #fff; }
.input-bar { padding: 24rpx 32rpx; background: #fff; border-top: 2rpx solid #f5f5f5; }
.voice-btn { height: 100rpx; line-height: 100rpx; text-align: center; background: #f7f8fa; border-radius: 50rpx; font-size: 28rpx; color: #333; }
.voice-btn.recording { background: #dd524d; color: #fff; }
</style>
