<template>
  <view class="page">
    <view class="card">
      <view class="row" @tap="navigate('/pages/user/avatar')">
        <text class="label">头像</text>
        <view class="value">
          <image class="avatar" :src="form.avatar || '/static/default-avatar.png'" mode="aspectFill" />
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="row" @tap="navigate('/pages/user/nickname')">
        <text class="label">昵称</text>
        <view class="value"><text>{{ form.nickname || '未设置' }}</text><text class="arrow">›</text></view>
      </view>
      <view class="row" @tap="navigate('/pages/user/phone')">
        <text class="label">手机号</text>
        <view class="value"><text>{{ form.phone || '未绑定' }}</text><text class="arrow">›</text></view>
      </view>
      <view class="row" @tap="navigate('/pages/user/email')">
        <text class="label">邮箱</text>
        <view class="value"><text>{{ form.email || '未绑定' }}</text><text class="arrow">›</text></view>
      </view>
      <view class="row" @tap="navigate('/pages/user/password')">
        <text class="label">修改密码</text>
        <view class="value"><text class="arrow">›</text></view>
      </view>
      <view class="row" @tap="navigate('/pages/user/realname')">
        <text class="label">实名认证</text>
        <view class="value"><text>{{ form.realName ? '已认证' : '未认证' }}</text><text class="arrow">›</text></view>
      </view>
    </view>
    <view class="card">
      <view class="row" @tap="navigate('/pages/user/feedback')">
        <text class="label">意见反馈</text>
        <view class="value"><text class="arrow">›</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getProfile, updateProfile, type UserInfo } from '@/api'

const form = ref<Partial<UserInfo>>({})

async function load() {
  try { form.value = await getProfile() } catch (e) {}
}
async function onSaveGender(g: string) {
  try { await updateProfile({ gender: g } as any); load() } catch (e) {}
}
function navigate(url: string) { uni.navigateTo({ url }) }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.card { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; }
.label { font-size: 28rpx; color: #333; }
.value { display: flex; align-items: center; font-size: 26rpx; color: #999; }
.avatar { width: 80rpx; height: 80rpx; border-radius: 50%; background: #f5f5f5; }
.arrow { color: #ccc; margin-left: 16rpx; }
</style>
