<template>
  <div class="file-download">
    <el-button v-if="!downloading" :type="buttonType" :size="size" @click="download">
      <el-icon><Download /></el-icon>
      {{ buttonText }}
    </el-button>
    <el-button v-else :type="buttonType" :size="size" loading disabled>
      {{ downloadingText }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { logger } from '@/utils/logger'

const { t } = useI18n()

interface Props {
  url: string
  fileName?: string
  buttonText?: string
  downloadingText?: string
  buttonType?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
  size?: 'large' | 'default' | 'small'
}

const props = withDefaults(defineProps<Props>(), {
  buttonText: '下载',
  downloadingText: t('cmpFileDownload.downloading'),
  buttonType: 'primary',
  size: 'default'
})

const downloading = ref(false)

async function download() {
  if (!props.url) {
    ElMessage.warning(t('cmpFileDownload.invalidDownloadLink'))
    return
  }
  
  downloading.value = true
  
  try {
    const response = await fetch(props.url)
    if (!response.ok) throw new Error(t('cmpFileDownload.downloadFailed'))
    
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = props.fileName || getFileNameFromUrl(props.url)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
    ElMessage.success(t('cmpFileDownload.downloadComplete'))
  } catch (error) {
    ElMessage.error(t('cmpFileDownload.downloadFailed2'))
    logger.error('Download error:', error)
  } finally {
    downloading.value = false
  }
}

function getFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    return pathname.split('/').pop() || 'download'
  } catch {
    return 'download'
  }
}
</script>

<style scoped>
.file-download {
  display: inline-block;
}
</style>
