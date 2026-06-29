<template>
  <view class="agent-dialogue-container">
    <!-- 固定在顶部的欢迎信息 -->
    <view class="fixed-top-section">
      <!-- Welcome message with robot image -->
      <view class="welcome-message">
        <view class="message-content">
          <text class="welcome-text">Hi, 我是您的智能助手小智</text>
          <text class="welcome-subtitle">快来跟我聊天吧</text>
        </view>
        <image class="robot-image" src="/static/images/robot.png" mode="aspectFit"></image>
      </view>

      <!-- Usage info -->
      <view class="usage-info">
        <image class="usage-icon" src="/static/images/usage-icon.png" mode="aspectFit"></image>
        <text class="usage-text">当前还可免费使用4次</text>
        <text class="usage-text">如需继续使用请充值token值</text>
        <view class="token-button">
          <text>购买token值</text>
        </view>
      </view>
    </view>

    <!-- 可滚动的对话内容 -->
    <scroll-view 
      class="dialogue-content" 
      scroll-y 
      :scroll-into-view="scrollToView"
      @scrolltoupper="loadMoreMessages"
      upper-threshold="50"
      :scroll-top="scrollTop"
    >
      <!-- Message list -->
      <view class="message-list">
        <block v-for="(msg, index) in messages" :key="index">
          <!-- AI messages -->
          <view class="message ai-message" v-if="msg.type === 'ai'" :id="`msg-${index}`">
            <image class="avatar" src="/static/images/robot-small.png" mode="aspectFit"></image>
            <view class="message-bubble">
              <text>{{ msg.content }}</text>
            </view>
          </view>
          
          <!-- User messages -->
          <view class="message user-message" v-else :id="`msg-${index}`">
            <image class="avatar user-avatar" :src="userAvatar" mode="aspectFill"></image>

            <view class="message-bubble">
              <text>{{ msg.content }}</text>
            </view>
          </view>
        </block>
      </view>
    </scroll-view>

    <!-- Input area -->
    <view class="input-area">
      <view class="input-tools">
        <text class="iconfont icon-keyboard"></text>
        <text class="iconfont icon-mic"></text>
      </view>
      <view class="input-box">
        <input 
          class="input" 
          type="text" 
          v-model="inputMessage" 
          placeholder="有什么问题直接问我"
          confirm-type="send"
          @confirm="sendMessage"
        />
      </view>
      <view class="send-button" @tap="sendMessage">
        <text class="iconfont icon-arrow-right"></text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { onMounted } from 'vue'

const inputMessage = ref('')
const scrollToView = ref('')
const scrollTop = ref(0)
const userAvatar = ref('/static/images/user-avatar.png')
const messages = ref([
  {
    type: 'ai',
    content: '你好，我是您的智能机器人，很高兴为您服务，有什么问题都可以问我！'
  },
  {
    type: 'user',
    content: '写一个恐怖故事'
  },
  {
    type: 'ai',
    content: '从前有座山，山里有个庙'
  }
])

function goBack() {
  uni.navigateBack();
}

function sendMessage() {
  if (!inputMessage.value.trim()) return;
  
  messages.value.push({
    type: 'user',
    content: inputMessage.value
  });
  
  const userInput = inputMessage.value;
  inputMessage.value = '';
  
  nextTick(() => {
    scrollToBottom();
  });
  
  setTimeout(() => {
    messages.value.push({
      type: 'ai',
      content: '我正在思考您的问题，请稍等...'
    });
    scrollToBottom();
  }, 500);
}

function scrollToBottom() {
  const lastIndex = messages.value.length - 1;
  if (lastIndex >= 0) {
    scrollToView.value = `msg-${lastIndex}`;
  }
}

function loadMoreMessages() {
}

onMounted(() => {
  nextTick(() => {
    scrollToBottom();
  });
});
</script>

<style lang="scss" scoped>
.agent-dialogue-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f7fa;
}

.fixed-top-section {
  background-color: #f5f7fa;
  padding: 10px 16px;
  z-index: 10;
}

.dialogue-content {
  flex: 1;
  overflow: hidden;
  padding: 10px 16px;
}

.welcome-message {
  display: flex;
  background-color: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 15px;
  
  .message-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .welcome-text {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin-bottom: 8px;
  }
  
  .welcome-subtitle {
    font-size: 14px;
    color: #666;
  }
  
  .robot-image {
    width: 60px;
    height: 60px;
  }
}

.usage-info {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 15px;
  
  .usage-icon {
    width: 30px;
    height: 30px;
    margin-right: 10px;
  }
  
  .usage-text {
    font-size: 14px;
    color: #666;
    margin-right: 5px;
  }
  
  .token-button {
    margin-left: auto;
    background-color: #ecf5ff;
    color: #4080ff;
    font-size: 14px;
    padding: 5px 10px;
    border-radius: 15px;
  }
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding-bottom: 10px;
}

.message {
  display: flex;
  margin-bottom: 15px;
  
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
  
  .message-bubble {
    max-width: 70%;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.4;
  }
}

.ai-message {
  align-self: flex-start;
  
  .message-bubble {
    margin-left: 10px;
    background-color: #fff;
    color: #333;
  }
}

.user-message {
  align-self: flex-end;
  flex-direction: row-reverse;
  
  .message-bubble {
    margin-right: 10px;
    background-color: #4080ff;
    color: #fff;
  }
  
  .user-avatar {
    background-color: #f0f0f0;
  }
}

.input-area {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background-color: #fff;
  border-top: 1px solid #eaeaea;
  
  .input-tools {
    display: flex;
    gap: 15px;
    margin-right: 10px;
    
    .iconfont {
      font-size: 24px;
      color: #999;
    }
  }
  
  .input-box {
    flex: 1;
    background-color: #f5f7fa;
    border-radius: 20px;
    padding: 8px 12px;
    
    .input {
      width: 100%;
      height: 24px;
      font-size: 14px;
    }
  }
  
  .send-button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #4080ff;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 10px;
    
    .iconfont {
      font-size: 20px;
    }
  }
}
</style>
