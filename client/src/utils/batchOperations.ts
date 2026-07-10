import { ref } from 'vue'
import type { Ref } from 'vue'

export interface DownloadItem {
  url: string
  fileName: string
}

export function useBatchDownload(): {
  downloading: Ref<boolean>
  downloadFiles: (items: DownloadItem[]) => Promise<void>
} {
  const downloading = ref(false)
  const downloadFiles = async (_items: DownloadItem[]) => {
    downloading.value = true
    try {
    } finally {
      downloading.value = false
    }
  }
  return { downloading, downloadFiles }
}
