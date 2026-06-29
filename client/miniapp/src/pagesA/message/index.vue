<template>
  <view class="message-list-container">
    <!-- 导航栏 -->
    <navigation-bars 
      title="消息" 
      :viscosity="true" 
      :showBack="true"
      image="/static/images/back.svg"
      backgroundColor="#fff"
      :rightIcons="rightIcons"
      @right-icon-click="handleRightIconClick"
    />

    <scroll-view class="message-list" scroll-y>
      <!-- 通知横幅 -->
      <view class="notification-banner" v-if="showNotificationBanner">
        <text class="banner-text">开启消息通知,不错过交易进度</text>
        <view class="banner-actions">
          <view class="enable-btn" @click="enableNotification">去开启</view>
          <view class="close-btn" @click="closeBanner">×</view>
        </view>
      </view>

      <!-- 搜索栏 -->
      <view class="search-bar">
        <image class="search-icon" src="/static/images/search.svg" mode="aspectFit" />
        <input 
          class="search-input" 
          type="text" 
          v-model="searchKeyword"
          placeholder="搜索聊天记录/联系人/服务号"
          placeholder-style="color: #999; font-size: 28rpx;"
          @input="handleSearchInput"
          @focus="handleSearchFocus"
          @blur="handleSearchBlur"
          confirm-type="search"
          @confirm="handleSearchConfirm"
        />
        <view class="search-clear" v-if="searchKeyword" @click="clearSearch">
          <text>×</text>
        </view>
      </view>

      <!-- 聊天列表 -->
      <view v-if="!isSearching" class="chat-list">
        <view 
          class="chat-item" 
          v-for="(item, index) in chatList" 
          :key="index"
          @click="handleChatClick(item)"
        >
          <view class="chat-avatar">
            <image :src="item.avatar" mode="aspectFill" />
            <view class="unread-badge" v-if="item.unreadCount > 0">
              <text>{{ item.unreadCount > 99 ? '99+' : item.unreadCount }}</text>
            </view>
          </view>
          <view class="chat-content">
            <view class="chat-header">
              <view class="chat-name">{{ item.name }}</view>
              <text class="chat-time">{{ item.time }}</text>
            </view>
            <view class="chat-preview">{{ item.lastMessage }}</view>
          </view>
        </view>

        <view v-if="chatList.length === 0" class="empty-state">
          <text>暂无消息</text>
        </view>
      </view>

      <!-- 搜索结果 -->
      <view v-if="isSearching && searchKeyword" class="search-results">
        <view v-if="searchResults.length > 0" class="search-result-section">
          <view class="result-section-title">搜索结果</view>
          <view class="chat-list">
            <view 
              class="chat-item" 
              v-for="(item, index) in searchResults" 
              :key="'search-' + index"
              @click="handleChatClick(item)"
            >
              <view class="chat-avatar">
                <image :src="item.avatar" mode="aspectFill" />
              </view>
              <view class="chat-content">
                <view class="chat-header">
                  <view class="chat-name">{{ item.name }}</view>
                  <text class="chat-time">{{ item.time }}</text>
                </view>
                <view class="chat-preview">{{ item.lastMessage }}</view>
              </view>
            </view>
          </view>
        </view>

        <view v-else class="empty-state">
          <text>未找到相关结果</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import NavigationBars from '@/components/navigation-bars/index.vue'
import { getConversationList } from '@/service/message.js'

// 数据
const showNotificationBanner = ref(true)
const searchKeyword = ref('')
const isSearching = ref(false)
const chatList = ref<any[]>([])
const searchResults = ref<any[]>([])

// 右侧图标
const rightIcons = ref([
  { icon: '/static/images/add.png', action: 'add' },
])

onMounted(() => {
  loadChatList()
})

