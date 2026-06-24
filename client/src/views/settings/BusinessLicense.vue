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
        />
      </div>
    </SettingsPageLayout>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SettingsPageLayout from './SettingsPageLayout.vue'

const licenseImage = ref('/static/images/businessLicense.png')
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
</style>
