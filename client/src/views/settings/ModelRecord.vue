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
        />
      </div>
    </SettingsPageLayout>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SettingsPageLayout from './SettingsPageLayout.vue'

const imageList = ref([
  '/static/images/modelRecord1.png',
  '/static/images/modelRecord2.png',
  '/static/images/modelRecord3.png',
  '/static/images/modelRecord4.png'
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
</style>