// 加载聊天列表
async function loadChatList() {
  try {
    const res = await getConversationList()
    if (res && (res.code === 0 || res.code === 200 || res.code === undefined)) {
      const list = Array.isArray(res.data) ? res.data : (res.data && res.data.list) || []
      chatList.value = list.map((item: any) => ({
        id: item.id,
        name: item.name || item.nickname || '',
        avatar: item.avatar || '',
        lastMessage: item.lastMessage || item.last_message || item.content || '',
        time: item.time || '',
        unreadCount: item.unreadCount || item.unread_count || 0,
      }))
    }
  } catch (error) {
    console.error('加载聊天列表失败:', error)
    uni.showToast({ title: '加载聊天列表失败', icon: 'none' })
  }
}

// 搜索输入
function handleSearchInput() {
  if (searchKeyword.value) {
    isSearching.value = true
    searchResults.value = chatList.value.filter(item => 
      item.name.includes(searchKeyword.value) || 
      item.lastMessage.includes(searchKeyword.value)
    )
  } else {
    isSearching.value = false
    searchResults.value = []
  }
}

// 搜索聚焦
function handleSearchFocus() {
  isSearching.value = true
}

// 搜索失焦
function handleSearchBlur() {
  if (!searchKeyword.value) {
    isSearching.value = false
  }
}

// 搜索确认
function handleSearchConfirm() {
  // 搜索确认
}

// 清除搜索
function clearSearch() {
  searchKeyword.value = ''
  isSearching.value = false
  searchResults.value = []
}

// 点击聊天
function handleChatClick(item: any) {
  uni.navigateTo({
    url: `/pagesA/message/chat?id=${item.id}&name=${item.name}`,
  })
}

// 右侧图标点击
function handleRightIconClick(action: string) {
  if (action === 'add') {
    // 打开添加好友/群聊
    uni.showToast({ title: '添加功能开发中', icon: 'none' })
  }
}

// 开启通知
function enableNotification() {
  uni.openSetting({
    success: (res) => {
      console.log('设置页面:', res)
    },
  })
}

// 关闭横幅
function closeBanner() {
  showNotificationBanner.value = false
}
</script>

<style lang="scss" scoped>
.message-list-container {
  min-height: 100vh;
  background: #fff;
}

.message-list {
  height: calc(100vh - 100rpx);
}

.notification-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  background: #fff3cd;
  border-bottom: 1rpx solid #ffeeba;
}

.banner-text {
  font-size: 24rpx;
  color: #856404;
}

.banner-actions {
  display: flex;
  align-items: center;
}

.enable-btn {
  font-size: 24rpx;
  color: #007aff;
  margin-right: 16rpx;
}

.close-btn {
  font-size: 32rpx;
  color: #999;
}

.search-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background: #f5f5f5;
  margin: 16rpx 24rpx;
  border-radius: 32rpx;
}

.search-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.search-clear {
  width: 32rpx;
  height: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ccc;
  border-radius: 50%;
  margin-left: 12rpx;

  text {
    font-size: 24rpx;
    color: #fff;
  }
}

.chat-list {
  padding: 0 24rpx;
}

.chat-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.chat-avatar {
  position: relative;
  width: 96rpx;
  height: 96rpx;
  margin-right: 20rpx;

  image {
    width: 100%;
    height: 100%;
    border-radius: 16rpx;
  }

  .unread-badge {
    position: absolute;
    top: -8rpx;
    right: -8rpx;
    min-width: 32rpx;
    height: 32rpx;
    background: #ff3b30;
    border-radius: 16rpx;
    padding: 0 8rpx;
    display: flex;
    align-items: center;
    justify-content: center;

    text {
      font-size: 20rpx;
      color: #fff;
    }
  }
}

.chat-content {
  flex: 1;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.chat-name {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.chat-time {
  font-size: 24rpx;
  color: #999;
}

.chat-preview {
  font-size: 26rpx;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 120rpx 0;
  color: #999;
  font-size: 28rpx;
}

.search-results {
  padding: 0 24rpx;
}

.result-section-title {
  font-size: 26rpx;
  color: #999;
  padding: 16rpx 0;
}
</style>
