<template>
  <view class="recent-agents-container">
    <view class="recent-header">
      <text class="recent-title">最近使用</text>
    </view>
    <scroll-view class="recent-scroll" scroll-x="true" show-scrollbar="false">
      <view class="recent-list">
        <view 
          class="recent-item" 
          v-for="(agent, index) in recentAgents" 
          :key="index"
          @click="navigateTo(agent, index)"
          style="border-radius: 25rpx"
        >
          <image 
            class="agent-avatar" 
            :src="agent.agentAvatar || defaultAvatar" 
            mode="aspectFill"
          ></image>
          <text class="agent-name">{{ agent.agentName }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  recentAgents: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['agent-click'])

const defaultAvatar = ref('/static/images/agent-avatar.png')

const onAgentClick = (agent) => {
  emit('agent-click', agent)
}

const navigateTo = (item, idx) => {
  const userInfodata = uni.getStorageSync("data");
  if (!userInfodata) {
    uni.showToast({
      title: '请先登录',
      icon: 'none'
    });
    return;
  }
  if(item.type == 3 || item.type == 5){
    return;
  }

  let targetUrl = '/pages/tools/ai_assistant';
  if (item.source === 'n8n') {
    targetUrl = '/pages/tools/ai_assistant_n8n';
  }

  uni.navigateTo({
    url: targetUrl + '?' + '&modelNamea=' + item.agentName + '&pitcha=' + idx + '&agentId=' + item.agentId + '&type=' + item.type
  });
}
</script>

<style lang="scss" scoped>
.recent-agents-container {
  padding: 0;
  background: #fff;
}

.recent-header {
  padding: 0 20rpx 20rpx;
}

.recent-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  font-family: AlimamaFangYuanTi !important;
}

.recent-scroll {
  width: 100%;
  white-space: nowrap;
}

.recent-list {
  display: flex;
  flex-direction: row;
  padding: 0 10rpx;
}

.recent-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 10rpx;
  min-width: 120rpx;
  padding: 20rpx 10rpx;
  border-radius: 16rpx;
  background: #f8f9fa;
  transition: all 0.3s ease;
  
  &:active {
    transform: scale(0.95);
    background: #e9ecef;
  }
}

.agent-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 10rpx;
  margin-bottom: 12rpx;
  background: #ddd;
}

.agent-name {
  font-size: 24rpx;
  color: #666;
  text-align: center;
  max-width: 100rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: AlimamaFangYuanTi !important;
}
</style>
