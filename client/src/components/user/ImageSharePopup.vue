<template>
  <el-dialog
    v-model="visible"
    :title="t('imageShare.title')"
    width="500px"
    :close-on-click-modal="false"
    class="image-share-popup"
  >
    <div class="share-content">
      <div class="image-preview">
        <img v-if="imageUrl" :src="imageUrl" :alt="t('imageShare.shareImage')" />
        <div v-else class="no-image">{{ t('imageShare.noImage') }}</div>
      </div>
      <div class="share-options">
        <h4>{{ t('imageShare.shareMethod') }}</h4>
        <div class="share-buttons">
          <el-button @click="handleCopyLink">
            <el-icon><Link /></el-icon>
            {{ t('imageShare.copyLink') }}
          </el-button>
          <el-button @click="handleDownload">
            <el-icon><Download /></el-icon>
            {{ t('imageShare.download') }}
          </el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Link, Download } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  imageUrl?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const handleCopyLink = async () => {
  if (!props.imageUrl) {
    ElMessage.warning(t('imageShare.noLinkToCopy'))
    return
  }
  try {
    await navigator.clipboard.writeText(props.imageUrl)
    ElMessage.success(t('imageShare.copySuccess'))
  } catch {
    ElMessage.error(t('imageShare.copyFailed'))
  }
}

const handleDownload = () => {
  if (!props.imageUrl) {
    ElMessage.warning(t('imageShare.noImageToDownload'))
    return
  }
  const link = document.createElement('a')
  link.href = props.imageUrl
  link.download = `image_${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<style scoped>
.image-share-popup {
  border-radius: var(--global-border-radius);
}

.share-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.image-preview {
  width: 100%;
  height: 300px;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  background: var(--el-fill-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.no-image {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.share-options h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.share-buttons {
  display: flex;
  gap: 12px;
}
</style>
