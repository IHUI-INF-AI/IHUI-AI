<template>
  <view class="page">
    <!-- 账号信息 -->
    <view class="group">
      <text class="group-title">账号信息</text>
      <view class="cell">
        <text class="cell-label">头像</text>
        <image class="avatar" :src="userInfo?.avatar || defaultAvatar" mode="aspectFill" @tap="changeAvatar" />
      </view>
      <view class="cell">
        <text class="cell-label">昵称</text>
        <input class="cell-input" v-model="nickname" placeholder="请输入昵称" />
      </view>
      <view class="cell">
        <text class="cell-label">手机号</text>
        <text class="cell-value">{{ maskPhone(userInfo?.phone || '') }}</text>
      </view>
    </view>

    <!-- 通用设置 -->
    <view class="group">
      <text class="group-title">通用</text>
      <view class="cell" @tap="toggleNotification">
        <text class="cell-label">消息通知</text>
        <switch :checked="notificationOn" @change="toggleNotification" color="#007aff" />
      </view>
      <view class="cell" @tap="clearCache">
        <text class="cell-label">清除缓存</text>
        <text class="cell-value">{{ cacheSize }}</text>
      </view>
    </view>

    <!-- 关于 -->
    <view class="group">
      <text class="group-title">关于</text>
      <view class="cell">
        <text class="cell-label">当前版本</text>
        <text class="cell-value">v1.0.0</text>
      </view>
      <view class="cell" @tap="showAgreement">
        <text class="cell-label">用户协议</text>
        <text class="cell-arrow">></text>
      </view>
      <view class="cell" @tap="showPrivacy">
        <text class="cell-label">隐私政策</text>
        <text class="cell-arrow">></text>
      </view>
    </view>

    <view class="save-btn" @tap="handleSave"><text>保存</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getUserInfo, setUserInfo, type UserInfo } from '@/utils/auth'
import { updateProfile } from '@/api'

const defaultAvatar = 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

const userInfo = ref<UserInfo | null>(null)
const nickname = ref('')
const notificationOn = ref(true)
const cacheSize = ref('0KB')

function refresh() {
  userInfo.value = getUserInfo()
  nickname.value = userInfo.value?.userName || userInfo.value?.nickname || ''
}

function maskPhone(phone: string) {
  if (!phone) return '未绑定'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function changeAvatar() {
  uni.chooseImage({
    count: 1,
    success: (res) => {
      if (userInfo.value) {
        userInfo.value.avatar = res.tempFilePaths[0]
      }
    },
  })
}

function toggleNotification() {
  notificationOn.value = !notificationOn.value
  uni.showToast({ title: notificationOn.value ? '已开启通知' : '已关闭通知', icon: 'none' })
}

function clearCache() {
  uni.showModal({
    title: '提示',
    content: '确定清除缓存吗？',
    success: (res) => {
      if (res.confirm) {
        uni.clearStorageSync()
        cacheSize.value = '0KB'
        uni.showToast({ title: '缓存已清除', icon: 'success' })
      }
    },
  })
}

function showAgreement() {
  uni.showToast({ title: '协议页待迁移', icon: 'none' })
}

function showPrivacy() {
  uni.showToast({ title: '隐私政策页待迁移', icon: 'none' })
}

async function handleSave() {
  try {
    const updated = await updateProfile({ userName: nickname.value })
    setUserInfo({ ...userInfo.value, ...updated } as UserInfo)
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e) {
    // 统一提示
  }
}

onShow(refresh)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; padding: 24rpx 32rpx; }

.group { margin-bottom: 32rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.group-title { display: block; padding: 24rpx; font-size: 26rpx; color: #999; }
.cell { display: flex; align-items: center; padding: 28rpx 24rpx; border-bottom: 1rpx solid #f5f5f5; }
.cell:last-child { border-bottom: none; }
.cell-label { flex: 1; font-size: 30rpx; color: #333; }
.cell-value { font-size: 28rpx; color: #999; }
.cell-input { text-align: right; font-size: 28rpx; color: #333; }
.cell-arrow { font-size: 26rpx; color: #ccc; }
.avatar { width: 80rpx; height: 80rpx; border-radius: 50%; }

.save-btn { height: 96rpx; margin-top: 48rpx; line-height: 96rpx; text-align: center; background: #007aff; color: #fff; border-radius: 48rpx; font-size: 32rpx; }
</style>
