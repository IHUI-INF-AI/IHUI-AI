<template>
  <view class="edit-profile-page">
    <view class="nav-bar">
      <view class="nav-back" @click="goBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="nav-title">编辑资料</text>
    </view>

    <view class="content">
      <view class="avatar-section">
        <image class="avatar" :src="userInfo.avatar || '/static/images/default_avatar.png'" mode="aspectFill" />
        <text class="change-avatar">修改头像</text>
      </view>

      <view class="form-section">
        <view class="form-item">
          <text class="label">昵称</text>
          <input class="input" v-model="nickname" placeholder="请输入昵称" />
        </view>
        <view class="form-item">
          <text class="label">性别</text>
          <view class="gender-options">
            <view class="gender-btn" :class="{ active: gender === '男' }" @click="gender = '男'">
              <text>男</text>
            </view>
            <view class="gender-btn" :class="{ active: gender === '女' }" @click="gender = '女'">
              <text>女</text>
            </view>
          </view>
        </view>
        <view class="form-item">
          <text class="label">个人简介</text>
          <textarea class="textarea" v-model="bio" placeholder="请输入个人简介" maxlength="200" />
        </view>
      </view>

      <view class="save-btn" @click="saveProfile">
        <text class="save-text">保存</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const userInfo = ref<any>({})
const nickname = ref('')
const gender = ref('')
const bio = ref('')

onMounted(() => {
  const data = uni.getStorageSync('data') || uni.getStorageSync('userInfo') || {}
  userInfo.value = data
  nickname.value = data.nickname || ''
  gender.value = data.gender || ''
  bio.value = data.bio || ''
})

function goBack() {
  uni.navigateBack({ delta: 1 })
}

function saveProfile() {
  uni.showToast({ title: '保存成功', icon: 'success' })
  setTimeout(() => {
    uni.navigateBack({ delta: 1 })
  }, 1500)
}
</script>

<style lang="scss" scoped>
.edit-profile-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 88rpx;
  background: #fff;
  display: flex;
  align-items: center;
  padding-top: var(--status-bar-height);
  z-index: 100;
}

.nav-back {
  padding: 20rpx;
}

.back-icon {
  font-size: 40rpx;
  color: #333;
}

.nav-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #333;
}

.content {
  padding-top: calc(var(--status-bar-height) + 88rpx);
  padding: 20rpx;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 0;
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
}

.avatar {
  width: 150rpx;
  height: 150rpx;
  border-radius: 50%;
  margin-bottom: 20rpx;
}

.change-avatar {
  font-size: 28rpx;
  color: #07c160;
}

.form-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
}

.form-item {
  display: flex;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }
}

.label {
  font-size: 30rpx;
  color: #333;
  width: 140rpx;
}

.input {
  flex: 1;
  font-size: 30rpx;
  color: #333;
  text-align: right;
}

.gender-options {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
}

.gender-btn {
  padding: 10rpx 30rpx;
  border-radius: 8rpx;
  background: #f5f5f5;

  &.active {
    background: #07c160;
    color: #fff;
  }
}

.textarea {
  flex: 1;
  font-size: 30rpx;
  color: #333;
  min-height: 120rpx;
}

.save-btn {
  margin-top: 60rpx;
  background: #07c160;
  border-radius: 16rpx;
  padding: 28rpx;
  text-align: center;
}

.save-text {
  font-size: 32rpx;
  color: #fff;
  font-weight: bold;
}
</style>
