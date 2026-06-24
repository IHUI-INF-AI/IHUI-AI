<template>
  <div class="app-permission-page">
    <SettingsPageLayout title="应用权限">
      <div class="app-permission__intro">
        本应用为保障核心功能的正常运行，会根据功能场景向用户申请必要的系统权限。所有权限均遵循「最小必要」原则，由用户主动授权后方可开启，用户可随时在系统设置中撤回授权。以下为各权限的用途说明。
      </div>
      <div class="app-permission__list">
        <div
          v-for="item in permissionList"
          :key="item.name"
          class="app-permission__item"
        >
          <div class="app-permission__item-header">
            <el-icon class="app-permission__item-icon" :size="20">
              <component :is="item.icon" />
            </el-icon>
            <span class="app-permission__item-name">{{ item.name }}</span>
          </div>
          <p class="app-permission__item-desc">{{ item.desc }}</p>
        </div>
      </div>
    </SettingsPageLayout>
  </div>
</template>

<script setup lang="ts">
import { markRaw } from 'vue'
import SettingsPageLayout from './SettingsPageLayout.vue'
import {
  Connection,
  FolderOpened,
  Camera,
  Picture,
  Location,
  Microphone,
  ChatLineRound,
  Bell,
  Monitor,
} from '@element-plus/icons-vue'

const permissionList = [
  {
    name: '网络访问权限',
    desc: '用于应用与服务器之间的数据通信，保障登录、内容加载、消息收发等核心功能正常运行。',
    icon: markRaw(Connection),
  },
  {
    name: '存储权限',
    desc: '用于保存用户头像、缓存文件、下载的图片与文档等内容，提升内容加载速度与离线体验。',
    icon: markRaw(FolderOpened),
  },
  {
    name: '相机权限',
    desc: '用于拍照、扫码、上传图片等场景，仅在用户主动触发相关功能时申请。',
    icon: markRaw(Camera),
  },
  {
    name: '相册权限',
    desc: '用于从系统相册选择图片或视频进行上传、发布、更换头像等操作。',
    icon: markRaw(Picture),
  },
  {
    name: '位置权限',
    desc: '用于提供基于地理位置的服务（如附近内容推荐、同城信息展示），可选择性授权。',
    icon: markRaw(Location),
  },
  {
    name: '麦克风权限',
    desc: '用于语音输入、语音消息录制、语音通话等功能，仅在用户主动使用时调用。',
    icon: markRaw(Microphone),
  },
  {
    name: '通讯录权限',
    desc: '用于好友推荐、联系人同步等社交功能，用户可选择是否授权。',
    icon: markRaw(ChatLineRound),
  },
  {
    name: '通知权限',
    desc: '用于接收消息推送、活动通知、订单状态提醒等，关闭后不影响应用正常使用。',
    icon: markRaw(Bell),
  },
  {
    name: '设备信息',
    desc: '用于设备识别、账号安全保障、服务稳定性优化，不涉及个人敏感信息收集。',
    icon: markRaw(Monitor),
  },
]
</script>

<style lang="scss" scoped>
@use '@/styles/_breakpoints.scss' as bp;

.app-permission-page {
  min-height: 100vh;
}

.app-permission__intro {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 14px 16px;
  margin-bottom: 16px;
  text-align: justify;

  @include bp.min-width('tablet') {
    font-size: 14px;
    padding: 16px 20px;
    margin-bottom: 20px;
  }
}

.app-permission__list {
  display: flex;
  flex-direction: column;
  gap: 12px;

  @include bp.min-width('tablet') {
    gap: 16px;
  }
}

.app-permission__item {
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 14px 16px;

  @include bp.min-width('tablet') {
    padding: 18px 20px;
  }
}

.app-permission__item-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.app-permission__item-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.app-permission__item-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);

  @include bp.min-width('tablet') {
    font-size: 16px;
  }
}

.app-permission__item-desc {
  font-size: 13px;
  line-height: 1.65;
  color: var(--el-text-color-regular);
  margin: 0;
  text-align: justify;

  @include bp.min-width('tablet') {
    font-size: 14px;
    line-height: 1.7;
  }
}
</style>
