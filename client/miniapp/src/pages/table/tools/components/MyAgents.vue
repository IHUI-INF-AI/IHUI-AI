<template>
  <view class="my-agents-container">
    <view class="my-header">
      <text class="my-title">我的AI APP</text>
      <view class="team-button" @click="goToTeam">
        <text class="team-button-text">我的AI员工</text>
        <image class="icon_right" mode="widthFix" src="/static/images/study_icon_right.png" />
      </view>
    </view>
    <scroll-view class="my-scroll" scroll-x="true" show-scrollbar="false">
      <view class="my-list">
        <view 
          class="my-item" 
          v-for="(agent, index) in myAgents" 
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
        <view v-if="myAgents.length === 0" class="empty-item">
          <text class="empty-text">暂无智能体</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  myAgents: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['agent-click'])

const defaultAvatar = ref('/static/images/agent-avatar.png')

const onAgentClick = (agent) => {
  emit('agent-click', agent)
}

const goToTeam = () => {
  uni.navigateTo({
    url: '/pages/tools/ai_group/index'
  })
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
.my-agents-container {
  padding: 0;
  background: #fff;
  margin-bottom: 0;
}

.my-header {
  padding: 0 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.my-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  font-family: AlimamaFangYuanTi !important;
}

.team-button {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: #666;
  padding: 8rpx 0;
  background: transparent;
  font-family: AlimamaFangYuanTi !important;
  
  &:active {
    opacity: 0.7;
  }
}

.team-button-text {
  font-size: 28rpx;
  color: #666;
  margin-right: 8rpx;
}

.icon_right {
  width: 24rpx;
  height: 24rpx;
  margin-bottom: -4rpx;
}

.my-scroll {
  width: 100%;
  white-space: nowrap;
}

.my-list {
  display: flex;
  flex-direction: row;
  padding: 0 10rpx;
}

.my-item {
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

.empty-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx 20rpx;
  min-width: 200rpx;
}

.empty-text {
  font-size: 24rpx;
  color: #999;
  font-family: AlimamaFangYuanTi !important;
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
