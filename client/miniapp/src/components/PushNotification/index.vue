<template>
  <view class="push-notification" :class="{ 'push-show': visible, 'push-hide': !visible }" v-show="visible" :style="{ top: '10rpx', paddingTop: statusBarHeight }">
    <view class="push-content" @click="handleClick">
      <view class="push-header">
        <view class="push-icon">
          <text class="iconfont icon-bell">🔔</text>
        </view>
        <view class="push-info">
          <view class="push-title">{{ title }}</view>
          <view class="push-time">{{ formatTime }}</view>
        </view>
        <view class="push-close" @click.stop="handleClose">
          <text class="iconfont icon-close">✕</text>
        </view>
      </view>
      <view class="push-body">
        <text class="push-message">{{ content }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, getCurrentInstance, nextTick } from 'vue'

const { proxy } = getCurrentInstance()

const visible = ref(false)
const title = ref('')
const content = ref('')
const timestamp = ref(Date.now())
const autoCloseTimer = ref(null)
const clickCallback = ref(null)
const topOffset = ref(0)

const statusBarHeight = computed(() => {
  return proxy.$styleVariables["--app-status-bar-height"]
})

const topBarHeight = computed(() => {
  return proxy.$styleVariables["--app-top-bar-height"]
})

const formatTime = computed(() => {
  if (!timestamp.value) return ''
  const now = new Date()
  const time = new Date(timestamp.value)
  const diff = now - time
  
  if (diff < 60000) {
    return '刚刚'
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`
  } else {
    const month = time.getMonth() + 1
    const day = time.getDate()
    const hour = time.getHours()
    const minute = time.getMinutes()
    return `${month}-${day} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  }
})

function handleShowNotification(options) {
  console.log('🔔 PushNotification 收到全局事件 showPushNotification:', options)
  show(options)
}

function show(options = {}) {
  console.log('📢 PushNotification.show() 被调用，参数:', options)
  console.log('调用前 visible:', visible.value)
  
  title.value = options.title || '新消息'
  content.value = options.content || ''
  timestamp.value = options.timestamp || Date.now()
  clickCallback.value = options.onClick || null
  
  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value)
    autoCloseTimer.value = null
  }
  
  console.log('设置 visible = true（之前的值:', visible.value, ')')
  visible.value = true
  console.log('✅ visible 已设置为:', visible.value)
  
  // 强制更新视图
  nextTick(() => {
    console.log('$nextTick 后 visible 值:', visible.value)
  })
  
  // 自动关闭（默认5秒）
  const duration = options.duration || 5000
  if (duration > 0) {
    autoCloseTimer.value = setTimeout(() => {
      console.log('⏰ 自动关闭弹窗')
      hide()
    }, duration)
  }
}

function hide() {
  visible.value = false
  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value)
    autoCloseTimer.value = null
  }
}

function handleClick() {
  if (clickCallback.value && typeof clickCallback.value === 'function') {
    clickCallback.value()
  }
  hide()
}

function handleClose() {
  hide()
}

let showPushNotificationHandler = null

console.log('✅ PushNotification 组件 created')
showPushNotificationHandler = (options) => {
  console.log('🔔 收到全局事件 showPushNotification (created阶段监听):', options)
  console.log('当前 visible:', visible.value)
  handleShowNotification(options)
}
uni.$on('showPushNotification', showPushNotificationHandler)
console.log('✅ 已在 created 阶段监听全局事件 showPushNotification')

onMounted(() => {
  console.log('✅ PushNotification 组件已挂载 (mounted)')
  console.log('初始 visible 值:', visible.value)
  console.log('状态栏高度:', statusBarHeight.value)
  console.log('顶部总高度:', topBarHeight.value)
})

onBeforeUnmount(() => {
  console.log('PushNotification 组件即将销毁')
  if (showPushNotificationHandler) {
    uni.$off('showPushNotification', showPushNotificationHandler)
    console.log('已移除全局事件监听')
  }
  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value)
  }
})
</script>

<style lang="scss" scoped>
.push-notification {
  position: fixed !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  box-sizing: border-box !important;
  z-index: 999999 !important;
  padding: 0 20rpx 20rpx !important;
  pointer-events: none !important;
  transition: all 0.3s cubic-bezier(0.4, 1.4, 0.6, 1);
  background: transparent !important;
  
  &.push-show {
    pointer-events: auto !important;

    .push-content {
      transform: translateY(0) !important;
      opacity: 1 !important;
    }
  }
  
  &.push-hide {
    pointer-events: none !important;

    .push-content {
      transform: translateY(-120%) !important;
      opacity: 0 !important;
    }
  }
}

.push-content {
  background: #fff !important;
  border-radius: 20rpx !important;
  padding: 24rpx !important;
  box-sizing: border-box !important;
  width: 100% !important;
  box-shadow: 0 4rpx 20rpx rgb(0 0 0 / 0.1),
              0 0 0 1rpx rgb(0 0 0 / 0.05) !important;
  transform: translateY(0) !important;
  opacity: 1 !important;
  transition: all 0.3s cubic-bezier(0.4, 1.4, 0.6, 1);
  pointer-events: auto !important;
  display: block !important;
  visibility: visible !important;
  min-height: 100rpx !important;
}

.push-header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.push-icon {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 50%;
  margin-right: 20rpx;
  font-size: 32rpx;
  flex-shrink: 0;
  color: #666;
}

.push-info {
  flex: 1;
  min-width: 0;
}

.push-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #222;
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.push-time {
  font-size: 24rpx;
  color: rgb(0 0 0 / 0.6);
}

.push-close {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 50%;
  margin-left: 16rpx;
  font-size: 28rpx;
  color: #999;
  flex-shrink: 0;
  transition: all 0.2s;
  
  &:active {
    background: #e5e5e5;
    transform: scale(0.9);
  }
}

.push-body {
  padding-left: 80rpx;
}

.push-message {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 动画效果 */
@keyframes slideDown {
  from {
    transform: translateY(-120%);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(0);
    opacity: 1;
  }

  to {
    transform: translateY(-120%);
    opacity: 0;
  }
}
</style>
