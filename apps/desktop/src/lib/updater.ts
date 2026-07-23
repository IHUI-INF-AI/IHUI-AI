import { check } from '@tauri-apps/plugin-updater'

export interface UpdateInfo {
  version: string
  date?: string
  body?: string
}

export interface DownloadProgress {
  downloaded: number
  contentLength: number
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check()
  if (!update) return null
  return {
    version: update.version,
    date: update.date,
    body: update.body,
  }
}

export async function downloadAndInstallUpdate(
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  const update = await check()
  if (!update) throw new Error('No update available')
  let downloaded = 0
  let contentLength = 0
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data.contentLength ?? 0
        break
      case 'Progress':
        downloaded += event.data.chunkLength
        onProgress?.({ downloaded, contentLength })
        break
      case 'Finished':
        break
    }
  })
}
