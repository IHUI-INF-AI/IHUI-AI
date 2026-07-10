<template>
  <view class="page">
    <!-- 顶部标题栏 -->
    <view class="nav-bar safe-area-bottom">
      <text class="nav-title">AI 对话</text>
      <text class="nav-clear" v-if="messages.length" @tap="clearChat">清空</text>
    </view>

    <!-- 消息列表 -->
    <scroll-view class="msg-list" scroll-y :scroll-top="scrollTop" :scroll-with-animation="true">
      <view class="welcome" v-if="!messages.length">
        <text class="welcome-title">你好，我是智汇AI助手</text>
        <text class="welcome-desc">有什么问题请尽管问我</text>
        <view class="suggest-list">
          <view class="suggest-item" v-for="(s, i) in suggestions" :key="i" @tap="useSuggestion(s)">
            <text>{{ s }}</text>
          </view>
        </view>
      </view>

      <view class="msg-item" v-for="(msg, idx) in messages" :key="idx" :class="msg.role">
        <view class="avatar" :class="msg.role">{{ msg.role === 'user' ? '我' : 'AI' }}</view>
        <view class="bubble">
          <text class="bubble-text">{{ msg.content }}</text>
        </view>
      </view>

      <view class="msg-item assistant" v-if="thinking">
        <view class="avatar assistant">AI</view>
        <view class="bubble"><text class="bubble-text">思考中...</text></view>
      </view>
    </scroll-view>

    <!-- 输入栏 -->
    <view class="input-bar safe-area-bottom">
      <input
        class="input"
        type="text"
        v-model="inputText"
        placeholder="请输入问题"
        confirm-type="send"
        @confirm="sendMessage"
        :adjust-position="true"
      />
      <view class="send-btn" :class="{ disabled: !inputText.trim() || thinking }" @tap="sendMessage">
        <text>发送</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { chat, type ChatMessage } from '@/api'

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const thinking = ref(false)
const scrollTop = ref(0)
const sessionId = ref('')

const suggestions = [
  '帮我写一段课程推广文案',
  '如何提升学习效率？',
  '推荐几本人工智能入门书',
  '解释一下什么是大模型',
]

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || thinking.value) return

  messages.value.push({ role: 'user', content: text, timestamp: Date.now() })
  inputText.value = ''
  thinking.value = true
  await scrollToBottom()

  try {
    const res = await chat(messages.value, sessionId.value)
    sessionId.value = res.sessionId
    messages.value.push({ role: 'assistant', content: res.reply, timestamp: Date.now() })
  } catch (e) {
    messages.value.push({
      role: 'assistant',
      content: '抱歉，服务暂时不可用，请稍后再试。',
      timestamp: Date.now(),
    })
  } finally {
    thinking.value = false
    await scrollToBottom()
  }
}

function useSuggestion(text: string) {
  inputText.value = text
  sendMessage()
}

function clearChat() {
  uni.showModal({
    title: '提示',
    content: '确定清空对话记录吗？',
    success: (res) => {
      if (res.confirm) {
        messages.value = []
        sessionId.value = ''
      }
    },
  })
}

async function scrollToBottom() {
  await nextTick()
  scrollTop.value = scrollTop.value === 99998 ? 99999 : 99998
}
</script>

<style lang="scss" scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: #f7f8fa; }

.nav-bar { display: flex; align-items: center; justify-content: space-between; padding: 120rpx 32rpx 24rpx; background: #fff; }
.nav-title { font-size: 34rpx; font-weight: 600; color: #333; }
.nav-clear { font-size: 26rpx; color: #999; }

.msg-list { flex: 1; padding: 24rpx 32rpx; }

.welcome { text-align: center; padding: 80rpx 0; }
.welcome-title { display: block; font-size: 36rpx; color: #333; font-weight: 600; }
.welcome-desc { display: block; margin-top: 16rpx; font-size: 26rpx; color: #999; }
.suggest-list { margin-top: 48rpx; }
.suggest-item { display: inline-block; margin: 12rpx; padding: 16rpx 28rpx; background: #fff; border-radius: 32rpx; font-size: 26rpx; color: #007aff; }

.msg-item { display: flex; margin-bottom: 32rpx; align-items: flex-start; }
.msg-item.user { flex-direction: row-reverse; }
.avatar { width: 72rpx; height: 72rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24rpx; color: #fff; flex-shrink: 0; }
.avatar.user { background: #007aff; }
.avatar.assistant { background: #4cd964; }

.bubble { max-width: 70%; margin: 0 20rpx; padding: 20rpx 24rpx; border-radius: 16rpx; }
.msg-item.user .bubble { background: #007aff; }
.msg-item.assistant .bubble { background: #fff; }
.bubble-text { font-size: 28rpx; line-height: 1.6; }
.msg-item.user .bubble-text { color: #fff; }
.msg-item.assistant .bubble-text { color: #333; }

.input-bar { display: flex; align-items: center; padding: 16rpx 32rpx; background: #fff; border-top: 1rpx solid #eee; }
.input { flex: 1; height: 80rpx; padding: 0 24rpx; background: #f5f5f5; border-radius: 40rpx; font-size: 28rpx; }
.send-btn { margin-left: 16rpx; padding: 0 32rpx; height: 80rpx; line-height: 80rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 28rpx; }
.send-btn.disabled { opacity: 0.5; }
</style>
