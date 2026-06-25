<template>
  <div class="business-license-page">
    <SettingsPageLayout title="营业执照">
      <div class="business-license__wrap">
        <el-image
          class="business-license__image"
          :src="licenseImage"
          :preview-src-list="previewList"
          :preview-teleported="true"
          fit="contain"
          hide-on-click-modal
        >
          <template #error>
            <div class="business-license__placeholder">
              <el-icon :size="48"><Picture /></el-icon>
              <p>营业执照图片暂未提供</p>
              <p class="business-license__placeholder-sub">如需查看，请联系客服或前往小程序端查看</p>
            </div>
          </template>
          <template #placeholder>
            <div class="business-license__loading">
              <el-icon :size="32" class="is-loading"><Loading /></el-icon>
            </div>
          </template>
        </el-image>
      </div>
    </SettingsPageLayout>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Picture, Loading } from '@element-plus/icons-vue'
import SettingsPageLayout from './SettingsPageLayout.vue'

// 2026-06-24 修复: 真实营业执照图片由用户/运营提供, 在素材到位前先指向 /images/common/empty-box.svg 兜底,
// 避免浏览器控制台 404 错误. 收到真实图片后直接把 empty-box.svg 替换为 businessLicense.png 即可,
// 页面其它逻辑(预览、点击查看大图)无需修改.
const LICENSE_PLACEHOLDER = '/images/common/empty-box.svg'
const licenseImage = ref(LICENSE_PLACEHOLDER)
const previewList = ref([licenseImage.value])
</script>

<style lang="scss" scoped>
@use '@/styles/_breakpoints.scss' as bp;

.business-license-page {
  min-height: 100vh;
}

.business-license__wrap {
  background-color: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  padding: 16px;
  box-sizing: border-box;

  @include bp.min-width('tablet') {
    padding: 24px;
  }
}

.business-license__image {
  width: 100%;
  display: block;
  border-radius: 8px;
  cursor: pointer;
}

.business-license__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 24px;
  color: var(--el-text-color-secondary);
  background-color: var(--el-fill-color-light);

  p {
    margin: 0;
    font-size: 14px;
  }
}

.business-license__placeholder-sub {
  font-size: 12px;
  opacity: 0.7;
}

.business-license__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: var(--el-text-color-secondary);
}
</style>
