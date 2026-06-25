<template>
  <div class="model-record-page">
    <SettingsPageLayout title="模型备案">
      <div class="model-record__card">
        <el-image
          v-for="(img, index) in imageList"
          :key="index"
          class="model-record__image"
          :src="img"
          :preview-src-list="imageList"
          :initial-index="index"
          :preview-teleported="true"
          fit="contain"
          hide-on-click-modal
        >
          <template #error>
            <div class="model-record__placeholder">
              <el-icon :size="48"><Picture /></el-icon>
              <p>模型备案图片 {{ Number(index) + 1 }} 暂未提供</p>
              <p class="model-record__placeholder-sub">如需查看，请联系客服或前往小程序端查看</p>
            </div>
          </template>
          <template #placeholder>
            <div class="model-record__loading">
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

// 2026-06-24 修复: 真实模型备案图片由用户/运营提供, 在素材到位前先指向 /images/common/empty-box.svg 兜底,
// 避免浏览器控制台 404 错误. 收到真实图片后直接把 empty-box.svg 替换为 modelRecord1-4.png 即可,
// 页面其它逻辑(预览、点击查看大图)无需修改.
const MODEL_RECORD_PLACEHOLDER = '/images/common/empty-box.svg'
const imageList = ref([
  MODEL_RECORD_PLACEHOLDER,
  MODEL_RECORD_PLACEHOLDER,
  MODEL_RECORD_PLACEHOLDER,
  MODEL_RECORD_PLACEHOLDER,
])
</script>

<style lang="scss" scoped>
@use '@/styles/_breakpoints.scss' as bp;

.model-record-page {
  min-height: 100vh;
}

.model-record__card {
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

.model-record__image {
  width: 100%;
  display: block;
  border-radius: 8px;
  margin-bottom: 16px;
  cursor: pointer;

  &:last-child {
    margin-bottom: 0;
  }
}

.model-record__placeholder {
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

.model-record__placeholder-sub {
  font-size: 12px;
  opacity: 0.7;
}

.model-record__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: var(--el-text-color-secondary);
}
</style>
